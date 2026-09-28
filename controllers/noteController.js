const db = require('../config/db');
const storage = require('../config/storage');

const MAX_TITLE_BYTES = 255;

function validateNote(title, content) {
  if (typeof title !== 'string' || title.trim() === '') {
    return 'Validation error: Title is required and cannot be empty.';
  }

  if (typeof content !== 'string') {
    return 'Validation error: Content is required and must be a string.';
  }

  const titleBytes = Buffer.byteLength(title, 'utf8');

  if (titleBytes > MAX_TITLE_BYTES) {
    return `Validation error: Title exceeds the maximum limit of ${MAX_TITLE_BYTES} bytes.`;
  }

  return null;
}

function withAttachment(note) {
  const {
    attachment_path: attachmentPath,
    attachment_name: attachmentName,
    attachment_mime_type: attachmentMimeType,
    attachment_size: attachmentSize,
    ...publicNote
  } = note;

  return {
    ...publicNote,
    attachment: attachmentPath
      ? {
          name: attachmentName,
          mimeType: attachmentMimeType,
          sizeBytes: Number(attachmentSize)
        }
      : null
  };
}

function safeFileName(name) {
  const normalized = String(name || 'attachment')
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 255);

  return normalized || 'attachment';
}

function sendError(res, error, message) {
  console.error(message, {
    code: error.code || null,
    statusCode: error.statusCode || null,
    message: error.message
  });

  const status = error.statusCode || 500;
  const exposeDetail =
    process.env.NODE_ENV !== 'production' || status < 500;

  return res.status(status).json({
    error: exposeDetail ? error.message : message,
    ...(error.code ? { code: error.code } : {})
  });
}

/**
 * Get all notes for the logged-in student.
 * Parameterized query ensures strict multi-tenant isolation.
 */
async function getNotes(req, res) {
  try {
    const userId = req.session.userId;

    const result = await db.query(
      `SELECT id, title, content, created_at, attachment_path,
              attachment_name, attachment_mime_type, attachment_size
       FROM notes
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({
      count: result.rows.length,
      notes: result.rows.map(withAttachment)
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Internal server error while fetching notes.'
    );
  }
}

/**
 * Create a new personal note.
 * Stores note content without a small application-level size limit.
 */
async function createNote(req, res) {
  try {
    const userId = req.session.userId;
    const { title, content } = req.body || {};

    const validationError = validateNote(title, content);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const trimmedTitle = title.trim();

    const result = await db.query(
      `INSERT INTO notes (user_id, title, content)
       VALUES ($1, $2, $3)
       RETURNING id, title, content, created_at, updated_at`,
      [userId, trimmedTitle, content]
    );

    let createdNote = result.rows[0];

    if (req.file) {
      const objectPath = storage.createObjectPath(
        userId,
        createdNote.id
      );

      const fileName = safeFileName(req.file.originalname);
      let objectUploaded = false;

      try {
        await storage.uploadObject(objectPath, req.file);
        objectUploaded = true;

        const attachmentResult = await db.query(
          `UPDATE notes
           SET attachment_path = $1,
               attachment_name = $2,
               attachment_mime_type = $3,
               attachment_size = $4
           WHERE id = $5
           AND user_id = $6
           RETURNING id, title, content, created_at, updated_at,
                     attachment_path, attachment_name,
                     attachment_mime_type, attachment_size`,
          [
            objectPath,
            fileName,
            req.file.mimetype,
            req.file.size,
            createdNote.id,
            userId
          ]
        );

        createdNote = attachmentResult.rows[0];
      } catch (error) {
        if (objectUploaded) {
          try {
            await storage.deleteObject(objectPath);
          } catch (cleanupError) {
            console.error(
              'Attachment cleanup error:',
              cleanupError.message
            );
          }
        }

        await db.query(
          'DELETE FROM notes WHERE id = $1 AND user_id = $2',
          [createdNote.id, userId]
        );

        throw error;
      }
    }

    return res.status(201).json({
      message: 'Note created successfully.',
      note: withAttachment(createdNote),
      byteSize: {
        titleBytes: Buffer.byteLength(trimmedTitle, 'utf8'),
        contentBytes: Buffer.byteLength(content, 'utf8')
      }
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Internal server error while creating note.'
    );
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

    if (!Number.isSafeInteger(noteId) || noteId < 1) {
      return res.status(400).json({
        error: 'Invalid note ID provided.'
      });
    }

    const result = await db.query(
      `SELECT id, user_id, title, content, created_at, updated_at,
              attachment_path, attachment_name, attachment_mime_type,
              attachment_size
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

    return res.json({
      note: withAttachment(result.rows[0])
    });
  } catch (error) {
    return sendError(
      res,
      error,
      'Internal server error while retrieving note.'
    );
  }
}

/**
 * Update a note owned by the logged-in student.
 */
async function updateNote(req, res) {
  try {
    const userId = req.session.userId;
    const noteId = Number(req.params.id);
    const { title, content, removeAttachment } = req.body || {};

    if (!Number.isSafeInteger(noteId) || noteId < 1) {
      return res.status(400).json({
        error: 'Invalid note ID provided.'
      });
    }

    const validationError = validateNote(title, content);

    if (validationError) {
      return res.status(400).json({
        error: validationError
      });
    }

    if (req.file && removeAttachment === 'true') {
      return res.status(400).json({
        error:
          'Choose a new attachment or remove the current one, not both.'
      });
    }

    const existingResult = await db.query(
      `SELECT attachment_path,
              attachment_name,
              attachment_mime_type,
              attachment_size
       FROM notes
       WHERE id = $1
       AND user_id = $2`,
      [noteId, userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Note not found.'
      });
    }

    const existingAttachment = existingResult.rows[0];

    let attachmentPath = existingAttachment.attachment_path;
    let attachmentName = existingAttachment.attachment_name;
    let attachmentMimeType =
      existingAttachment.attachment_mime_type;
    let attachmentSize = existingAttachment.attachment_size;

    let uploadedPath;
    let objectUploaded = false;

    if (req.file) {
      attachmentPath = storage.createObjectPath(userId, noteId);
      attachmentName = safeFileName(req.file.originalname);
      attachmentMimeType = req.file.mimetype;
      attachmentSize = req.file.size;
      uploadedPath = attachmentPath;
    } else if (removeAttachment === 'true') {
      attachmentPath = null;
      attachmentName = null;
      attachmentMimeType = null;
      attachmentSize = null;
    }

    try {
      if (req.file) {
        await storage.uploadObject(uploadedPath, req.file);
        objectUploaded = true;
      }

      const result = await db.query(
        `UPDATE notes
         SET title = $1,
             content = $2,
             updated_at = CURRENT_TIMESTAMP,
             attachment_path = $3,
             attachment_name = $4,
             attachment_mime_type = $5,
             attachment_size = $6
         WHERE id = $7
         AND user_id = $8
         RETURNING id, title, content, created_at, updated_at,
                   attachment_path, attachment_name,
                   attachment_mime_type, attachment_size`,
        [
          title.trim(),
          content,
          attachmentPath,
          attachmentName,
          attachmentMimeType,
          attachmentSize,
          noteId,
          userId
        ]
      );

      if (result.rows.length === 0) {
        if (objectUploaded) {
          await storage.deleteObject(uploadedPath);
        }

        return res.status(404).json({
          error: 'Note not found.'
        });
      }

      let cleanupPending = false;

      if (
        existingAttachment.attachment_path &&
        existingAttachment.attachment_path !== attachmentPath
      ) {
        try {
          await storage.deleteObject(
            existingAttachment.attachment_path
          );
        } catch (cleanupError) {
          cleanupPending = true;

          console.error(
            'Old attachment cleanup error:',
            cleanupError.message
          );
        }
      }

      return res.json({
        message: 'Note updated successfully.',
        note: withAttachment(result.rows[0]),
        attachmentCleanupPending: cleanupPending
      });
    } catch (error) {
      if (objectUploaded) {
        try {
          await storage.deleteObject(uploadedPath);
        } catch (cleanupError) {
          console.error(
            'New attachment cleanup error:',
            cleanupError.message
          );
        }
      }

      return sendError(
        res,
        error,
        'Internal server error while updating note.'
      );
    }
  } catch (error) {
    return sendError(
      res,
      error,
      'Internal server error while updating note.'
    );
  }
}

/**
 * Get a signed URL for a note attachment.
 * Ensures student can only access their own attachment.
 */
async function getNoteAttachment(req, res) {
  try {
    const userId = req.session.userId;
    const noteId = Number(req.params.id);

    if (!Number.isSafeInteger(noteId) || noteId < 1) {
      return res.status(400).json({
        error: 'Invalid note ID provided.'
      });
    }

    const result = await db.query(
      `SELECT attachment_path, attachment_name
       FROM notes
       WHERE id = $1
       AND user_id = $2`,
      [noteId, userId]
    );

    if (
      result.rows.length === 0 ||
      !result.rows[0].attachment_path
    ) {
      return res.status(404).json({
        error: 'Attachment not found.'
      });
    }

    const attachment = result.rows[0];

    const signedUrl = await storage.createSignedUrl(
      attachment.attachment_path,
      attachment.attachment_name,
      req.query.inline !== '1'
    );

    res.setHeader('Cache-Control', 'private, no-store');

    return res.redirect(302, signedUrl);
  } catch (error) {
    return sendError(
      res,
      error,
      'Internal server error while retrieving attachment.'
    );
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

    if (!Number.isSafeInteger(noteId) || noteId < 1) {
      return res.status(400).json({
        error: 'Invalid note ID provided.'
      });
    }

    const result = await db.query(
      `SELECT id, attachment_path
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

    if (result.rows[0].attachment_path) {
      await storage.deleteObject(
        result.rows[0].attachment_path
      );
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
    return sendError(
      res,
      error,
      'Internal server error while deleting note.'
    );
  }
}

module.exports = {
  getNotes,
  createNote,
  getNoteById,
  updateNote,
  getNoteAttachment,
  deleteNote
};