"use server";

import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { refreshAndSaveSpotifyToken, refreshSpotifyToken } from "@/lib/spotify";

export interface Event {
  id: string;
  created_at: string;
  name: string;
  manager_id: string;
  access_token: string | null;
  refresh_token: string | null;
  is_active: boolean;
  mode: 'queue' | 'playlist';
  spotify_playlist_id: string | null;
}

export interface CreateEventResult {
  success: boolean;
  error?: string;
  event?: Event;
}

// Helper function to create a Spotify playlist
async function createSpotifyPlaylist(accessToken: string, eventName: string): Promise<string | null> {
  try {
    // First, get the user ID from Spotify
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!userResponse.ok) {
      const errorData = await userResponse.json().catch(() => ({}));
      console.error('Error fetching Spotify user ID:', errorData);
      return null;
    }
    
    const userData = await userResponse.json();
    const userId = userData.id;
    
    console.log('Successfully retrieved Spotify user ID:', userId);
    
    // Now create the playlist using the user ID
    const playlistResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${eventName} [Q-DJ]`,
        description: `Playlist for Q-DJ event: ${eventName}`,
        public: false,
      }),
    });

    if (!playlistResponse.ok) {
      const errorData = await playlistResponse.json().catch(() => ({}));
      console.error('Error creating Spotify playlist:', errorData);
      console.error('Full error response body:', JSON.stringify(errorData, null, 2));
      return null;
    }

    const playlistData = await playlistResponse.json();
    return playlistData.id;
  } catch (error) {
    console.error('Unexpected error creating Spotify playlist:', error);
    return null;
  }
}

export async function createEvent(name: string, mode: 'queue' | 'playlist' = 'queue'): Promise<CreateEventResult> {
  try {
    // Get the current session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    // Get the user's ID from the session
    const userId = session.user.id;
    
    // Log token information for debugging
    console.log("Saving following tokens to Supabase:", { 
      access: !!session.accessToken, 
      refresh: !!session.refreshToken 
    });
    
    if (!userId) {
      return {
        success: false,
        error: "User ID not found in session"
      };
    }

    // Check how many active events the user already has
    const { data: existingEvents, error: countError } = await supabase
      .from('events')
      .select('id', { count: 'exact' })
      .eq('manager_id', userId)
      .eq('is_active', true);

    if (countError) {
      return {
        success: false,
        error: `Error checking existing events: ${countError.message}`
      };
    }

    // Check if the user already has 2 or more active events
    if (existingEvents && existingEvents.length >= 2) {
      return {
        success: false,
        error: "Maximum number of events (2) reached. Please deactivate an existing event before creating a new one."
      };
    }

    let playlistId: string | null = null;
    
    // If mode is playlist, create a new Spotify playlist
    if (mode === 'playlist') {
      let accessToken = session.accessToken;
      
      // If no access token or it's expired, try to refresh it
      if (!accessToken && session.refreshToken) {
        accessToken = await refreshSpotifyToken(session.refreshToken);
      }
      
      if (!accessToken) {
        return {
          success: false,
          error: "No valid Spotify access token available. Please re-authenticate."
        };
      }
      
      playlistId = await createSpotifyPlaylist(accessToken, name);
      
      if (!playlistId) {
        return {
          success: false,
          error: "Failed to create Spotify playlist. Please try again."
        };
      }
    }

    // First, ensure the user's Spotify credentials are stored in the users table
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        email: session.user.email,
        access_token: session.accessToken,
        refresh_token: session.refreshToken
      });
    
    if (userError) {
      console.error('Error upserting user credentials:', userError);
    }
    
    // Create the new event
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .insert([{ 
        name, 
        manager_id: userId,
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        is_active: true,
        mode,
        spotify_playlist_id: playlistId,
        active_host_email: session.user.email  // Set the creator as the active host
      }])
      .select()
      .single();
    
    if (eventError) {
      return {
        success: false,
        error: `Error creating event: ${eventError.message}`
      };
    }
    
    // Add the event creator as a host DJ in the event_members table
    const { error: memberError } = await supabase
      .from('event_members')
      .insert({
        event_id: eventData.id,
        user_email: session.user.email,
        role: 'host_dj'  // Creator is the host DJ
      });
    
    if (memberError) {
      console.error('Error adding event creator to event_members:', memberError);
      // Don't fail the event creation if we can't add the member
    }
    
    const data = eventData;

    return {
      success: true,
      event: data as Event
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Unexpected error: ${error.message || error}`
    };
  }
}