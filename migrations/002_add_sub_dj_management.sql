-- Create event_members table
CREATE TABLE event_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    user_email TEXT NOT NULL,
    role TEXT DEFAULT 'sub_dj' CHECK (role IN ('host_dj', 'sub_dj')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(event_id, user_email)
);

-- Create event_invites table
CREATE TABLE event_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    invite_code UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Add active_host_email column to events table
ALTER TABLE events ADD COLUMN active_host_email TEXT;

-- Create indexes for better performance
CREATE INDEX idx_event_members_event_id ON event_members(event_id);
CREATE INDEX idx_event_members_user_email ON event_members(user_email);
CREATE INDEX idx_event_invites_event_id ON event_invites(event_id);
CREATE INDEX idx_event_invites_invite_code ON event_invites(invite_code);
CREATE INDEX idx_event_invites_expires_at ON event_invites(expires_at);