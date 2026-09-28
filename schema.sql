-- ============================================
-- SECURE STUDENT NOTES DATABASE
-- Database Schema
-- ============================================

-- USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NOTES TABLE
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    attachment_path TEXT,
    attachment_name VARCHAR(255),
    attachment_mime_type VARCHAR(127),
    attachment_size BIGINT,

    -- Connect each note to its owner
    CONSTRAINT fk_notes_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT notes_attachment_metadata_check
        CHECK (
            (attachment_path IS NULL AND attachment_name IS NULL
                AND attachment_mime_type IS NULL AND attachment_size IS NULL)
            OR
            (attachment_path IS NOT NULL AND attachment_name IS NOT NULL
                AND attachment_mime_type IS NOT NULL
                AND attachment_size IS NOT NULL AND attachment_size >= 0)
        )
);

-- Index to make finding a user's notes faster
CREATE INDEX idx_notes_user_id
ON notes(user_id);
