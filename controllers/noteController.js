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

    const result = await db.query(
      `SELECT id, title, content, created_at
       FROM notes
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({
      count: result.rows.length,
      notes: result.rows
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return res.status(500).json({
      error: 'Internal server error while fetching notes.'
    });
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
      return res.status(400).json({
        error: 'Validation error: Title is required and cannot be empty.'
      });
    }

    if (
      content === undefined ||
      content === null ||
      typeof content !== 'string'
    ) {
      return res.status(400).json({
        error: 'Validation error: Content is required and must be a string.'
      });
    }

    // Exact UTF-8 byte calculation
    const titleBytes = Buffer.byteLength(title, 'utf8');
    const contentBytes = Buffer.byteLength(content, 'utf8');

    if (titleBytes > MAX_TITLE_BYTES) {
      return res.status(400).json({
        error: `Validation error: Title exceeds the maximum limit of ${MAX_TITLE_BYTES} bytes (received: ${titleBytes} bytes).`
      });
    }

    if (contentBytes > MAX_CONTENT_BYTES) {
      return res.status(400).json({
        error: `Validation error: Note content exceeds the maximum limit of ${MAX_CONTENT_BYTES} bytes (received: ${contentBytes} bytes).`
      });
    }

    const trimmedTitle = title.trim();

    const result = await db.query(
      `INSERT INTO notes (user_id, title, content)
       VALUES ($1, $2, $3)
       RETURNING id, title, content, created_at`,
      [userId, trimmedTitle, content]
    );

    const createdNote = result.rows[0];

    return res.status(201).json({
      message: 'Note created successfully.',
      note: createdNote,
      byteSize: {
        titleBytes,
        contentBytes,
        maxAllowedContentBytes: MAX_CONTENT_BYTES
      }
    });
  } catch (error) {
    console.error('Error creating note:', error);
    return res.status(500).json({
      error: 'Internal server error while creating note.'
    });
  }
}

/**
 * Get note by ID.
 * Ensures student can only access their own note.
 */
async function getNoteById(req, res) {
  try {
    const userId = req.session.userId;
    const noteId = Number(req.params.id);

    if (isNaN(noteId)) {
      return res.status(400).json({
        error: 'Invalid note ID provided.'
      });
    }

    const result = await db.query(
      `SELECT id, user_id, title, content, created_at
       FROM notes
       WHERE id = $1
       AND user_id = $2`,
      [noteId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Note not found.'
      });
    }

    const note = result.rows[0];

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
    return res.status(500).json({
      error: 'Internal server error while retrieving note.'
    });
  }
}

/**
 * Update an existing note.
 * Ensures student can only update their own note.
 */
async function updateNote(req, res) {
  try {
    const userId = req.session.userId;
    const noteId = Number(req.params.id);
    const { title, content } = req.body;

    if (isNaN(noteId)) {
      return res.status(400).json({
        error: 'Invalid note ID provided.'
      });
    }

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({
        error: 'Validation error: Title is required and cannot be empty.'
      });
    }

    if (
      content === undefined ||
      content === null ||
      typeof content !== 'string'
    ) {
      return res.status(400).json({
        error: 'Validation error: Content is required and must be a string.'
      });
    }

    const titleBytes = Buffer.byteLength(title, 'utf8');
    const contentBytes = Buffer.byteLength(content, 'utf8');

    if (titleBytes > MAX_TITLE_BYTES) {
      return res.status(400).json({
        error: `Validation error: Title exceeds the maximum limit of ${MAX_TITLE_BYTES} bytes (received: ${titleBytes} bytes).`
      });
    }

    if (contentBytes > MAX_CONTENT_BYTES) {
      return res.status(400).json({
        error: `Validation error: Note content exceeds the maximum limit of ${MAX_CONTENT_BYTES} bytes (received: ${contentBytes} bytes).`
      });
    }

    const trimmedTitle = title.trim();

    const existing = await db.query(
      `SELECT id FROM notes WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Note not found.'
      });
    }

    const result = await db.query(
      `UPDATE notes
       SET title = $1,
           content = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       AND user_id = $4
       RETURNING id, title, content, created_at, updated_at`,
      [trimmedTitle, content, noteId, userId]
    );

    return res.json({
      message: 'Note updated successfully.',
      note: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating note:', error);
    return res.status(500).json({
      error: 'Internal server error while updating note.'
    });
  }
}

/**
 * Delete note by ID.
 * Ensures student can only delete their own note.
 */
async function deleteNote(req, res) {
  try {
    const userId = req.session.userId;
    const noteId = Number(req.params.id);

    if (isNaN(noteId)) {
      return res.status(400).json({
        error: 'Invalid note ID provided.'
      });
    }

    const result = await db.query(
      `SELECT id
       FROM notes
       WHERE id = $1
       AND user_id = $2`,
      [noteId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Note not found.'
      });
    }

    await db.query(
      `DELETE FROM notes
       WHERE id = $1
       AND user_id = $2`,
      [noteId, userId]
    );

    return res.json({
      message: 'Note deleted successfully.',
      deletedNoteId: noteId
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    return res.status(500).json({
      error: 'Internal server error while deleting note.'
    });
  }
}

module.exports = {
  getNotes,
  createNote,
  getNoteById,
  updateNote,
  deleteNote
};
