-- Migration: Add created_by column to events table

-- Add created_by column
ALTER TABLE events 
ADD COLUMN created_by TEXT;

-- Note: For existing records, we'll need to manually set the created_by field
-- since we don't have the email in the current events table structure

-- Add comment to document the purpose of the created_by column
COMMENT ON COLUMN events.created_by IS 'Email of the user who created the event';