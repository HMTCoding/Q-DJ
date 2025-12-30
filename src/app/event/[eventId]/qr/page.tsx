"use client";

import { useState, useEffect, use } from "react";
import { useParams } from "next/navigation";

export default function QrCodePage() {
  const params = useParams<{ eventId: string }>();
  const { eventId } = params;

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden">
      {/* Animated background with dynamic gradient similar to TV view */}
      <div className="absolute inset-0 opacity-30 blur-3xl scale-125">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-blue-900/30 to-indigo-900/50" />
      </div>

      {/* Centered full-screen QR Code */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8 text-white">
        <div className="flex flex-col items-center justify-center flex-grow">
          <img
            src={`https://quickchart.io/qr?text=${encodeURIComponent(
              `${window.location.origin}/event/${eventId}`
            )}&size=600`}
            alt={`QR Code to join event ${eventId}`}
            className="w-full max-w-[90vw] h-auto max-h-[60vh] object-contain"
            style={{
              maxWidth: "min(90vw, 90vh, 500px)",
              maxHeight: "min(70vh, 70vw, 500px)",
            }}
          />
          <p className="text-white text-center mt-8 text-xl sm:text-2xl md:text-3xl font-bold bg-black/50 px-4 sm:px-6 py-2 sm:py-3 rounded-xl backdrop-blur-sm">
            Scan to join the event
          </p>
        </div>
      </div>
    </div>
  );
}
