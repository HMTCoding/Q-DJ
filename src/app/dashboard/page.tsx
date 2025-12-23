"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createEvent } from "../actions/createEvent";

interface Event {
  id: string;
  created_at: string;
  name: string;
  manager_id: string;
  is_active: boolean;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [newEventName, setNewEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  // Fetch user's events
  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      fetchEvents();
    }
  }, [status, session]);

  const fetchEvents = async () => {
    if (!session?.user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('manager_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setError(`Error fetching events: ${error.message}`);
      } else {
        setEvents(data || []);
      }
    } catch (err) {
      setError(`Unexpected error: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newEventName.trim()) {
      setError("Event name cannot be empty");
      return;
    }

    const result = await createEvent(newEventName.trim());
    
    if (result.success) {
      setSuccess("Event created successfully!");
      setNewEventName("");
      fetchEvents(); // Refresh the list
    } else {
      setError(result.error || "Unknown error occurred");
    }
  };

  const toggleEventStatus = async (eventId: string, currentStatus: boolean) => {
    setError(null);
    setSuccess(null);

    if (!session?.user?.id) {
      setError("User not authenticated");
      return;
    }

    try {
      const { error } = await supabase
        .from('events')
        .update({ is_active: !currentStatus })
        .eq('id', eventId)
        .eq('manager_id', session.user.id);

      if (error) {
        setError(`Error updating event: ${error.message}`);
      } else {
        setSuccess(`Event ${!currentStatus ? 'activated' : 'deactivated'} successfully!`);
        fetchEvents(); // Refresh the list
      }
    } catch (err) {
      setError(`Unexpected error: ${err}`);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 font-sans">
        <div className="text-center">
          <p className="text-xl text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 font-sans">
        <div className="text-center p-8 bg-gray-800/50 rounded-xl border border-gray-700 max-w-md">
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-300 mb-6">Please log in to access the dashboard</p>
          <a 
            href="/"
            className="inline-block py-2 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            Q-DJ Dashboard
          </h1>
          <p className="text-xl text-gray-300">Manage your events</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Create Event Form */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-sm">
              <h2 className="text-2xl font-bold text-white mb-6">Create New Event</h2>
              
              <form onSubmit={handleCreateEvent}>
                <div className="mb-4">
                  <label htmlFor="eventName" className="block text-gray-300 mb-2">
                    Event Name
                  </label>
                  <input
                    type="text"
                    id="eventName"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    className="w-full p-3 rounded-lg bg-gray-700/50 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter event name"
                    maxLength={100}
                  />
                </div>
                
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition duration-200"
                >
                  Create Event
                </button>
              </form>
              
              {error && (
                <div className="mt-4 p-3 bg-red-900/50 text-red-200 rounded-lg border border-red-700">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mt-4 p-3 bg-green-900/50 text-green-200 rounded-lg border border-green-700">
                  {success}
                </div>
              )}
              
              <div className="mt-6 p-4 bg-blue-900/30 rounded-lg border border-blue-700">
                <h3 className="text-lg font-semibold text-blue-300 mb-2">Note</h3>
                <p className="text-blue-200 text-sm">
                  You can have a maximum of 2 active events at the same time. 
                  Deactivate events to create new ones.
                </p>
              </div>
            </div>
          </div>
          
          {/* Right column - Events List */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 backdrop-blur-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Your Events</h2>
                <span className="text-gray-400">
                  {events.length} {events.length === 1 ? 'event' : 'events'}
                </span>
              </div>
              
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">Loading events...</p>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">No events yet</p>
                  <p className="text-gray-500 mt-2">Create your first event using the form</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => (
                    <div 
                      key={event.id} 
                      className={`p-4 rounded-lg border ${
                        event.is_active 
                          ? 'bg-gray-700/30 border-emerald-500/30' 
                          : 'bg-gray-900/30 border-gray-600'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{event.name}</h3>
                          <p className="text-gray-400 text-sm mt-1">
                            Created: {new Date(event.created_at).toLocaleString()}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span 
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              event.is_active 
                                ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' 
                                : 'bg-gray-700 text-gray-400 border border-gray-600'
                            }`}
                          >
                            {event.is_active ? 'Active' : 'Inactive'}
                          </span>
                          
                          <button
                            onClick={() => toggleEventStatus(event.id, event.is_active)}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                              event.is_active
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {event.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </div>
                      
                      <div className="mt-3 flex gap-2">
                        <Link href={`/event/${event.id}/manager`} className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded">
                          Manage
                        </Link>
                        <Link href={`/event/${event.id}`} className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded">
                          View Details
                        </Link>
                        <button 
                          onClick={async () => {
                            const guestUrl = `${window.location.origin}/event/${event.id}`;
                            try {
                              await navigator.clipboard.writeText(guestUrl);
                              setCopiedEventId(event.id);
                              setTimeout(() => {
                                if (copiedEventId === event.id) {
                                  setCopiedEventId(null);
                                }
                              }, 2000);
                            } catch (err) {
                              console.error('Failed to copy: ', err);
                            }
                          }}
                          className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                        >
                          {copiedEventId === event.id ? 'Copied!' : 'Copy Link'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}