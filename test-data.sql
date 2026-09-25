-- ============================================
-- SECURE STUDENT NOTES
-- Test Data
-- ============================================

-- Test users
INSERT INTO users (name, email, password_hash)
VALUES
    ('Test Student 1', 'student1@test.com', 'test_hash_1'),
    ('Test Student 2', 'student2@test.com', 'test_hash_2');

-- Test notes
INSERT INTO notes (user_id, title, content)
VALUES
    (
        1,
        'Database Basics',
        'This is a test note about database concepts.'
    ),
    (
        1,
        'SQL Commands',
        'SELECT, INSERT, UPDATE and DELETE are common SQL commands.'
    ),
    (
        2,
        'Computer Networks',
        'This is a test note about computer networks.'
    );
