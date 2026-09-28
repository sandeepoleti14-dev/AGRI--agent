const express = require('express');
const noteController = require('../controllers/noteController');
const requireAuth = require('../middleware/authMiddleware');
const { uploadAttachment } = require('../middleware/attachmentUpload');

const router = express.Router();

// Protect all note routes with authentication middleware
router.use(requireAuth);

// Get all notes for the authenticated user
router.get('/', noteController.getNotes);

// Create a new note with optional authenticated attachment upload
router.post('/', uploadAttachment, noteController.createNote);

// Update a note by ID (user-isolated)
router.put('/:id', noteController.updateNote);

// Get single note by ID (user-isolated)
router.get('/:id', noteController.getNoteById);

// Update a note owned by the authenticated user
router.put('/:id', uploadAttachment, noteController.updateNote);

// Issue short-lived signed URLs only after checking note ownership
router.get('/:id/attachment', noteController.getNoteAttachment);

// Delete single note by ID (user-isolated)
router.delete('/:id', noteController.deleteNote);

module.exports = router;
