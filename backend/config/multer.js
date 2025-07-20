const multer = require('multer');
const AWS = require('aws-sdk');
console.log('AWS SDK version:', AWS.VERSION || AWS.VERSION_ID || 'unknown (v2 expected)');
const multerS3 = require('multer-s3');

require('dotenv').config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed!'), false);
  }
};

console.log('AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME);

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileExt = file.originalname.split('.').pop();
      cb(null, `pdfs/${file.fieldname}-${uniqueSuffix}.${fileExt}`);
    }
  }),
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

module.exports = { upload };
