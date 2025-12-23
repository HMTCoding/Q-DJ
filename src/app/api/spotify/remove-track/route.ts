import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabase } from '@/lib/supabase';
import { refreshAndSaveSpotifyToken } from '@/lib/spotify';

export async function POST(request: NextRequest) {
  try {
    // Get the session to verify the user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { eventId } = await request.json();

    if (!eventId) {
      return Response.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Fetch event data to get manager's access token and verify the user is the manager
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('access_token, refresh_token, manager_id')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      console.log('Event not found in Supabase:', eventId, 'Error:', eventError);
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    
    // Check if the authenticated user is the manager of this event
    if (eventData.manager_id !== session.user.id) {
      return Response.json({ error: 'Unauthorized: You are not the manager of this event' }, { status: 403 });
    }

    let accessToken = eventData.access_token;

    // Call Spotify API to skip the next track (this is the closest to "removing" from queue)
    const skipResponse = await fetch('https://api.spotify.com/v1/me/player/next', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!skipResponse.ok) {
      // If unauthorized, try to refresh the token
      if (skipResponse.status === 401) {
        console.log('Access token expired, attempting to refresh token');
        
        // Attempt token refresh
        const newAccessToken = await refreshAndSaveSpotifyToken(eventId, eventData.refresh_token);

        if (newAccessToken) {
          accessToken = newAccessToken;

          // Retry the skip request with new token
          const retryResponse = await fetch('https://api.spotify.com/v1/me/player/next', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json();
            return Response.json({ error: errorData.error?.message || 'Failed to skip track after token refresh' }, { status: retryResponse.status });
          }

          return Response.json({ 
            success: true, 
            message: 'Next track skipped successfully' 
          });
        } else {
          // Token refresh failed
          return Response.json({ error: 'Failed to refresh access token', message: 'Unable to refresh Spotify access token' }, { status: 401 });
        }
      } else {
        const errorData = await skipResponse.json();
        if (skipResponse.status === 404) {
          return Response.json({ 
            error: 'No active device found. The DJ needs to have Spotify playing on a device.' 
          }, { status: 400 });
        }
        return Response.json({ error: errorData.error?.message || 'Failed to skip track' }, { status: skipResponse.status });
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Next track skipped successfully' 
    });
  } catch (error) {
    console.error('Error skipping track:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}