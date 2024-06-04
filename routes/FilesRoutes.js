const express = require('express');
const router = express.Router();
const multer = require('multer');
const { myMedia, deleteMedia, uploadMedia } = require('../controllers/fileController');
const { validateToken } = require('../controllers/authController');

// const multerParse = multer({
//   dest: "uploads/",
//   limits: {
//    fileSize: 1024 * 1024 * 50 // 50MB
//  }
// });

router.route('/my-media/:type').get(validateToken, myMedia);
router.route('/delete/media/:id').get(validateToken, deleteMedia);
// router.route('/cloud/upload').post(validateToken,  multerParse.fields([{ name: "attachment" }]), uploadMedia);

module.exports = router; 

