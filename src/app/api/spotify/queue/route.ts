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



export async function POST(request: NextRequest) {
  try {
    const { uri, eventId } = await request.json();

    if (!uri || !eventId) {
      return Response.json(
        { error: 'URI and eventId are required' },
        { status: 400 }
      );
    }

    // Get the event to access the manager's tokens and mode
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('access_token, refresh_token, mode, spotify_playlist_id')
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

    let response: Response;
    
    // Check the event mode and add track accordingly
    if (event.mode === 'playlist') {
      // For playlist mode, add track to the specific playlist
      if (!event.spotify_playlist_id) {
        return Response.json(
          { error: 'No playlist ID found for this event' },
          { status: 400 }
        );
      }
      
      // Add the track to the Spotify playlist
      response = await fetch(
        `https://api.spotify.com/v1/playlists/${event.spotify_playlist_id}/tracks`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uris: [uri] // Spotify API expects an array of URIs
          }),
        }
      );
    } else {
      // For queue mode, add track to the player queue
      response = await fetch(
        'https://api.spotify.com/v1/me/player/queue?uri=' + encodeURIComponent(uri),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
    }

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try to refresh
        console.log('Access token expired, attempting to refresh token');
        const newAccessToken = await refreshAndSaveSpotifyToken(eventId, event.refresh_token);
        
        if (newAccessToken) {
          accessToken = newAccessToken;
          
          console.log('Successfully refreshed access token');

          // Retry the request with new token
          let retryResponse: Response;
          if (event.mode === 'playlist') {
            // Retry for playlist mode
            retryResponse = await fetch(
              `https://api.spotify.com/v1/playlists/${event.spotify_playlist_id}/tracks`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  uris: [uri] // Spotify API expects an array of URIs
                }),
              }
            );
          } else {
            // Retry for queue mode
            retryResponse = await fetch(
              'https://api.spotify.com/v1/me/player/queue?uri=' + encodeURIComponent(uri),
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );
          }

          if (!retryResponse.ok) {
            if (retryResponse.status === 401) {
              return Response.json(
                { error: 'Invalid or expired access token after refresh' },
                { status: 401 }
              );
            } else if (retryResponse.status === 404 && event.mode === 'queue') {
              return Response.json(
                { error: 'No active device found. The DJ needs to have Spotify playing on a device.' },
                { status: 400 }
              );
            } else if (retryResponse.status === 403) {
              return Response.json(
                { error: 'Not allowed to add tracks to this ' + (event.mode === 'playlist' ? 'playlist' : 'queue') },
                { status: 403 }
              );
            } else if (retryResponse.status === 429) {
              return Response.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429 }
              );
            }
            
            return Response.json(
              { error: `Error adding track to ${event.mode} after token refresh` },
              { status: retryResponse.status }
            );
          }
          
          return Response.json({ 
            success: true, 
            message: `Track added to ${event.mode} successfully` 
          });
        } else {
          // Token refresh failed
          console.error('Token refresh failed for event ID:', eventId);
          return Response.json(
            { error: 'Unable to refresh access token' },
            { status: 401 }
          );
        }
      } else if (response.status === 404 && event.mode === 'queue') {
        return Response.json(
          { error: 'No active device found. The DJ needs to have Spotify playing on a device.' },
          { status: 400 }
        );
      } else if (response.status === 403) {
        return Response.json(
          { error: 'Not allowed to add tracks to this ' + (event.mode === 'playlist' ? 'playlist' : 'queue') },
          { status: 403 }
        );
      } else if (response.status === 429) {
        return Response.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      
      return Response.json(
        { error: `Error adding track to ${event.mode}` },
        { status: response.status }
      );
    }

    return Response.json({ 
      success: true, 
      message: `Track added to ${event.mode} successfully` 
    });
  } catch (error) {
    console.error('Error in Spotify queue API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}