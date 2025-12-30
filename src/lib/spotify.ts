import { supabase } from './supabase';

/**
 * Refreshes the Spotify access token using the refresh token
 * @param refreshToken The refresh token to use for getting a new access token
 * @returns The new access token or null if refresh failed
 */
export async function refreshSpotifyToken(refreshToken: string): Promise<string | null> {
  try {
    // Log the first 10 characters of the refresh token for debugging
    console.log('Refresh token first 10 chars:', refreshToken?.substring(0, 10));
    
    // Log the authorization header (masked) for debugging
    const maskedAuthHeader = `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID || 'MISSING'}:${process.env.SPOTIFY_CLIENT_SECRET || 'MISSING'}`).toString('base64')}`;
    console.log('Authorization header (first 20 chars):', maskedAuthHeader.substring(0, 20) + '...');
    
    // Validate environment variables
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.error('Missing required Spotify environment variables: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
      return null;
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    console.log('Token refresh response status:', response.status);

    if (!response.ok) {
      // Get error details from response
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch (parseError) {
        // If JSON parsing fails, try to get the raw text
        const errorText = await response.text();
        errorDetails = { 
          error: 'invalid_response', 
          error_description: `Failed to parse Spotify response: ${errorText}`,
          status: response.status
        };
      }

      console.error('Token refresh failed:', errorDetails);
      console.error('Spotify error details:', {
        error: errorDetails.error,
        error_description: errorDetails.error_description,
        error_uri: errorDetails.error_uri,
        status: response.status
      });

      // Return the exact error from Spotify for better debugging
      throw new Error(`Spotify token refresh failed: ${errorDetails.error_description || errorDetails.error || 'Unknown error'}`);
    }

    const refreshData = await response.json();
    return refreshData.access_token;
  } catch (error) {
    console.error('Unexpected error during token refresh:', error);
    if (error instanceof Error) {
      throw error; // Re-throw to allow calling functions to handle the specific error
    }
    return null;
  }
}

/**
 * Refreshes the Spotify access token and updates it in the database
 * @param eventId The event ID to update the access token for
 * @param refreshToken The refresh token to use for getting a new access token
 * @returns The new access token or null if refresh failed
 */
export async function refreshAndSaveSpotifyToken(eventId: string, refreshToken: string): Promise<string | null> {
  try {
    const newAccessToken = await refreshSpotifyToken(refreshToken);
    
    if (newAccessToken) {
      // Update the access token in the database
      const { error: updateError } = await supabase
        .from('events')
        .update({ access_token: newAccessToken })
        .eq('id', eventId);
                
      if (updateError) {
        console.error('Error updating access token in database:', updateError);
        return null;
      } else {
        console.log('Successfully updated access token in database for event ID:', eventId);
      }
    }
    
    return newAccessToken;
  } catch (error) {
    console.error('Error during token refresh process:', error);
    if (error instanceof Error) {
      console.error('Detailed error message:', error.message);
    }
    return null;
  }
}

/**
 * Gets the Spotify access token for a user, refreshing it if necessary
 * @param userEmail The email of the user to get the access token for
 * @returns The access token or null if not found or refresh failed
 */
export async function getSpotifyAccessToken(userEmail: string): Promise<string | null> {
  try {
    // Get the user's Spotify credentials from the users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('access_token, refresh_token')
      .eq('email', userEmail)
      .single();

    if (userError || !userData) {
      console.error('Error getting user Spotify credentials:', userError);
      return null;
    }

    // If access token exists and is not expired, return it
    // For now, we'll assume we need to refresh every time for simplicity
    if (userData.refresh_token) {
      // Refresh the token using the refresh token
      const newAccessToken = await refreshSpotifyToken(userData.refresh_token);
      
      if (newAccessToken) {
        // Update the database with the new access token
        const { error: updateError } = await supabase
          .from('users')
          .update({ access_token: newAccessToken })
          .eq('email', userEmail);
          
        if (updateError) {
          console.error('Error updating access token in database:', updateError);
        }
        
        return newAccessToken;
      }
    }
    
    // If no refresh token or refresh failed, return the stored access token
    return userData.access_token;
  } catch (error) {
    console.error('Error getting Spotify access token:', error);
    return null;
  }
}