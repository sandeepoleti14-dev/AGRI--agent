const db = require('../config/db');

const MAX_CONTENT_BYTES = 256;
const MAX_TITLE_BYTES = 256;

/**
 * Get all notes for the logged-in student.
 * Parameterized query ensures strict multi-tenant isolation.
 */
async function getNotes(req, res) {
  try {
    const userId = req.session.userId;
    const [notes] = await db.query(
      'SELECT id, title, content, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    return res.json({
      count: notes.length,
      notes
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return res.status(500).json({ error: 'Internal server error while fetching notes.' });
  }
}

/**
 * Create a new personal note.
 * Enforces strict 256-byte limit on note content using UTF-8 byte calculation.
 */
async function createNote(req, res) {
  try {
    const userId = req.session.userId;
    const { title, content } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Validation error: Title is required and cannot be empty.' });
    }

    if (content === undefined || content === null || typeof content !== 'string') {
      return res.status(400).json({ error: 'Validation error: Content is required and must be a string.' });
    }

    // Exact UTF-8 byte calculation using Buffer.byteLength
    const titleBytes = Buffer.byteLength(title, 'utf8');
    const contentBytes = Buffer.byteLength(content, 'utf8');

    if (titleBytes > MAX_TITLE_BYTES) {
      return res.status(400).json({
        error: `Validation error: Title exceeds the maximum limit of ${MAX_TITLE_BYTES} bytes (received: ${titleBytes} bytes).`
      });
    }

    // 256-byte maximum limit enforcement
    if (contentBytes > MAX_CONTENT_BYTES) {
      return res.status(400).json({
        error: `Validation error: Note content exceeds the maximum limit of ${MAX_CONTENT_BYTES} bytes (received: ${contentBytes} bytes).`
      });
    }

    const trimmedTitle = title.trim();
    const [result] = await db.query(
      'INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)',
      [userId, trimmedTitle, content]
    );

    const newNoteId = result.insertId;
    const [createdRows] = await db.query(
      'SELECT id, title, content, created_at FROM notes WHERE id = ? AND user_id = ?',
      [newNoteId, userId]
    );

    return res.status(201).json({
      message: 'Note created successfully.',
      note: createdRows[0],
      byteSize: {
        titleBytes,
        contentBytes,
        maxAllowedContentBytes: MAX_CONTENT_BYTES
      }
    });
  } catch (error) {
    console.error('Error creating note:', error);
    return res.status(500).json({ error: 'Internal server error while creating note.' });
  }
}

/**
 * Get note by ID
 * Ensures student can only access their own note.
 */
async function getNoteById(req, res) {
  try {
    const userId = req.session.userId;
    const noteId = Number(req.params.id);

    if (isNaN(noteId)) {
      return res.status(400).json({ error: 'Invalid note ID provided.' });
    }

    const [rows] = await db.query('SELECT id, user_id, title, content, created_at FROM notes WHERE id = ?', [
      noteId
    ]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    const note = rows[0];

    // Authorization check: Verify ownership
    if (note.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view this note.' });
    }

    return res.json({
      note: {
        id: note.id,
        title: note.title,
        content: note.content,
        created_at: note.created_at
      }
    });
  } catch (error) {
    console.error('Error retrieving note:', error);
    return res.status(500).json({ error: 'Internal server error while retrieving note.' });
  }
}

/**
 * Delete note by ID
 * Ensures student can only delete their own note.
 */
async function deleteNote(req, res) {
  try {
    const userId = req.session.userId;
    const noteId = Number(req.params.id);

    if (isNaN(noteId)) {
      return res.status(400).json({ error: 'Invalid note ID provided.' });
    }

    const [rows] = await db.query('SELECT id, user_id FROM notes WHERE id = ?', [noteId]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    // Authorization check: Verify ownership
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You are not authorized to delete this note.' });
    }

    await db.query('DELETE FROM notes WHERE id = ? AND user_id = ?', [noteId, userId]);

    return res.json({
      message: 'Note deleted successfully.',
      deletedNoteId: noteId
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    return res.status(500).json({ error: 'Internal server error while deleting note.' });
  }
}

module.exports = {
  getNotes,
  createNote,
  getNoteById,
  deleteNote
};
