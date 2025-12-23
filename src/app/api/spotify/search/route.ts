import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { refreshAndSaveSpotifyToken } from '@/lib/spotify';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    images: { url: string; height: number; width: number }[];
  };
}

interface Event {
  id: string;
  name: string;
  manager_id: string;
  is_active: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { query, eventId } = await request.json();

    if (!query || !eventId) {
      return Response.json(
        { error: 'Query and eventId are required' },
        { status: 400 }
      );
    }

    // First, get the event to ensure it exists and is active
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('is_active', true)
      .single();

    if (eventError || !event) {
      return Response.json(
        { error: 'Event not found or inactive' },
        { status: 404 }
      );
    }

        // In a real implementation, you'd need to store and retrieve the manager's access token
    // from a secure location (like a database) when they last authenticated
    
    // In a real implementation, we'll need to get the manager's access token from the events table
    // where it should have been stored when the event was created.
    // For this example, we'll assume the access token is stored in the events table
    
    // Get the access token for this event manager
    const { data: eventData, error: eventDataError } = await supabase
      .from('events')
      .select('access_token, refresh_token')
      .eq('id', eventId)
      .single();
    
    if (eventDataError) {
      console.error('Error fetching event data:', eventDataError);
      return Response.json(
        { error: 'Error retrieving event data' },
        { status: 500 }
      );
    }
    
    if (!eventData || !eventData.access_token) {
      console.error('No access token found for event ID:', eventId);
      return Response.json(
        { error: 'Access token not available for this event manager. The event manager needs to authenticate with Spotify.' },
        { status: 401 }
      );
    }
    
    let accessToken = eventData.access_token;
    
    // Call Spotify API to search for tracks
    const spotifyResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!spotifyResponse.ok) {
      if (spotifyResponse.status === 401) {
        // Token expired, try to refresh
        console.log('Access token expired, attempting to refresh token for search');
        const newAccessToken = await refreshAndSaveSpotifyToken(eventId, eventData.refresh_token);
        
        if (newAccessToken) {
          accessToken = newAccessToken;
          
          console.log('Successfully refreshed access token');

          // Retry the search request with new token
          const retryResponse = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
            {
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
            }
            
            return Response.json(
              { error: 'Error searching Spotify after token refresh' },
              { status: retryResponse.status }
            );
          }
          
          const retrySpotifyData = await retryResponse.json();
          
          // Extract relevant track information
          const tracks = retrySpotifyData.tracks.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            artists: item.artists.map((artist: any) => ({
              name: artist.name,
            })),
            album: {
              images: item.album.images,
            },
          }));
          
          return Response.json({ tracks });
        } else {
          // Token refresh failed
          return Response.json(
            { error: 'Unable to refresh access token' },
            { status: 401 }
          );
        }
      }
      
      return Response.json(
        { error: 'Error searching Spotify' },
        { status: spotifyResponse.status }
      );
    }
    
    const spotifyData = await spotifyResponse.json();
    
    // Extract relevant track information
    const tracks = spotifyData.tracks.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      artists: item.artists.map((artist: any) => ({
        name: artist.name,
      })),
      album: {
        images: item.album.images,
      },
    }));
    
    return Response.json({ tracks });

  } catch (error) {
    console.error('Error in Spotify search API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}