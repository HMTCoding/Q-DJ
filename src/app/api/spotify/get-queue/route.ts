import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { refreshAndSaveSpotifyToken, refreshSpotifyToken } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    console.log('Received eventId:', eventId);
    
    if (!eventId) {
      console.log('No eventId provided in request');
      return Response.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Fetch event data to get manager's access token and mode
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('access_token, refresh_token, mode')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      console.log('Event not found in Supabase:', eventId, 'Error:', eventError);
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    
    console.log('Found event in Supabase for ID:', eventId);

    // Check if the event is in queue mode (this API should not be used for playlist mode)
    if (eventData.mode === 'playlist') {
      return Response.json({ 
        error: 'This API endpoint is not valid for playlist mode events',
        message: 'Use the playlist tracks API instead'
      }, { status: 400 });
    }
    
    let accessToken = eventData.access_token;

    // Log before making Spotify API call
    console.log('Making Spotify API call with access token (first 10 chars):', accessToken?.substring(0, 10));

    // Call Spotify API to get queue
    const queueResponse = await fetch('https://api.spotify.com/v1/me/player/queue', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!queueResponse.ok) {
      console.log('Spotify API call failed with status:', queueResponse.status);
      // If unauthorized, try to refresh the token
      if (queueResponse.status === 401) {
        console.log('Access token expired, attempting to refresh token');
        // Attempt token refresh
        console.log('Attempting to refresh token for event ID:', eventId);
        
        const newAccessToken = await refreshAndSaveSpotifyToken(eventId, eventData.refresh_token);
        
        if (newAccessToken) {
          accessToken = newAccessToken;
          
          console.log('Successfully refreshed access token');

          // Retry the queue request with new token
          const retryResponse = await fetch('https://api.spotify.com/v1/me/player/queue', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json();
            // If the retry still fails with a 404, it means the DJ is offline
            if (retryResponse.status === 404) {
              return Response.json({ 
                queue: [], 
                message: 'DJ is currently offline or no active device found' 
              });
            }
            return Response.json({ error: errorData.error?.message || 'Failed to fetch queue after token refresh' }, { status: retryResponse.status });
          }

          const queueData = await retryResponse.json();
          
          // Check if the queue is empty and there might not be an active device
          if (!queueData.queue || queueData.queue.length === 0) {
            // Try to check if there's an active device to differentiate between empty queue and no active device
            const playerResponse = await fetch('https://api.spotify.com/v1/me/player', {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
            
            if (playerResponse.ok) {
              const playerData = await playerResponse.json();
              if (!playerData.device || !playerData.device.is_active) {
                return Response.json({ 
                  queue: [], 
                  message: 'DJ is currently offline or no active device found' 
                });
              }
            }
          }
          
          // Return only the next 10 tracks to save data
          return Response.json({ queue: queueData.queue?.slice(0, 10) || [] });
        } else {
          // Token refresh failed
          console.error('Token refresh failed for event ID:', eventId);
          // Get the error details from the refreshAndSaveSpotifyToken function
          try {
            await refreshSpotifyToken(eventData.refresh_token);
          } catch (refreshError) {
            console.error('Detailed token refresh error for event ID:', eventId, 'Error:', refreshError instanceof Error ? refreshError.message : refreshError);
            return Response.json({ 
              error: 'Failed to refresh access token', 
              message: 'Unable to refresh Spotify access token',
              detailed_error: refreshError instanceof Error ? refreshError.message : 'Unknown error during refresh'
            }, { status: 401 });
          }
          return Response.json({ 
            error: 'Failed to refresh access token', 
            message: 'Unable to refresh Spotify access token'
          }, { status: 401 });
        }
      } else {
        let errorData;
        try {
          errorData = await queueResponse.json();
        } catch (parseError) {
          // If JSON parsing fails, try to get the raw text
          const errorText = await queueResponse.text();
          errorData = { error: { message: `Failed to parse Spotify response: ${errorText}` } };
        }
        
        // If the initial request fails with a 404, it means the DJ is offline
        if (queueResponse.status === 404) {
          return Response.json({ 
            queue: [], 
            message: 'DJ is currently offline or no active device found' 
          });
        }
        return Response.json({ error: errorData.error?.message || 'Failed to fetch queue' }, { status: queueResponse.status });
      }
    }

    const queueData = await queueResponse.json();
    
    // Check if the queue is empty and there might not be an active device
    if (!queueData.queue || queueData.queue.length === 0) {
      // Try to check if there's an active device to differentiate between empty queue and no active device
      const playerResponse = await fetch('https://api.spotify.com/v1/me/player', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      if (playerResponse.ok) {
        const playerData = await playerResponse.json();
        if (!playerData.device || !playerData.device.is_active) {
          return Response.json({ 
            queue: [], 
            message: 'DJ is currently offline or no active device found' 
          });
        }
      }
    }
    
    // Return only the next 10 tracks to save data
    return Response.json({ queue: queueData.queue?.slice(0, 10) || [], mode: eventData.mode });
  } catch (error) {
    console.error('Error fetching queue:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}