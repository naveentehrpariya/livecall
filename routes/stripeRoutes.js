const express = require('express');
const router = express.Router();
const { validateToken } = require('../controllers/authController');
const { create } = require('../controllers/stripeController');

router.route('/update').patch(validateToken, create);
router.route('/delete').delete(validateToken, create);

module.exports = router;