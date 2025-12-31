import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../api/auth/[...nextauth]/route';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the event ID from the request body
    const { eventId } = await request.json();
    
    if (!eventId) {
      return Response.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Check if the user is the host of the event
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('manager_id')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    if (eventData.manager_id !== session.user.id) {
      return Response.json({ error: 'Only the event host can generate invites' }, { status: 403 });
    }

    // Generate a new invite with 1 hour expiration
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
    
    const { data: invite, error: insertError } = await supabase
      .from('event_invites')
      .insert({
        event_id: eventId,
        expires_at: oneHourFromNow.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating invite:', insertError);
      return Response.json({ error: 'Failed to create invite' }, { status: 500 });
    }

    return Response.json({ 
      success: true, 
      inviteCode: invite.invite_code,
      expiresAt: invite.expires_at
    });
  } catch (error) {
    console.error('Error generating invite:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}