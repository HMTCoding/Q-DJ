import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { refreshAndSaveSpotifyToken } from '@/lib/spotify';

interface Event {
  id: string;
  name: string;
  manager_id: string;
  access_token: string | null;
  refresh_token: string | null;
  is_active: boolean;
  mode: 'queue' | 'playlist';
  spotify_playlist_id: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return Response.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Fetch event data to get manager's access token and playlist ID
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('access_token, refresh_token, mode, spotify_playlist_id')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check if the event is in playlist mode and has a playlist ID
    if (eventData.mode !== 'playlist' || !eventData.spotify_playlist_id) {
      return Response.json({ error: 'Event is not in playlist mode or has no playlist ID' }, { status: 400 });
    }

    let accessToken = eventData.access_token;
    
    // Step A: Get the currently playing track
    let currentlyPlayingTrackId = null;
    try {
      const currentlyPlayingResponse = await fetch(
        'https://api.spotify.com/v1/me/player/currently-playing',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      
      if (currentlyPlayingResponse.ok) {
        const currentlyPlayingData = await currentlyPlayingResponse.json();
        if (currentlyPlayingData && currentlyPlayingData.item) {
          currentlyPlayingTrackId = currentlyPlayingData.item.id;
        }
      } else if (currentlyPlayingResponse.status === 401) {
        // Token expired, try to refresh
        console.log('Access token expired, attempting to refresh token for currently playing');
        const newAccessToken = await refreshAndSaveSpotifyToken(eventId, eventData.refresh_token);
        
        if (newAccessToken) {
          accessToken = newAccessToken;
          
          // Retry the currently playing request with new token
          const retryResponse = await fetch(
            'https://api.spotify.com/v1/me/player/currently-playing',
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
          
          if (retryResponse.ok) {
            const currentlyPlayingData = await retryResponse.json();
            if (currentlyPlayingData && currentlyPlayingData.item) {
              currentlyPlayingTrackId = currentlyPlayingData.item.id;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching currently playing track:', error);
    }
    
    // Get all tracks from the playlist
    const playlistResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${eventData.spotify_playlist_id}/tracks?limit=50`, // Get more tracks to have a larger pool
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!playlistResponse.ok) {
      // If unauthorized, try to refresh the token
      if (playlistResponse.status === 401) {
        console.log('Access token expired, attempting to refresh token for playlist tracks');
        const newAccessToken = await refreshAndSaveSpotifyToken(eventId, eventData.refresh_token);
        
        if (newAccessToken) {
          accessToken = newAccessToken;
          
          console.log('Successfully refreshed access token');
          
          // Retry the playlist tracks request with new token
          const retryResponse = await fetch(
            `https://api.spotify.com/v1/playlists/${eventData.spotify_playlist_id}/tracks?limit=50`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({}));
            return Response.json({ error: errorData.error?.message || 'Failed to fetch playlist tracks after token refresh' }, { status: retryResponse.status });
          }

          const playlistData = await retryResponse.json();
          
          // Step B & C: Filter tracks to show only those after the currently playing track
          const allTracks = playlistData.items.map((item: any) => item.track).filter((track: any) => track !== null);
          
          let upcomingTracks = [];
          if (currentlyPlayingTrackId) {
            // Find the index of the currently playing track
            const currentIndex = allTracks.findIndex((track: any) => track.id === currentlyPlayingTrackId);
            
            if (currentIndex !== -1) {
              // Step C: Return tracks that come after the currently playing track
              upcomingTracks = allTracks.slice(currentIndex + 1, currentIndex + 6); // Next 5 tracks
            } else {
              // Fallback: if current track not found in playlist, return first few tracks
              upcomingTracks = allTracks.slice(0, 5);
            }
          } else {
            // Fallback: if nothing is currently playing, return first few tracks
            upcomingTracks = allTracks.slice(0, 5);
          }
          
          return Response.json({ tracks: upcomingTracks });
        } else {
          // Token refresh failed
          console.error('Token refresh failed for event ID:', eventId);
          return Response.json({ 
            error: 'Failed to refresh access token', 
            message: 'Unable to refresh Spotify access token'
          }, { status: 401 });
        }
      } else {
        let errorData;
        try {
          errorData = await playlistResponse.json();
        } catch (parseError) {
          // If JSON parsing fails, try to get the raw text
          const errorText = await playlistResponse.text();
          errorData = { error: { message: `Failed to parse Spotify response: ${errorText}` } };
        }
        
        return Response.json({ error: errorData.error?.message || 'Failed to fetch playlist tracks' }, { status: playlistResponse.status });
      }
    }

    const playlistData = await playlistResponse.json();
    
    // Step B & C: Filter tracks to show only those after the currently playing track
    const allTracks = playlistData.items.map((item: any) => item.track).filter((track: any) => track !== null);
    
    let upcomingTracks = [];
    if (currentlyPlayingTrackId) {
      // Find the index of the currently playing track
      const currentIndex = allTracks.findIndex((track: any) => track.id === currentlyPlayingTrackId);
      
      if (currentIndex !== -1) {
        // Step C: Return tracks that come after the currently playing track
        upcomingTracks = allTracks.slice(currentIndex + 1, currentIndex + 6); // Next 5 tracks
      } else {
        // Fallback: if current track not found in playlist, return first few tracks
        upcomingTracks = allTracks.slice(0, 5);
      }
    } else {
      // Fallback: if nothing is currently playing, return first few tracks
      upcomingTracks = allTracks.slice(0, 5);
    }
    
    return Response.json({ tracks: upcomingTracks, mode: eventData.mode });
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}