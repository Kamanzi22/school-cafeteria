const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BUCKET = 'restaurant-images';

// Uploads a multer memory-storage file to Supabase Storage and returns its public URL.
async function uploadImage(file) {
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(key, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

module.exports = { uploadImage };
