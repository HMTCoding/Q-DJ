-- Migration: Add mode and spotify_playlist_id columns to events table

-- Add mode column with default value 'queue'
ALTER TABLE events 
ADD COLUMN mode TEXT DEFAULT 'queue' CHECK (mode IN ('queue', 'playlist'));

-- Add spotify_playlist_id column
ALTER TABLE events 
ADD COLUMN spotify_playlist_id TEXT;

-- Update existing records to have the default mode
UPDATE events 
SET mode = 'queue' 
WHERE mode IS NULL;

-- Add comment to document the purpose of the mode column
COMMENT ON COLUMN events.mode IS 'Event mode: queue (direct queue) or playlist (Spotify playlist)';
COMMENT ON COLUMN events.spotify_playlist_id IS 'Spotify playlist ID when mode is playlist';