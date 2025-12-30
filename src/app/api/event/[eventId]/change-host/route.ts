import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';

export async function POST(request: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = params;
    const { newHostEmail } = await request.json();
    
    if (!eventId || !newHostEmail) {
      return Response.json({ error: 'Event ID and new host email are required' }, { status: 400 });
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
      return Response.json({ error: 'Only the event host can change the active host' }, { status: 403 });
    }

    // Check if the new host is a member of the event
    const { data: memberData, error: memberError } = await supabase
      .from('event_members')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_email', newHostEmail)
      .single();

    if (memberError || !memberData) {
      return Response.json({ error: 'The new host must be a member of the event' }, { status: 400 });
    }

    // Update the active host for the event
    const { error: updateError } = await supabase
      .from('events')
      .update({ active_host_email: newHostEmail })
      .eq('id', eventId);

    if (updateError) {
      console.error('Error updating active host:', updateError);
      return Response.json({ error: 'Failed to update active host' }, { status: 500 });
    }

    return Response.json({ 
      success: true, 
      message: 'Active host updated successfully',
      newActiveHost: newHostEmail
    });
  } catch (error) {
    console.error('Error changing active host:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}