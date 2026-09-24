const express = require('express');
const noteController = require('../controllers/noteController');
const requireAuth = require('../middleware/authMiddleware');

const router = express.Router();

// Protect all note routes with authentication middleware
router.use(requireAuth);

// Get all notes for the authenticated user
router.get('/', noteController.getNotes);

// Create a new note (enforces 256-byte maximum limit)
router.post('/', noteController.createNote);

// Get single note by ID (user-isolated)
router.get('/:id', noteController.getNoteById);

// Delete single note by ID (user-isolated)
router.delete('/:id', noteController.deleteNote);

module.exports = router;
