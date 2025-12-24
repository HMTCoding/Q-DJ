"use client";

import { useState, useEffect, useMemo, use } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Footer from "@/components/Footer";

interface Event {
  id: string;
  name: string;
  manager_id: string;
  is_active: boolean;
  mode: "queue" | "playlist";
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    images: { url: string; height: number; width: number }[];
  };
  uri?: string;
}

export default function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingToQueue, setAddingToQueue] = useState<Record<string, boolean>>(
    {}
  );
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({ show: false, message: "", type: "success" });
  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Fetch event details
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .eq("id", eventId)
          .eq("is_active", true)
          .single();

        if (error) {
          setError("Event not found or inactive");
        } else {
          setEvent(data as Event);
        }
      } catch (err) {
        setError("Error loading event");
      }
    };

    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  // Debounced search function
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchQuery.trim() && event) {
        setLoading(true);
        setError(null);

        try {
          const response = await fetch("/api/spotify/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: searchQuery.trim(),
              eventId: eventId,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Search failed");
          }

          setSearchResults(data.tracks || []);
        } catch (err: any) {
          setError(err.message || "Error searching for tracks");
          setSearchResults([]);
        } finally {
          setLoading(false);
        }
      } else if (!searchQuery.trim()) {
        setSearchResults([]);
      }
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, event, eventId]);

  // Function to add a track to the queue
  const addToQueue = async (track: SpotifyTrack) => {
    if (!event) return;

    setAddingToQueue((prev) => ({ ...prev, [track.id]: true }));

    try {
      const response = await fetch("/api/spotify/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uri: `spotify:track:${track.id}`,
          eventId: eventId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setToast({
          show: true,
          message: "Track added to queue successfully!",
          type: "success",
        });

        // Auto-hide toast after 3 seconds and refresh queue
        setTimeout(() => {
          setToast((prev) => ({ ...prev, show: false }));
          fetchQueue(); // Refresh the queue after successful addition
        }, 3000);
      } else {
        setToast({
          show: true,
          message: data.error || "Failed to add track to queue",
          type: "error",
        });

        // Auto-hide toast after 3 seconds
        setTimeout(() => {
          setToast((prev) => ({ ...prev, show: false }));
        }, 3000);
      }
    } catch (err) {
      setToast({
        show: true,
        message: "An error occurred while adding the track",
        type: "error",
      });

      // Auto-hide toast after 3 seconds
      setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 3000);
    } finally {
      setAddingToQueue((prev) => ({ ...prev, [track.id]: false }));
    }
  };

  // Function to fetch the current queue or playlist tracks
  const fetchQueue = async () => {
    if (!eventId || !event) return;

    setQueueLoading(true);
    setQueueError(null);

    try {
      let response;

      if (event.mode === "playlist") {
        // Fetch tracks from the playlist
        response = await fetch(
          `/api/spotify/get-playlist-tracks?eventId=${eventId}`
        );
      } else {
        // Fetch tracks from the queue
        response = await fetch(`/api/spotify/get-queue?eventId=${eventId}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            (event.mode === "playlist"
              ? "Failed to fetch playlist tracks"
              : "Failed to fetch queue")
        );
      }

      // Set the queue based on the mode
      if (event.mode === "playlist") {
        setQueue(data.tracks || []);
      } else {
        setQueue(data.queue || []);
      }

      // If there's a message (like 'DJ is currently offline'), set it as an error
      if (data.message) {
        setQueueError(data.message);
      } else {
        setQueueError(null); // Clear any previous error
      }
    } catch (err: any) {
      setQueueError(
        err.message ||
          (event.mode === "playlist"
            ? "Error fetching playlist tracks"
            : "Error fetching queue")
      );
      setQueue([]); // Clear queue on error
    } finally {
      setQueueLoading(false);
    }
  };

  // Fetch queue when component mounts and after adding a song
  useEffect(() => {
    if (eventId) {
      fetchQueue();
    }
  }, [eventId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            {event ? event.name : "Event"}
          </h1>
          <p className="text-gray-400">
            Search and request songs for this event
          </p>
        </header>

        {/* Search Section */}
        <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-sm mb-8">
          <div className="mb-6">
            <label htmlFor="search" className="block text-gray-300 mb-2">
              Search for songs
            </label>
            <input
              type="text"
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for songs, artists..."
              className="w-full p-4 rounded-lg bg-gray-700/50 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 text-red-200 rounded-lg border border-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          )}

          {/* Search Results */}
          {!loading && searchResults.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Search Results
              </h2>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {searchResults.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center p-3 bg-gray-700/30 rounded-lg border border-gray-600 hover:bg-gray-700/50 transition"
                  >
                    {track.album.images[0] && (
                      <img
                        src={track.album.images[0].url}
                        alt={track.name}
                        className="w-12 h-12 rounded mr-4"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">
                        {track.name}
                      </h3>
                      <p className="text-gray-400 text-sm truncate">
                        {track.artists.map((artist) => artist.name).join(", ")}
                      </p>
                    </div>
                    <button
                      onClick={() => addToQueue(track)}
                      disabled={addingToQueue[track.id]}
                      className="ml-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50 flex items-center"
                    >
                      {addingToQueue[track.id] ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Adding...
                        </>
                      ) : event?.mode === "playlist" ? (
                        "Zur Playlist hinzufügen"
                      ) : (
                        "Zur Warteschlange hinzufügen"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && searchQuery && searchResults.length === 0 && !error && (
            <div className="text-center py-8 text-gray-500">
              No tracks found for "{searchQuery}"
            </div>
          )}
        </div>

        {/* Queue Section */}
        <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">
              {event?.mode === "playlist" ? "Playlist" : "Warteschlange"}
            </h2>
            <div className="flex items-center space-x-2">
              {queueLoading ? (
                <div className="flex items-center text-emerald-400 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-emerald-400 mr-2"></div>
                  Loading...
                </div>
              ) : (
                <button
                  onClick={fetchQueue}
                  className="flex items-center text-gray-400 hover:text-white text-sm transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
              )}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-900 text-emerald-200 border border-emerald-700">
                <span className="w-2 h-2 mr-1 bg-emerald-400 rounded-full animate-pulse"></span>
                Live
              </span>
            </div>
          </div>

          {queueError && (
            <div className="mb-4 p-3 bg-red-900/50 text-red-200 rounded-lg border border-red-700 text-sm">
              {queueError}
            </div>
          )}

          {queue.length === 0 && !queueLoading && (
            <div className="text-center py-8 text-gray-500">
              {queueError && queueError.includes("offline") ? (
                <>
                  <p className="text-red-400">DJ ist gerade offline</p>
                  <p className="text-sm mt-1">
                    The DJ is currently not connected to Spotify
                  </p>
                </>
              ) : (
                <>
                  <p>
                    No tracks{" "}
                    {event?.mode === "playlist" ? "in playlist" : "in queue"}
                  </p>
                  <p className="text-sm mt-1">
                    The DJ hasn't added any tracks yet
                  </p>
                </>
              )}
            </div>
          )}

          {queue.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {queue.map((track, index) => (
                <div
                  key={`${track.id}-${index}`} // Using index as well to handle potential duplicate IDs
                  className="flex items-center p-3 bg-gray-700/30 rounded-lg border border-gray-600 transition"
                >
                  {track.album.images[0] && (
                    <img
                      src={track.album.images[0].url}
                      alt={track.name}
                      className="w-10 h-10 rounded mr-3"
                    />
                  )}
                  <div className="flex-1 min-w-0 ml-2">
                    <h3 className="text-white font-medium truncate">
                      {track.name}
                    </h3>
                    <p className="text-gray-400 text-sm truncate">
                      {track.artists.map((artist) => artist.name).join(", ")}
                    </p>
                  </div>
                  <span className="text-gray-500 text-sm font-medium mr-3">
                    #{index + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event Info */}
        <div className="text-center text-gray-500 text-sm">
          <p>Event ID: {eventId}</p>
          <p className="mt-2">
            Share this link with guests to let them search for songs
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white max-w-xs z-50 transition-opacity duration-300 ${
            toast.type === "success"
              ? "bg-green-600 border border-green-500"
              : "bg-red-600 border border-red-500"
          }`}
        >
          <div className="flex items-center">
            {toast.type === "success" ? (
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
            ) : (
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
