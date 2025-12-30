"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import {
  FaSpotify,
  FaCheck,
  FaExclamationTriangle,
  FaClock,
} from "react-icons/fa";

export default function InvitePage() {
  const router = useRouter();
  const { inviteCode } = useParams();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);

  useEffect(() => {
    if (!inviteCode) {
      setError("No invite code provided");
      setLoading(false);
      return;
    }

    const validateInvite = async () => {
      try {
        // Check if invite code exists and is not expired
        const { data, error } = await supabase
          .from("event_invites")
          .select(
            `
            *,
            events!inner (
              id,
              name,
              mode,
              playlist_id
            )
          `
          )
          .eq("invite_code", inviteCode)
          .gte("expires_at", new Date().toISOString())
          .single();

        if (error) {
          setError("Invalid or expired invite code");
          setLoading(false);
          return;
        }

        setInviteData(data);
        setLoading(false);

        // If user is already logged in, proceed with joining
        if (status === "authenticated" && session?.user?.email) {
          await joinEvent(
            data.event_id,
            data.events.playlist_id,
            session.user.email
          );
        }
      } catch (err) {
        setError("An error occurred while validating the invite");
        console.error(err);
        setLoading(false);
      }
    };

    validateInvite();
  }, [inviteCode, session, status]);

  const joinEvent = async (
    eventId: string,
    playlistId: string | null,
    userEmail: string
  ) => {
    try {
      setLoading(true);

      // Check if user is already a member
      const { data: existingMember, error: existingError } = await supabase
        .from("event_members")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_email", userEmail)
        .single();

      if (existingMember) {
        // User is already a member, redirect to event
        router.push(`/event/${eventId}/manager`);
        return;
      }

      // Add user to event members
      const { error: insertError } = await supabase
        .from("event_members")
        .insert({
          event_id: eventId,
          user_email: userEmail,
          role: "sub_dj",
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Ensure the user's Spotify credentials are stored in the users table
      // Get the current session to access the user's tokens
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (currentSession?.user) {
        // Try to get user's provider-specific data
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id")
          .eq("id", currentSession.user.id)
          .single();

        if (userData) {
          // Update the user's tokens if they already exist in the users table
          const { error: updateError } = await supabase
            .from("users")
            .update({
              email: userEmail,
            })
            .eq("id", currentSession.user.id);

          if (updateError) {
            console.error("Error updating user email:", updateError);
          }
        }
      }

      // If playlist mode and playlist ID exists, make the user follow the playlist
      if (inviteData?.events?.mode === "playlist" && playlistId) {
        await followPlaylist(playlistId);
      }

      // Set the active host to the first member if none is set
      const { data: eventMembers } = await supabase
        .from("event_members")
        .select("user_email")
        .eq("event_id", eventId)
        .order("joined_at", { ascending: true })
        .limit(1);

      if (
        eventMembers &&
        eventMembers.length > 0 &&
        !inviteData.events.active_host_email
      ) {
        const { error: updateError } = await supabase
          .from("events")
          .update({ active_host_email: eventMembers[0].user_email })
          .eq("id", eventId);

        if (updateError) {
          console.error("Error setting active host:", updateError);
        }
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/event/${eventId}/manager`);
      }, 2000);
    } catch (err) {
      setError("Failed to join event: " + (err as Error).message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const followPlaylist = async (playlistId: string) => {
    try {
      // Call our API to make the user follow the playlist
      const response = await fetch("/api/spotify/follow-playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playlistId }),
      });

      if (!response.ok) {
        console.error("Failed to follow playlist");
      }
    } catch (err) {
      console.error("Error following playlist:", err);
    }
  };

  const handleSpotifyLogin = () => {
    // Redirect to Spotify login
    window.location.href = "/api/auth/signin?callbackUrl=/invite/" + inviteCode;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-black to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-white">Validating invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-black to-purple-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <FaExclamationTriangle className="text-red-500 text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-center text-red-400 mb-4">
            Error
          </h2>
          <p className="text-gray-200 text-center mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-black to-purple-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full mx-4 text-center">
          <div className="flex items-center justify-center mb-4">
            <FaCheck className="text-green-500 text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-green-400 mb-2">Success!</h2>
          <p className="text-gray-200 mb-4">
            You've joined the event successfully.
          </p>
          <p className="text-gray-400 text-sm">
            Redirecting to event dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-black to-purple-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-green-400 mb-2">
            Q-DJ Invite
          </h1>
          <p className="text-gray-300">
            Join event: {inviteData?.events?.name}
          </p>
        </div>

        {status === "authenticated" && session?.user?.email ? (
          <div className="space-y-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <p className="text-gray-200">Signed in as:</p>
              <p className="text-green-400 font-semibold">
                {session.user.email}
              </p>
            </div>
            <button
              onClick={() =>
                session.user?.email &&
                joinEvent(
                  inviteData.event_id,
                  inviteData.events.playlist_id,
                  session.user.email
                )
              }
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
            >
              <FaSpotify className="mr-2" />
              Join Event
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center text-gray-300 mb-2">
                <FaClock className="mr-2 text-yellow-400" />
                <span>
                  Expires:{" "}
                  {inviteData
                    ? new Date(inviteData.expires_at).toLocaleString()
                    : ""}
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                This invite is valid for 1 hour from creation
              </p>
            </div>
            <button
              onClick={handleSpotifyLogin}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
            >
              <FaSpotify className="mr-2" />
              Sign in with Spotify
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-gray-200 text-sm"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
