const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'student-note-attachments-private';
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    })
  : null;

function storageError(operation, error) {
  const fallback = `Supabase Storage ${operation} failed.`;
  const rawMessage = typeof error?.message === 'string' ? error.message : fallback;
  const safeMessage = rawMessage
    .replaceAll(serviceRoleKey || '\u0000', '[redacted]')
    .replaceAll(supabaseUrl || '\u0000', '[redacted]');
  const detail = process.env.NODE_ENV === 'production'
    ? fallback
    : `${safeMessage} [${error?.statusCode || error?.status || 'STORAGE_ERROR'}]`;
  const wrapped = new Error(detail);
  wrapped.statusCode = 502;
  wrapped.code = error?.code || error?.statusCode || error?.status || 'STORAGE_ERROR';

  console.error(`Supabase Storage ${operation} error:`, {
    code: wrapped.code,
    message: safeMessage
  });

  return wrapped;
}

function getBucket() {
  if (!supabase) {
    const error = new Error('File storage is not configured on the server.');
    error.statusCode = 503;
    throw error;
  }

  return supabase.storage.from(bucketName);
}

function createObjectPath(userId, noteId) {
  return `${userId}/${noteId}/${randomUUID()}`;
}

async function uploadObject(objectPath, file) {
  const { error } = await getBucket().upload(objectPath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
    cacheControl: '3600'
  });

  if (error) {
    throw storageError('upload', error);
  }
}

async function deleteObject(objectPath) {
  if (!objectPath) {
    return;
  }

  const { error } = await getBucket().remove([objectPath]);
  if (error) {
    throw storageError('delete', error);
  }
}

async function createSignedUrl(objectPath, fileName, download) {
  const options = download ? { download: fileName } : { download: false };
  const { data, error } = await getBucket().createSignedUrl(objectPath, 60, options);

  if (error || !data?.signedUrl) {
    throw storageError('signed URL creation', error || new Error('The signed URL was missing.'));
  }

  return data.signedUrl;
}

module.exports = {
  createObjectPath,
  uploadObject,
  deleteObject,
  createSignedUrl
};
