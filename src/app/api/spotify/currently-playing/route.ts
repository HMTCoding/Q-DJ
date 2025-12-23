import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { refreshAndSaveSpotifyToken } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    console.log('Received eventId for currently playing:', eventId);
    
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
    console.log('Making Spotify currently playing API call with access token (first 10 chars):', accessToken?.substring(0, 10));

    // Call Spotify API to get currently playing track
    const currentlyPlayingResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!currentlyPlayingResponse.ok) {
      console.log('Spotify currently playing API call failed with status:', currentlyPlayingResponse.status);
      // If unauthorized, try to refresh the token
      if (currentlyPlayingResponse.status === 401) {
        console.log('Access token expired, attempting to refresh token');
        // Attempt token refresh
        const newAccessToken = await refreshAndSaveSpotifyToken(eventId, eventData.refresh_token);
        
        if (newAccessToken) {
          accessToken = newAccessToken;
          
          console.log('Successfully refreshed access token');

          // Retry the currently playing request with new token
          const retryResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json();
            // If the retry still fails with a 404, it means the DJ is offline
            if (retryResponse.status === 404) {
              return Response.json({ 
                currentlyPlaying: null,
                progress_ms: 0,
                duration_ms: 0,
                is_playing: false,
                message: 'DJ is currently offline or no active device found' 
              });
            }
            return Response.json({ error: errorData.error?.message || 'Failed to fetch currently playing after token refresh' }, { status: retryResponse.status });
          }

          const currentlyPlayingData = await retryResponse.json();
          
          // Check if there's an active device
          const playerResponse = await fetch('https://api.spotify.com/v1/me/player', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          
          if (playerResponse.ok) {
            const playerData = await playerResponse.json();
            if (!playerData.device || !playerData.device.is_active) {
              return Response.json({ 
                currentlyPlaying: null,
                progress_ms: 0,
                duration_ms: 0,
                is_playing: false,
                message: 'DJ is currently offline or no active device found' 
              });
            }
          }
          
          // Return currently playing data with progress
          return Response.json({
            currentlyPlaying: currentlyPlayingData.item ? {
              id: currentlyPlayingData.item.id,
              name: currentlyPlayingData.item.name,
              artists: currentlyPlayingData.item.artists.map((artist: any) => ({ name: artist.name })),
              album: {
                images: currentlyPlayingData.item.album.images,
              },
              uri: currentlyPlayingData.item.uri,
            } : null,
            progress_ms: currentlyPlayingData.progress_ms || 0,
            duration_ms: currentlyPlayingData.item?.duration_ms || 0,
            is_playing: currentlyPlayingData.is_playing || false,
          });
        } else {
          // Token refresh failed
          return Response.json({ error: 'Failed to refresh access token', message: 'Unable to refresh Spotify access token' }, { status: 401 });
        }
      } else {
        const errorData = await currentlyPlayingResponse.json();
        // If the initial request fails with a 404, it means the DJ is offline
        if (currentlyPlayingResponse.status === 404) {
          return Response.json({ 
            currentlyPlaying: null,
            progress_ms: 0,
            duration_ms: 0,
            is_playing: false,
            message: 'DJ is currently offline or no active device found' 
          });
        }
        return Response.json({ error: errorData.error?.message || 'Failed to fetch currently playing' }, { status: currentlyPlayingResponse.status });
      }
    }

    const currentlyPlayingData = await currentlyPlayingResponse.json();
    
    // Check if there's an active device
    const playerResponse = await fetch('https://api.spotify.com/v1/me/player', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (playerResponse.ok) {
      const playerData = await playerResponse.json();
      if (!playerData.device || !playerData.device.is_active) {
        return Response.json({ 
          currentlyPlaying: null,
          progress_ms: 0,
          duration_ms: 0,
          is_playing: false,
          message: 'DJ is currently offline or no active device found' 
        });
      }
    }
    
    // Return currently playing data with progress
    return Response.json({
      currentlyPlaying: currentlyPlayingData.item ? {
        id: currentlyPlayingData.item.id,
        name: currentlyPlayingData.item.name,
        artists: currentlyPlayingData.item.artists.map((artist: any) => ({ name: artist.name })),
        album: {
          images: currentlyPlayingData.item.album.images,
        },
        uri: currentlyPlayingData.item.uri,
      } : null,
      progress_ms: currentlyPlayingData.progress_ms || 0,
      duration_ms: currentlyPlayingData.item?.duration_ms || 0,
      is_playing: currentlyPlayingData.is_playing || false,
    });
  } catch (error) {
    console.error('Error fetching currently playing:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}