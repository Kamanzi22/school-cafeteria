const router = require('express').Router();
const multer = require('multer');
const { authStaff, blockViewer, requireManager } = require('../middleware/auth');
const { uploadImage } = require('../lib/supabaseStorage');

// SVGs deliberately excluded — they can carry embedded <script> and run it if the raw
// storage URL is ever opened directly, unlike raster formats.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({ storage: multer.memoryStorage(), limits:{ fileSize:5*1024*1024 }, fileFilter:(_,file,cb) => {
  ALLOWED_TYPES.includes(file.mimetype) ? cb(null,true) : cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed'));
}});

router.post('/', authStaff, blockViewer, requireManager, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success:false, error:'No file' });
  try {
    const url = await uploadImage(req.file);
    res.json({ success:true, data:{ url } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, error:'Upload failed' });
  }
});

module.exports = router;
