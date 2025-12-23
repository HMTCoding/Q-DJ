"use server";

import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export interface Event {
  id: string;
  created_at: string;
  name: string;
  manager_id: string;
  is_active: boolean;
}

export interface CreateEventResult {
  success: boolean;
  error?: string;
  event?: Event;
}

export async function createEvent(name: string): Promise<CreateEventResult> {
  try {
    // Get the current session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    // Get the user's ID from the session
    const userId = session.user.id;
    
    if (!userId) {
      return {
        success: false,
        error: "User ID not found in session"
      };
    }

    // Check how many active events the user already has
    const { data: existingEvents, error: countError } = await supabase
      .from('events')
      .select('id', { count: 'exact' })
      .eq('manager_id', userId)
      .eq('is_active', true);

    if (countError) {
      return {
        success: false,
        error: `Error checking existing events: ${countError.message}`
      };
    }

    // Check if the user already has 2 or more active events
    if (existingEvents && existingEvents.length >= 2) {
      return {
        success: false,
        error: "Maximum number of events (2) reached. Please deactivate an existing event before creating a new one."
      };
    }

    // Create the new event
    const { data, error } = await supabase
      .from('events')
      .insert([{ 
        name, 
        manager_id: userId,
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: `Error creating event: ${error.message}`
      };
    }

    return {
      success: true,
      event: data as Event
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Unexpected error: ${error.message || error}`
    };
  }
}