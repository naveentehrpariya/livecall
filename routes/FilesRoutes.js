const express = require('express');
const router = express.Router();
const multer = require('multer');
const { myMedia, deleteMedia, totalFileUploaded } = require('../controllers/fileController');
const { validateToken } = require('../controllers/authController');

router.route('/my-media/:type').get(validateToken, myMedia);
router.route('/delete/media/:id').get(validateToken, deleteMedia);
router.route('/total-uploaded-size').get(validateToken, totalFileUploaded);
// router.route('/cloud/upload').post(validateToken,  multerParse.fields([{ name: "attachment" }]), uploadMedia);

module.exports = router; 

