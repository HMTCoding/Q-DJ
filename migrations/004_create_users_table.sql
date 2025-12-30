-- Migration: Create users table for storing Spotify credentials

-- Create the users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,  -- This will store the Spotify user ID
    email TEXT UNIQUE,    -- Email of the user
    name TEXT,            -- Name of the user
    image TEXT,           -- Profile image URL
    access_token TEXT,    -- Spotify access token
    refresh_token TEXT,   -- Spotify refresh token
    provider TEXT,        -- OAuth provider (e.g., 'spotify')
    provider_id TEXT,     -- Provider's user ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider);
CREATE INDEX idx_users_provider_id ON users(provider_id);

-- Create a trigger to update the 'updated_at' column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();