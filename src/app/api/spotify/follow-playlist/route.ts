import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { supabase } from '@/lib/supabase';
import { getSpotifyAccessToken } from '@/lib/spotify';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { playlistId } = await request.json();
    
    if (!playlistId) {
      return Response.json({ error: 'Playlist ID is required' }, { status: 400 });
    }

    // Get the user's Spotify access token
    const accessToken = await getSpotifyAccessToken(session.user.email);
    
    if (!accessToken) {
      return Response.json({ error: 'No Spotify access token found' }, { status: 400 });
    }

    // Make the authenticated user follow the playlist
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/followers`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Spotify API error:', errorData);
      return Response.json({ error: 'Failed to follow playlist', details: errorData }, { status: response.status });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error following playlist:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}