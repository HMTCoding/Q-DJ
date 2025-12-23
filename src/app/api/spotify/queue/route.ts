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
}



export async function POST(request: NextRequest) {
  try {
    const { uri, eventId } = await request.json();

    if (!uri || !eventId) {
      return Response.json(
        { error: 'URI and eventId are required' },
        { status: 400 }
      );
    }

    // Get the event to access the manager's tokens
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('access_token, refresh_token')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return Response.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    let accessToken = event.access_token;

    // Check if access token is expired or about to expire, then refresh it
    if (!accessToken && event.refresh_token) {
      // If no access token but we have a refresh token, get a new one
      accessToken = await refreshAndSaveSpotifyToken(eventId, event.refresh_token);
      
      if (!accessToken) {
        return Response.json(
          { error: 'Unable to refresh access token' },
          { status: 401 }
        );
      }
    } else if (!accessToken) {
      return Response.json(
        { error: 'No access token available' },
        { status: 401 }
      );
    }

    // Add the track to the Spotify queue
    const queueResponse = await fetch(
      'https://api.spotify.com/v1/me/player/queue?uri=' + encodeURIComponent(uri),
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!queueResponse.ok) {
      if (queueResponse.status === 401) {
        // Token expired, try to refresh
        console.log('Access token expired, attempting to refresh token for queue');
        const newAccessToken = await refreshAndSaveSpotifyToken(eventId, event.refresh_token);
        
        if (newAccessToken) {
          accessToken = newAccessToken;
          
          console.log('Successfully refreshed access token');

          // Retry the queue request with new token
          const retryResponse = await fetch(
            'https://api.spotify.com/v1/me/player/queue?uri=' + encodeURIComponent(uri),
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          if (!retryResponse.ok) {
            if (retryResponse.status === 401) {
              return Response.json(
                { error: 'Invalid or expired access token after refresh' },
                { status: 401 }
              );
            } else if (retryResponse.status === 404) {
              return Response.json(
                { error: 'No active device found. The DJ needs to have Spotify playing on a device.' },
                { status: 400 }
              );
            } else if (retryResponse.status === 403) {
              return Response.json(
                { error: 'Not allowed to queue tracks on this device' },
                { status: 403 }
              );
            } else if (retryResponse.status === 429) {
              return Response.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429 }
              );
            }
            
            return Response.json(
              { error: 'Error adding track to queue after token refresh' },
              { status: retryResponse.status }
            );
          }
          
          return Response.json({ 
            success: true, 
            message: 'Track added to queue successfully' 
          });
        } else {
          // Token refresh failed
          return Response.json(
            { error: 'Unable to refresh access token' },
            { status: 401 }
          );
        }
      } else if (queueResponse.status === 404) {
        return Response.json(
          { error: 'No active device found. The DJ needs to have Spotify playing on a device.' },
          { status: 400 }
        );
      } else if (queueResponse.status === 403) {
        return Response.json(
          { error: 'Not allowed to queue tracks on this device' },
          { status: 403 }
        );
      } else if (queueResponse.status === 429) {
        return Response.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      
      return Response.json(
        { error: 'Error adding track to queue' },
        { status: queueResponse.status }
      );
    }

    return Response.json({ 
      success: true, 
      message: 'Track added to queue successfully' 
    });
  } catch (error) {
    console.error('Error in Spotify queue API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}