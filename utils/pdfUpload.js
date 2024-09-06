const multer  = require('multer');

const acceptedFileTypes = [
    'application/pdf'
]

const upload = multer({ 
    // dest: 'uploads/',
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!acceptedFileTypes.includes(file.mimetype)) {
          return cb(new Error('Only Pdf Allowed!'))
        }
        cb(null, true)
    }
})

module.exports = upload