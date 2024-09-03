const multer  = require('multer');

const acceptedFileTypes = [
    'application/pdf'
]

const upload = multer({ 
    // dest: 'uploads/',
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (!acceptedFileTypes.includes(file.mimetype)) {
          return cb(new Error('Only Pdf Allowed!'))
        }
        cb(null, true)
    }
})

module.exports = upload