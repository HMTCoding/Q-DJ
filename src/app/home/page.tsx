"use client";

import { signIn, useSession } from "next-auth/react";
import { FaSpotify, FaUsers, FaMusic, FaCrown, FaGithub } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function HomePage() {
  const { data: session, status } = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 font-sans">
      <Header />

      {/* Closed Beta Notice */}
      <div className="container mx-auto px-4 py-4">
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-center py-3 px-4 rounded-lg font-bold text-lg">
          Wir sind aktuell in der Closed Beta! Wenn du Lust hast zu testen,
          schreib @jumpstone4477 einfach eine kurze DM auf Discord.
        </div>
      </div>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            Your Ultimate DJ Experience
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto">
            Transform your events with Q-DJ - the ultimate Spotify queue
            management platform for DJs and hosts.
          </p>

          {!session && (
            <button
              onClick={() => signIn("spotify")}
              className="py-3 px-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full text-lg flex items-center gap-3 mx-auto transition transform hover:scale-105"
            >
              <FaSpotify />
              <span>Start Queue Management</span>
            </button>
          )}
        </div>

        {/* Features Section */}
        <div className="mt-20 max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">
            How Q-DJ Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-sm text-center">
              <div className="text-emerald-400 text-4xl mb-4 flex justify-center">
                <FaCrown />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">DJ Control</h3>
              <p className="text-gray-300">
                Take control of your Spotify playback and manage the queue in
                real-time for your event.
              </p>
            </div>

            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-sm text-center">
              <div className="text-emerald-400 text-4xl mb-4 flex justify-center">
                <FaUsers />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Audience Participation
              </h3>
              <p className="text-gray-300">
                Allow guests to submit song requests that you can approve and
                add to the queue.
              </p>
            </div>

            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-sm text-center">
              <div className="text-emerald-400 text-4xl mb-4 flex justify-center">
                <FaMusic />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Seamless Playback
              </h3>
              <p className="text-gray-300">
                Maintain continuous music flow with queue management and
                real-time playback control.
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-20 max-w-2xl mx-auto text-center bg-gray-800/30 p-8 rounded-xl border border-gray-700 backdrop-blur-sm">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Transform Your Events?
          </h2>
          <p className="text-gray-300 mb-6">
            Join much DJs and event hosts who use Q-DJ to manage their Spotify
            queues and engage their audience.
          </p>

          {!session && (
            <button
              onClick={() => signIn("spotify")}
              className="py-3 px-8 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full text-lg flex items-center gap-3 mx-auto transition transform hover:scale-105"
            >
              <FaSpotify />
              <span>Get Started Now</span>
            </button>
          )}
        </div>

        {/* Open Source Section */}
        <div className="mt-20 max-w-4xl mx-auto text-center bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-10 rounded-2xl border border-gray-600 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <FaGithub className="text-4xl text-white" />
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-200 to-gray-400 bg-clip-text text-transparent">
                100% Open Source
              </h2>
            </div>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Q-DJ is completely open source - the code is available for
              everyone to view, contribute to, and improve.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
              <a
                href="https://github.com/HMTCoding/Q-DJ"
                target="_blank"
                rel="noopener noreferrer"
                className="py-4 px-8 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-full text-lg flex items-center gap-3 transition transform hover:scale-105"
              >
                <FaGithub />
                <span>View on GitHub</span>
              </a>
            </div>
            <p className="text-gray-400 mt-6 text-base">
              Licensed under CC BY-NC-SA 4.0 • Contribute on GitHub
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
