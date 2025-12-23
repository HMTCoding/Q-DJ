import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { refreshAndSaveSpotifyToken } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    console.log('Received eventId for current state:', eventId);
    
    if (!eventId) {
      console.log('No eventId provided in request');
      return Response.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Fetch event data to get manager's access token
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('access_token, refresh_token')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      console.log('Event not found in Supabase:', eventId, 'Error:', eventError);
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    
    console.log('Found event in Supabase for ID:', eventId);

    let accessToken = eventData.access_token;

    // Log before making Spotify API call
    console.log('Making Spotify API calls with access token (first 10 chars):', accessToken?.substring(0, 10));

    // Call Spotify API to get currently playing track
    const currentlyPlayingResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let currentlyPlayingData = null;
    let currentlyPlaying = null;
    let progress_ms = 0;
    let duration_ms = 0;
    let is_playing = false;
    let djOfflineMessage = null;

    if (currentlyPlayingResponse.ok) {
      currentlyPlayingData = await currentlyPlayingResponse.json();
      
      // Check if there's an active device
      const playerResponse = await fetch('https://api.spotify.com/v1/me/player', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      if (playerResponse.ok) {
        const playerData = await playerResponse.json();
        if (!playerData.device || !playerData.device.is_active) {
          djOfflineMessage = 'DJ is currently offline or no active device found';
        }
      }
      
      if (currentlyPlayingData.item) {
        currentlyPlaying = {
          id: currentlyPlayingData.item.id,
          name: currentlyPlayingData.item.name,
          artists: currentlyPlayingData.item.artists.map((artist: any) => ({ name: artist.name })),
          album: {
            images: currentlyPlayingData.item.album.images,
          },
          uri: currentlyPlayingData.item.uri,
        };
        progress_ms = currentlyPlayingData.progress_ms || 0;
        duration_ms = currentlyPlayingData.item.duration_ms || 0;
        is_playing = currentlyPlayingData.is_playing || false;
      }
    } else if (currentlyPlayingResponse.status === 401) {
      // Token expired, try to refresh
      console.log('Access token expired, attempting to refresh token for currently playing');
      const newAccessToken = await refreshAndSaveSpotifyToken(eventId, eventData.refresh_token);
      
      if (newAccessToken) {
        accessToken = newAccessToken;
        
        console.log('Successfully refreshed access token for currently playing');

        // Retry the currently playing request with new token
        const retryResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (retryResponse.ok) {
          currentlyPlayingData = await retryResponse.json();
          
          // Check if there's an active device
          const playerResponse = await fetch('https://api.spotify.com/v1/me/player', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          
          if (playerResponse.ok) {
            const playerData = await playerResponse.json();
            if (!playerData.device || !playerData.device.is_active) {
              djOfflineMessage = 'DJ is currently offline or no active device found';
            }
          }
          
          if (currentlyPlayingData.item) {
            currentlyPlaying = {
              id: currentlyPlayingData.item.id,
              name: currentlyPlayingData.item.name,
              artists: currentlyPlayingData.item.artists.map((artist: any) => ({ name: artist.name })),
              album: {
                images: currentlyPlayingData.item.album.images,
              },
              uri: currentlyPlayingData.item.uri,
            };
            progress_ms = currentlyPlayingData.progress_ms || 0;
            duration_ms = currentlyPlayingData.item.duration_ms || 0;
            is_playing = currentlyPlayingData.is_playing || false;
          }
        } else {
          const errorData = await retryResponse.json();
          if (retryResponse.status === 404) {
            djOfflineMessage = 'DJ is currently offline or no active device found';
          }
        }
      } else {
        // Token refresh failed
        return Response.json({ error: 'Failed to refresh access token for currently playing', message: 'Unable to refresh Spotify access token' }, { status: 401 });
      }
    } else if (currentlyPlayingResponse.status === 404) {
      djOfflineMessage = 'DJ is currently offline or no active device found';
    }

    // Call Spotify API to get queue
    const queueResponse = await fetch('https://api.spotify.com/v1/me/player/queue', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let queue = [];
    let queueError = null;

    if (queueResponse.ok) {
      const queueData = await queueResponse.json();
      // Return only the next 2 tracks for the TV view
      queue = (queueData.queue || []).slice(0, 2).map((track: any) => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map((artist: any) => ({ name: artist.name })),
        album: {
          images: track.album.images,
        },
        uri: track.uri,
      }));
    } else if (queueResponse.status === 401) {
      // Token expired, try to refresh (if not already refreshed)
      if (!djOfflineMessage) { // Only refresh if we haven't already done so
        const newAccessToken = await refreshAndSaveSpotifyToken(eventId, eventData.refresh_token);
        
        if (newAccessToken) {
          accessToken = newAccessToken;
          
          console.log('Successfully refreshed access token for queue');

          // Retry the queue request with new token
          const retryResponse = await fetch('https://api.spotify.com/v1/me/player/queue', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (retryResponse.ok) {
            const queueData = await retryResponse.json();
            // Return only the next 2 tracks for the TV view
            queue = (queueData.queue || []).slice(0, 2).map((track: any) => ({
              id: track.id,
              name: track.name,
              artists: track.artists.map((artist: any) => ({ name: artist.name })),
              album: {
                images: track.album.images,
              },
              uri: track.uri,
            }));
          } else {
            const errorData = await retryResponse.json();
            if (retryResponse.status === 404) {
              djOfflineMessage = 'DJ is currently offline or no active device found';
            } else {
              queueError = errorData.error?.message || 'Failed to fetch queue after token refresh';
            }
          }
        } else {
          // Token refresh failed
          queueError = 'Failed to refresh access token for queue';
        }
      }
    } else if (queueResponse.status === 404) {
      djOfflineMessage = 'DJ is currently offline or no active device found';
    } else {
      const errorData = await queueResponse.json();
      queueError = errorData.error?.message || 'Failed to fetch queue';
    }

    // If we have a DJ offline message, return it
    if (djOfflineMessage) {
      return Response.json({ 
        currentlyPlaying: null,
        progress_ms: 0,
        duration_ms: 0,
        is_playing: false,
        queue: [],
        message: djOfflineMessage 
      });
    }

    // Return combined data
    return Response.json({
      currentlyPlaying,
      progress_ms,
      duration_ms,
      is_playing,
      queue,
      queueError: queueError || null,
    });
  } catch (error) {
    console.error('Error fetching current state:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}