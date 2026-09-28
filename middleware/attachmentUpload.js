const multer = require('multer');

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_FIELD_BYTES = 20 * 1024 * 1024;
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv'
]);

const parser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_BYTES,
    files: 1,
    fields: 3,
    fieldSize: MAX_TEXT_FIELD_BYTES,
    parts: 4
  },
  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Choose a JPEG, PNG, WebP, GIF, PDF, text, or CSV file.');
      error.statusCode = 400;
      return callback(error);
    }

    callback(null, true);
  }
});

function uploadAttachment(req, res, next) {
  parser.single('attachment')(req, res, (error) => {
    if (error) {
      const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const messages = {
        LIMIT_FILE_SIZE: 'Attachments must be 10 MB or smaller.',
        LIMIT_FILE_COUNT: 'Only one attachment can be uploaded per note.',
        LIMIT_FIELD_COUNT: 'The multipart request contains too many text fields.',
        LIMIT_FIELD_VALUE: 'A multipart text field is too large.',
        LIMIT_PART_COUNT: 'The multipart request contains too many parts.',
        LIMIT_UNEXPECTED_FILE: `Unexpected file field "${error.field || ''}"; use the "attachment" field.`
      };
      const message = messages[error.code] || error.message || 'Multipart parsing failed.';
      const detail = process.env.NODE_ENV === 'production'
        ? message
        : `${message} (${error.code || error.name || 'MULTIPART_ERROR'})`;

      console.error('Attachment multipart error:', {
        code: error.code || null,
        field: error.field || null,
        message: error.message
      });

      return res.status(statusCode).json({
        error: detail,
        code: error.code || 'MULTIPART_ERROR'
      });
    }

    next();
  });
}

module.exports = {
  MAX_ATTACHMENT_BYTES,
  uploadAttachment
};
