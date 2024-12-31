const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadMedia, myMedia, deleteMedia, totalFileUploaded, restStreamLimit } = require('../controllers/fileController');
const { validateToken } = require('../controllers/authController');
const { checkUploadLimit } = require('../controllers/fileController');

const upload = multer({ dest: 'uploads/' });
router.route('/my-media/:type').get(validateToken, myMedia);
router.route('/delete/media/:id').get(validateToken, deleteMedia);
router.route('/total-uploaded-size').get(validateToken, totalFileUploaded);
router.route('/restStreamLimit').get(validateToken, restStreamLimit);
router.route('/cloud/upload').post(validateToken,  upload.single('file'), checkUploadLimit, uploadMedia);

module.exports = router; 

