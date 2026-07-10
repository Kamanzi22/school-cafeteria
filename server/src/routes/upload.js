const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authStaff } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
});

const upload = multer({ storage, limits:{ fileSize:5*1024*1024 }, fileFilter:(_,file,cb) => {
  file.mimetype.startsWith('image/') ? cb(null,true) : cb(new Error('Images only'));
}});

router.post('/', authStaff, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success:false, error:'No file' });
  res.json({ success:true, data:{ url:`/uploads/${req.file.filename}` } });
});

module.exports = router;
