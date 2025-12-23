-- Events table for Q-DJ app
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  manager_id UUID NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create an index on manager_id for faster lookups
CREATE INDEX idx_events_manager_id ON events(manager_id);

-- Create an index on is_active for filtering
CREATE INDEX idx_events_is_active ON events(is_active);

-- Optional: Add a constraint to ensure events have a name
ALTER TABLE events ADD CONSTRAINT events_name_check CHECK (name != '');