"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import {
  FaSpotify,
  FaSignOutAlt,
  FaHome,
  FaTachometerAlt,
  FaMusic,
  FaGithub,
} from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Check if we're on a specific event page to show event navigation
  const isEventPage =
    pathname?.includes("/event/") &&
    !pathname?.includes("/manager") &&
    !pathname?.includes("/tv");
  const isManagerPage = pathname?.includes("/manager");
  const isTvPage = pathname?.includes("/tv");
  const isDashboard = pathname === "/dashboard";
  const isHomePage = pathname === "/" || pathname === "/home";

  // Extract event ID if on an event page
  let eventId = null;
  if (isEventPage || isManagerPage || isTvPage) {
    const pathParts = pathname?.split("/");
    if (pathParts && pathParts.length >= 3) {
      eventId = pathParts[2];
    }
  }

  return (
    <header className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Link
            href="/"
            className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent flex items-center"
          >
            <FaMusic className="mr-2" /> Q-DJ
          </Link>
        </div>

        <nav className="flex items-center space-x-4">
          {status === "authenticated" && session ? (
            <>
              {/* Navigation links for authenticated users */}
              <Link
                href="/dashboard"
                className={`px-3 py-2 rounded-md flex items-center ${
                  isDashboard
                    ? "bg-emerald-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <FaTachometerAlt className="mr-2" /> Dashboard
              </Link>

              {/* Show event-specific navigation if on an event page */}
              {(isEventPage || isManagerPage || isTvPage) && eventId && (
                <div className="flex space-x-2">
                  <Link
                    href={`/event/${eventId}`}
                    className={`px-3 py-2 rounded-md flex items-center ${
                      isEventPage
                        ? "bg-emerald-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    <FaHome className="mr-2" /> Event
                  </Link>

                  <Link
                    href={`/event/${eventId}/manager`}
                    className={`px-3 py-2 rounded-md flex items-center ${
                      isManagerPage
                        ? "bg-emerald-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    <FaMusic className="mr-2" /> Manager
                  </Link>

                  <Link
                    href={`/event/${eventId}/tv`}
                    className={`px-3 py-2 rounded-md flex items-center ${
                      isTvPage
                        ? "bg-emerald-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    TV
                  </Link>
                </div>
              )}

              <a
                href="https://github.com/HMTCoding/Q-DJ"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md flex items-center transition mr-2"
              >
                <FaGithub className="mr-2" /> GitHub
              </a>
              {/* Logout button */}
              <button
                onClick={() => signOut()}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center transition"
              >
                <FaSignOutAlt className="mr-2" /> Logout
              </button>
            </>
          ) : status === "loading" ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            // Login button for non-authenticated users
            <>
              <a
                href="https://github.com/HMTCoding/Q-DJ"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md flex items-center transition mr-2"
              >
                <FaGithub className="mr-2" /> GitHub
              </a>
              <button
                onClick={() => signIn("spotify")}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center transition"
              >
                <FaSpotify className="mr-2" /> Login
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
