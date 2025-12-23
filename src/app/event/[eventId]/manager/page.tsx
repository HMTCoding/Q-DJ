"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    images: { url: string; height: number; width: number }[];
  };
  uri: string;
}

export default function ManagerView() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: session, status } = useSession();
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);

  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({ show: false, message: "", type: "success" });
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const queuePollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Check if the user is the event manager
  useEffect(() => {
    const checkEventAccess = async () => {
      if (!session?.user?.id || !eventId) return;

      try {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .eq("id", eventId)
          .eq("manager_id", session.user.id)
          .single();

        if (error || !data) {
          setError("You don't have access to this event");
        } else {
          setEvent(data);
        }
      } catch (err) {
        setError("Error checking event access");
      }
    };

    if (status === "authenticated") {
      checkEventAccess();
    }
  }, [session, eventId, status]);

  // Poll for current playing track
  useEffect(() => {
    if (!event || !session?.accessToken) return;

    const fetchCurrentlyPlaying = async () => {
      try {
        const response = await fetch(
          "https://api.spotify.com/v1/me/player/currently-playing",
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
            },
          }
        );

        if (response.status === 204) {
          // No content - nothing is playing
          setCurrentTrack(null);
          return;
        }

        if (!response.ok) {
          if (response.status === 401) {
            setError("Access token expired. Please re-authenticate.");
          } else if (response.status === 404) {
            // No active device
            setCurrentTrack(null);
          } else {
            setError("Error fetching currently playing track");
          }
          return;
        }

        const data = await response.json();
        if (data.item) {
          setCurrentTrack({
            id: data.item.id,
            name: data.item.name,
            artists: data.item.artists.map((artist: any) => ({
              name: artist.name,
            })),
            album: {
              images: data.item.album.images,
            },
            uri: data.item.uri,
          });
        } else {
          setCurrentTrack(null);
        }
      } catch (err) {
        setError("Error fetching currently playing track");
      }
    };

    // Fetch immediately
    fetchCurrentlyPlaying();

    // Set up polling every 5 seconds
    pollingInterval.current = setInterval(fetchCurrentlyPlaying, 5000);

    setIsPolling(true);

    // Cleanup
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      setIsPolling(false);
    };
  }, [event, session?.accessToken]);

  // Function to fetch the current queue
  const fetchQueue = async () => {
    if (!eventId) return;

    setQueueLoading(true);
    setQueueError(null);

    try {
      const response = await fetch(`/api/spotify/get-queue?eventId=${eventId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch queue");
      }

      setQueue(data.queue || []);
      // If there's a message (like 'DJ is currently offline'), set it as an error
      if (data.message) {
        setQueueError(data.message);
      } else {
        setQueueError(null); // Clear any previous error
      }
    } catch (err: any) {
      setQueueError(err.message || "Error fetching queue");
      setQueue([]); // Clear queue on error
    } finally {
      setQueueLoading(false);
    }
  };

  // Poll for queue updates every 15 seconds
  useEffect(() => {
    if (!event) return;

    // Fetch queue immediately
    fetchQueue();

    // Set up polling every 15 seconds
    queuePollingInterval.current = setInterval(fetchQueue, 15000);

    // Cleanup
    return () => {
      if (queuePollingInterval.current) {
        clearInterval(queuePollingInterval.current);
      }
    };
  }, [event]);

  // Function to skip the next track
  const skipNextTrack = async () => {
    if (!eventId) return;

    try {
      const response = await fetch("/api/spotify/remove-track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: eventId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setToast({
          show: true,
          message: data.message || "Next track skipped successfully!",
          type: "success",
        });

        // Auto-hide toast after 3 seconds and refresh queue
        setTimeout(() => {
          setToast((prev) => ({ ...prev, show: false }));
          fetchQueue(); // Refresh the queue after successful skip
        }, 3000);
      } else {
        setToast({
          show: true,
          message: data.error || "Failed to skip track",
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
        message: "An error occurred while skipping the track",
        type: "error",
      });

      // Auto-hide toast after 3 seconds
      setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 3000);
    }
  };

  const copyToClipboard = () => {
    const memberUrl = `${window.location.origin}/event/${eventId}`;
    navigator.clipboard.writeText(memberUrl).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 font-sans">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-xl text-gray-300">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 font-sans">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center p-8 bg-gray-800/50 rounded-xl border border-gray-700 max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">
              Access Denied
            </h2>
            <p className="text-gray-300 mb-6">
              Please log in to access the DJ dashboard
            </p>
            <a
              href="/"
              className="inline-block py-2 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition"
            >
              Go to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (error && error.includes("don't have access")) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 font-sans">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center p-8 bg-gray-800/50 rounded-xl border border-gray-700 max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">
              Access Denied
            </h2>
            <p className="text-gray-300 mb-6">{error}</p>
            <a
              href="/dashboard"
              className="inline-block py-2 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 font-sans">
      <Header />
      <div className="p-4 md:p-8 pt-20 max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            DJ Dashboard
          </h1>
          <p className="text-xl text-gray-300">
            Manage your event: {event?.name || eventId}
          </p>
        </header>

        {/* Now Playing Section */}
        <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-sm mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Now Playing</h2>
            <div className="flex items-center">
              <span
                className={`mr-2 ${
                  isPolling ? "text-green-500" : "text-red-500"
                }`}
              >
                ●
              </span>
              <span className="text-gray-400 text-sm">
                {isPolling ? "Live" : "Offline"}
              </span>
            </div>
          </div>

          {error && !error.includes("don't have access") && (
            <div className="mb-4 p-3 bg-red-900/50 text-red-200 rounded-lg border border-red-700">
              {error}
            </div>
          )}

          {currentTrack ? (
            <div className="flex items-center p-4 bg-gray-700/30 rounded-lg border border-gray-600">
              {currentTrack.album.images[0] && (
                <img
                  src={currentTrack.album.images[0].url}
                  alt={currentTrack.name}
                  className="w-20 h-20 rounded mr-6"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-semibold text-white truncate">
                  {currentTrack.name}
                </h3>
                <p className="text-gray-400 truncate">
                  {currentTrack.artists.map((artist) => artist.name).join(", ")}
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={skipNextTrack}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  Skip Next
                </button>
                <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition">
                  Pause
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">
                No track is currently playing
              </p>
              <p className="text-gray-500 mt-2">
                Start playing music on your Spotify to see it here
              </p>
            </div>
          )}
        </div>

        {/* Queue Section */}
        <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Queue</h2>
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
                  <p>No tracks in queue</p>
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

        {/* Share Link Section */}
        <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-4">Share Event</h2>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="flex">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/event/${eventId}`}
                  className="flex-1 p-3 rounded-l-lg bg-gray-700/50 border border-gray-600 text-white"
                />
                <button
                  onClick={copyToClipboard}
                  className={`px-6 rounded-r-lg font-medium transition ${
                    isCopied
                      ? "bg-green-600 text-white"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {isCopied ? "Copied!" : "Copy Link"}
                </button>
              </div>
              <p className="text-gray-400 mt-3">
                Share this link with your guests so they can request songs
              </p>
            </div>

            {/* QR Code for Event */}
            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-3 rounded-lg">
                <img
                  src={`https://quickchart.io/qr?text=${encodeURIComponent(
                    `${window.location.origin}/event/${eventId}`
                  )}&size=200`}
                  alt={`QR Code for event ${eventId}`}
                  className="w-32 h-32"
                />
              </div>
              <p className="text-gray-400 mt-2 text-sm">Scan to join event</p>
            </div>
          </div>
        </div>

        {/* Second Share Link Section */}
        <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-sm mt-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            Share Event (TV View)
          </h2>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="flex">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/event/${eventId}/tv`}
                  className="flex-1 p-3 rounded-l-lg bg-gray-700/50 border border-gray-600 text-white"
                />
                <button
                  onClick={() => {
                    const tvUrl = `${window.location.origin}/event/${eventId}/tv`;
                    navigator.clipboard.writeText(tvUrl).then(() => {
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    });
                  }}
                  className={`px-6 rounded-r-lg font-medium transition ${
                    isCopied
                      ? "bg-green-600 text-white"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {isCopied ? "Copied!" : "Copy Link"}
                </button>
              </div>
              <p className="text-gray-400 mt-3">
                Share this TV view link with displays at your event
              </p>
            </div>

            {/* QR Code for TV View */}
            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-3 rounded-lg">
                <img
                  src={`https://quickchart.io/qr?text=${encodeURIComponent(
                    `${window.location.origin}/event/${eventId}/tv`
                  )}&size=200`}
                  alt={`QR Code for TV view of event ${eventId}`}
                  className="w-32 h-32"
                />
              </div>
              <p className="text-gray-400 mt-2 text-sm">Scan for TV view</p>
            </div>
          </div>
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
