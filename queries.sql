-- ============================================
-- SECURE STUDENT NOTES
-- Database Queries
-- ============================================

-- 1. Register a new user
INSERT INTO users (name, email, password_hash)
VALUES ($1, $2, $3)
RETURNING id, name, email, created_at;


-- 2. Find a user during login
SELECT id, name, email, password_hash
FROM users
WHERE email = $1;


-- 3. Create a new note
INSERT INTO notes (user_id, title, content)
VALUES ($1, $2, $3)
RETURNING *;


-- 4. Get all notes belonging to a user
SELECT id, title, content, created_at, updated_at,
       attachment_path, attachment_name, attachment_mime_type, attachment_size
FROM notes
WHERE user_id = $1
ORDER BY created_at DESC;


-- 5. Get one specific note belonging to a user
SELECT id, title, content, created_at, updated_at,
       attachment_path, attachment_name, attachment_mime_type, attachment_size
FROM notes
WHERE id = $1
AND user_id = $2;


-- 6. Update a user's note
UPDATE notes
SET
    title = $1,
    content = $2,
    updated_at = CURRENT_TIMESTAMP,
    attachment_path = $3,
    attachment_name = $4,
    attachment_mime_type = $5,
    attachment_size = $6
WHERE id = $7
AND user_id = $8
RETURNING *;


-- 7. Get attachment metadata before issuing an authenticated signed URL
SELECT attachment_path, attachment_name
FROM notes
WHERE id = $1
AND user_id = $2;


-- 8. Delete a user's note after removing its private Storage object
DELETE FROM notes
WHERE id = $1
AND user_id = $2;
