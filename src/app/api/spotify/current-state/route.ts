import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { refreshAndSaveSpotifyToken } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    console.log('Received eventId for current state:', eventId);
    
    if (!eventId) {
      console.log('No eventId provided in request');
      return Response.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Fetch event data to get manager's access token and mode
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('access_token, refresh_token, mode, spotify_playlist_id')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      console.log('Event not found in Supabase:', eventId, 'Error:', eventError);
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    
    console.log('Found event in Supabase for ID:', eventId);

    let accessToken = eventData.access_token;

    // Log before making Spotify API call
    console.log('Making Spotify API calls with access token (first 10 chars):', accessToken?.substring(0, 10));

    // Call Spotify API to get currently playing track
    const currentlyPlayingResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let currentlyPlayingData = null;
    let currentlyPlaying = null;
    let progress_ms = 0;
    let duration_ms = 0;
    let is_playing = false;
    let djOfflineMessage = null;

    if (currentlyPlayingResponse.ok) {
      currentlyPlayingData = await currentlyPlayingResponse.json();
      
      // Check if there's an active device
      const playerResponse = await fetch('https://api.spotify.com/v1/me/player', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      
      if (playerResponse.ok) {
        const playerData = await playerResponse.json();
        if (!playerData.device || !playerData.device.is_active) {
          djOfflineMessage = 'DJ is currently offline or no active device found';
        }
      }
      
      if (currentlyPlayingData.item) {
        currentlyPlaying = {
          id: currentlyPlayingData.item.id,
          name: currentlyPlayingData.item.name,
          artists: currentlyPlayingData.item.artists.map((artist: any) => ({ name: artist.name })),
          album: {
            images: currentlyPlayingData.item.album.images,
          },
          uri: currentlyPlayingData.item.uri,
        };
        progress_ms = currentlyPlayingData.progress_ms || 0;
        duration_ms = currentlyPlayingData.item.duration_ms || 0;
        is_playing = currentlyPlayingData.is_playing || false;
      }
    } else if (currentlyPlayingResponse.status === 401) {
      // Token expired, try to refresh
      console.log('Access token expired, attempting to refresh token for currently playing');
      const newAccessToken = await refreshAndSaveSpotifyToken(eventId, eventData.refresh_token);
      
      if (newAccessToken) {
        accessToken = newAccessToken;
        
        console.log('Successfully refreshed access token for currently playing');

        // Retry the currently playing request with new token
        const retryResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (retryResponse.ok) {
          currentlyPlayingData = await retryResponse.json();
          
          // Check if there's an active device
          const playerResponse = await fetch('https://api.spotify.com/v1/me/player', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          
          if (playerResponse.ok) {
            const playerData = await playerResponse.json();
            if (!playerData.device || !playerData.device.is_active) {
              djOfflineMessage = 'DJ is currently offline or no active device found';
            }
          }
          
          if (currentlyPlayingData.item) {
            currentlyPlaying = {
              id: currentlyPlayingData.item.id,
              name: currentlyPlayingData.item.name,
              artists: currentlyPlayingData.item.artists.map((artist: any) => ({ name: artist.name })),
              album: {
                images: currentlyPlayingData.item.album.images,
              },
              uri: currentlyPlayingData.item.uri,
            };
            progress_ms = currentlyPlayingData.progress_ms || 0;
            duration_ms = currentlyPlayingData.item.duration_ms || 0;
            is_playing = currentlyPlayingData.is_playing || false;
          }
        } else {
          const errorData = await retryResponse.json();
          if (retryResponse.status === 404) {
            djOfflineMessage = 'DJ is currently offline or no active device found';
          }
        }
      } else {
        // Token refresh failed
        console.error('Token refresh failed for event ID:', eventId);
        return Response.json({ error: 'Failed to refresh access token for currently playing', message: 'Unable to refresh Spotify access token' }, { status: 401 });
      }
    } else if (currentlyPlayingResponse.status === 404) {
      djOfflineMessage = 'DJ is currently offline or no active device found';
    }

    let queue = [];
    let queueError = null;
    
    if (eventData.mode === 'playlist') {
      // For playlist mode, fetch tracks from the specific playlist
      if (!eventData.spotify_playlist_id) {
        queueError = 'No playlist ID found for this event';
      } else {
        // Step A: Get the currently playing track
        let currentlyPlayingTrackId = null;
        try {
          const currentlyPlayingResponse = await fetch(
            'https://api.spotify.com/v1/me/player/currently-playing',
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
          
          if (currentlyPlayingResponse.ok) {
            const currentlyPlayingData = await currentlyPlayingResponse.json();
            if (currentlyPlayingData && currentlyPlayingData.item) {
              currentlyPlayingTrackId = currentlyPlayingData.item.id;
            }
          } else if (currentlyPlayingResponse.status === 401) {
            // Token expired, try to refresh
            console.log('Access token expired, attempting to refresh token for currently playing');
            const newAccessToken = await refreshAndSaveSpotifyToken(eventId, eventData.refresh_token);
            
            if (newAccessToken) {
              accessToken = newAccessToken;
              
              // Retry the currently playing request with new token
              const retryResponse = await fetch(
                'https://api.spotify.com/v1/me/player/currently-playing',
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              );
              
              if (retryResponse.ok) {
                const currentlyPlayingData = await retryResponse.json();
                if (currentlyPlayingData && currentlyPlayingData.item) {
                  currentlyPlayingTrackId = currentlyPlayingData.item.id;
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching currently playing track:', error);
        }
        
        // Get all tracks from the playlist
        const playlistResponse = await fetch(
          `https://api.spotify.com/v1/playlists/${eventData.spotify_playlist_id}/tracks?limit=50`, // Get more tracks to have a larger pool
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (playlistResponse.ok) {
          const playlistData = await playlistResponse.json();
          
          // Step B & C: Filter tracks to show only those after the currently playing track
          const allTracks = playlistData.items.map((item: any) => item.track).filter((track: any) => track !== null);
          
          if (currentlyPlayingTrackId) {
            // Find the index of the currently playing track
            const currentIndex = allTracks.findIndex((track: any) => track.id === currentlyPlayingTrackId);
            
            if (currentIndex !== -1) {
              // Step C: Return tracks that come after the currently playing track
              queue = allTracks.slice(currentIndex + 1, currentIndex + 3); // Next 2 tracks for TV view
            } else {
              // Fallback: if current track not found in playlist, return first few tracks
              queue = allTracks.slice(0, 2);
            }
          } else {
            // Fallback: if nothing is currently playing, return first few tracks
            queue = allTracks.slice(0, 2);
          }
          
          // Map the tracks to the required format
          queue = queue.map((track: any) => ({
            id: track.id,
            name: track.name,
            artists: track.artists.map((artist: any) => ({ name: artist.name })),
            album: {
              images: track.album.images,
            },
            uri: track.uri,
          }));
        } else if (playlistResponse.status === 401) {
          // Token expired, try to refresh
          if (!djOfflineMessage) { // Only refresh if we haven't already done so
            const newAccessToken = await refreshAndSaveSpotifyToken(eventId, eventData.refresh_token);
            
            if (newAccessToken) {
              accessToken = newAccessToken;
              
              console.log('Successfully refreshed access token for playlist tracks');

              // Retry the playlist tracks request with new token
              const retryResponse = await fetch(
                `https://api.spotify.com/v1/playlists/${eventData.spotify_playlist_id}/tracks?limit=50`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              );

              if (retryResponse.ok) {
                const playlistData = await retryResponse.json();
                
                // Step B & C: Filter tracks to show only those after the currently playing track
                const allTracks = playlistData.items.map((item: any) => item.track).filter((track: any) => track !== null);
                
                let upcomingTracks = [];
                if (currentlyPlayingTrackId) {
                  // Find the index of the currently playing track
                  const currentIndex = allTracks.findIndex((track: any) => track.id === currentlyPlayingTrackId);
                  
                  if (currentIndex !== -1) {
                    // Step C: Return tracks that come after the currently playing track
                    upcomingTracks = allTracks.slice(currentIndex + 1, currentIndex + 3); // Next 2 tracks for TV view
                  } else {
                    // Fallback: if current track not found in playlist, return first few tracks
                    upcomingTracks = allTracks.slice(0, 2);
                  }
                } else {
                  // Fallback: if nothing is currently playing, return first few tracks
                  upcomingTracks = allTracks.slice(0, 2);
                }
                
                // Map the tracks to the required format
                queue = upcomingTracks.map((track: any) => ({
                  id: track.id,
                  name: track.name,
                  artists: track.artists.map((artist: any) => ({ name: artist.name })),
                  album: {
                    images: track.album.images,
                  },
                  uri: track.uri,
                }));
              } else {
                const errorData = await retryResponse.json();
                queueError = errorData.error?.message || 'Failed to fetch playlist tracks after token refresh';
              }
            } else {
              // Token refresh failed
              console.error('Token refresh failed for event ID:', eventId);
              queueError = 'Failed to refresh access token for playlist tracks';
            }
          }
        } else {
          const errorData = await playlistResponse.json();
          queueError = errorData.error?.message || 'Failed to fetch playlist tracks';
        }
      }
    } else {
      // For queue mode, fetch tracks from the player queue
      const queueResponse = await fetch('https://api.spotify.com/v1/me/player/queue', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (queueResponse.ok) {
        const queueData = await queueResponse.json();
        // Return only the next 2 tracks for the TV view
        queue = (queueData.queue || []).slice(0, 2).map((track: any) => ({
          id: track.id,
          name: track.name,
          artists: track.artists.map((artist: any) => ({ name: artist.name })),
          album: {
            images: track.album.images,
          },
          uri: track.uri,
        }));
      } else if (queueResponse.status === 401) {
        // Token expired, try to refresh (if not already refreshed)
        if (!djOfflineMessage) { // Only refresh if we haven't already done so
          const newAccessToken = await refreshAndSaveSpotifyToken(eventId, eventData.refresh_token);
          
          if (newAccessToken) {
            accessToken = newAccessToken;
            
            console.log('Successfully refreshed access token for queue');

            // Retry the queue request with new token
            const retryResponse = await fetch('https://api.spotify.com/v1/me/player/queue', {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

            if (retryResponse.ok) {
              const queueData = await retryResponse.json();
              // Return only the next 2 tracks for the TV view
              queue = (queueData.queue || []).slice(0, 2).map((track: any) => ({
                id: track.id,
                name: track.name,
                artists: track.artists.map((artist: any) => ({ name: artist.name })),
                album: {
                  images: track.album.images,
                },
                uri: track.uri,
              }));
            } else {
              const errorData = await retryResponse.json();
              if (retryResponse.status === 404) {
                djOfflineMessage = 'DJ is currently offline or no active device found';
              } else {
                queueError = errorData.error?.message || 'Failed to fetch queue after token refresh';
              }
            }
          } else {
            // Token refresh failed
            console.error('Token refresh failed for event ID:', eventId);
            queueError = 'Failed to refresh access token for queue';
          }
        }
      } else if (queueResponse.status === 404) {
        djOfflineMessage = 'DJ is currently offline or no active device found';
      } else {
        const errorData = await queueResponse.json();
        queueError = errorData.error?.message || 'Failed to fetch queue';
      }
    }

    // If we have a DJ offline message, return it
    if (djOfflineMessage) {
      return Response.json({ 
        currentlyPlaying: null,
        progress_ms: 0,
        duration_ms: 0,
        is_playing: false,
        queue: [],
        message: djOfflineMessage,
        mode: eventData.mode // Include the mode in the response
      });
    }

    // Return combined data
    return Response.json({
      currentlyPlaying,
      progress_ms,
      duration_ms,
      is_playing,
      queue,
      queueError: queueError || null,
      mode: eventData.mode // Include the mode in the response
    });
  } catch (error) {
    console.error('Error fetching current state:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}