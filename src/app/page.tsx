"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { FaSpotify } from "react-icons/fa";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 font-sans">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center p-8 bg-black/30 backdrop-blur-lg rounded-2xl border border-gray-800 shadow-2xl shadow-purple-900/20">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="mb-6">
            <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
              Q-DJ
            </h1>
            <p className="text-xl text-gray-300 mb-8">Your Ultimate DJ Experience</p>
          </div>
          
          <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 w-full max-w-md">
            {status === "loading" ? (
              <div className="text-center py-8">
                <p className="text-gray-400">Loading...</p>
              </div>
            ) : session ? (
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  {session.user?.image && (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      width={64}
                      height={64}
                      className="rounded-full border-2 border-emerald-500"
                    />
                  )}
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Eingeloggt als <span className="text-emerald-400">{session.user?.name}</span>
                </h2>
                <p className="text-gray-400 mb-6">Spotify-Konto verbunden</p>
                
                <button
                  onClick={() => signOut()}
                  className="w-full py-3 px-6 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition duration-200 transform hover:scale-[1.02]"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-white mb-6">Spotify Login</h2>
                <button
                  onClick={() => signIn("spotify")}
                  className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center justify-center gap-3 transition duration-200 transform hover:scale-[1.02]"
                >
                  <FaSpotify className="text-xl" />
                  <span>Login mit Spotify</span>
                </button>
                <p className="text-gray-400 mt-4 text-sm">
                  Verbinde deinen Spotify Account um deine DJ-Funktionen zu nutzen
                </p>
              </div>
            )}
          </div>
          
          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>Q-DJ - Dein personalisierter DJ-Assistent</p>
          </div>
        </div>
      </main>
    </div>
  );
}
