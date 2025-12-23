import { supabase } from './supabase';

/**
 * Refreshes the Spotify access token using the refresh token
 * @param refreshToken The refresh token to use for getting a new access token
 * @returns The new access token or null if refresh failed
 */
export async function refreshSpotifyToken(refreshToken: string): Promise<string | null> {
  try {
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

      return null;
    }

    const refreshData = await response.json();
    return refreshData.access_token;
  } catch (error) {
    console.error('Unexpected error during token refresh:', error);
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
}