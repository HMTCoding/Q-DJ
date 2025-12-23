"use client";

import { useSession } from "next-auth/react";
import { useRouter, redirect } from "next/navigation";
import { useEffect } from "react";

export default function RootPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Check authentication status and redirect accordingly
  useEffect(() => {
    if (status === "loading") return; // Wait for session to load

    if (status === "authenticated") {
      // If user is logged in, redirect to dashboard
      router.push("/dashboard");
    } else {
      // If user is not logged in, redirect to home page
      router.push("/home");
    }
  }, [status, router]);

  // Show loading state while checking authentication
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
        <p className="text-gray-300 text-lg">Checking authentication...</p>
      </div>
    </div>
  );
}
