"use client";

import { useState, useEffect, use } from "react";
import { useParams } from "next/navigation";

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    images: { url: string; height: number; width: number }[];
  };
  uri?: string;
}

interface CurrentState {
  currentlyPlaying: SpotifyTrack | null;
  progress_ms: number;
  duration_ms: number;
  is_playing: boolean;
  queue: SpotifyTrack[];
  message?: string;
  queueError?: string | null;
}

export default function TvView() {
  const params = useParams<{ eventId: string }>();
  const { eventId } = params;
  const [state, setState] = useState<CurrentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  // Fetch current state from API
  const fetchCurrentState = async () => {
    try {
      const response = await fetch(`/api/spotify/current-state?eventId=${eventId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch current state');
      }
      
      setState(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error fetching current state');
      console.error('Error fetching current state:', err);
    }
  };

  // Initial fetch and set up polling
  useEffect(() => {
    if (!eventId) return;
    
    // Fetch immediately
    fetchCurrentState();
    
    // Set up polling every 2-3 seconds
    const interval = setInterval(fetchCurrentState, 2500);
    
    return () => {
      clearInterval(interval);
    };
  }, [eventId]);

  // Calculate progress percentage
  const progressPercentage = state?.duration_ms 
    ? (state.progress_ms / state.duration_ms) * 100 
    : 0;

  // Format time in MM:SS
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden">
      {/* Animated background with dynamic gradient */}
      <div className="absolute inset-0 opacity-30 blur-3xl scale-125">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-blue-900/30 to-indigo-900/50" />
      </div>
      
      {/* QR Code for joining event */}
      <div className="absolute top-8 right-8 z-20">
        <div className="bg-white p-4 rounded-lg shadow-2xl">
          <img 
            src={`https://quickchart.io/qr?text=${encodeURIComponent(`${window.location.origin}/event/${eventId}`)}&size=250`}
            alt={`QR Code to join event ${eventId}`}
            className="w-40 h-40"
          />
        </div>
        <p className="text-white text-center mt-2 text-sm bg-black/50 px-2 py-1 rounded">Scan to join</p>
      </div>
      
      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8 text-white">
        {/* Now Playing Section */}
        <div className="w-full max-w-6xl mb-16">
          <h2 className="text-5xl md:text-6xl font-bold text-center mb-12 text-white">NOW PLAYING</h2>
          
          {state?.message ? (
            <div className="text-center py-20">
              <p className="text-4xl text-red-400 mb-4">{state.message}</p>
              <p className="text-2xl text-gray-400">The DJ is currently offline</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-4xl text-red-400 mb-4">Error Loading Data</p>
              <p className="text-2xl text-gray-400">{error}</p>
            </div>
          ) : state?.currentlyPlaying ? (
            <div className="flex flex-col md:flex-row items-center justify-center gap-12">
              {/* Album Cover */}
              <div className="flex-shrink-0">
                <img
                  src={state.currentlyPlaying.album.images[0]?.url || '/placeholder-album.jpg'}
                  alt={state.currentlyPlaying.name}
                  className="w-80 h-80 md:w-96 md:h-96 rounded-xl shadow-2xl border-4 border-white/20"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://placehold.co/400x400/1a1a1a/FFFFFF?text=No+Image';
                  }}
                />
              </div>
              
              {/* Track Info */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <h3 className="text-5xl md:text-7xl font-bold mb-4 max-w-2xl truncate">
                  {state.currentlyPlaying.name}
                </h3>
                <p className="text-3xl md:text-4xl text-gray-300 mb-8">
                  {state.currentlyPlaying.artists.map(artist => artist.name).join(', ')}
                </p>
                
                {/* Progress Bar */}
                <div className="w-full max-w-2xl mb-4">
                  <div className="flex justify-between text-lg mb-2">
                    <span>{formatTime(state.progress_ms)}</span>
                    <span>{formatTime(state.duration_ms)}</span>
                  </div>
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
                
                {/* Status indicator */}
                <div className="flex items-center mt-4">
                  <span className={`w-4 h-4 rounded-full mr-3 ${state.is_playing ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                  <span className="text-xl">
                    {state.is_playing ? 'Playing' : 'Paused'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-4xl text-gray-500">No track is currently playing</p>
              <p className="text-2xl text-gray-600 mt-4">Start playing music on Spotify to see it here</p>
            </div>
          )}
        </div>
        
        {/* Up Next Section */}
        <div className="w-full max-w-6xl">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-white">UP NEXT</h2>
          
          {state?.queue && state.queue.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {state.queue.map((track, index) => (
                <div 
                  key={`${track.id}-${index}`} 
                  className="flex items-center bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all"
                >
                  <span className="text-2xl font-bold mr-4 text-gray-300">#{index + 1}</span>
                  <img
                    src={track.album.images[0]?.url || '/placeholder-album.jpg'}
                    alt={track.name}
                    className="w-16 h-16 rounded-lg mr-4"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://placehold.co/300x300/1a1a1a/FFFFFF?text=No+Image';
                    }}
                  />
                  <div className="min-w-0">
                    <h4 className="text-xl font-semibold truncate">{track.name}</h4>
                    <p className="text-gray-300 truncate">
                      {track.artists.map(artist => artist.name).join(', ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-2xl text-gray-500">
                {state?.message ? 'No upcoming tracks available' : 'No tracks queued next'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

