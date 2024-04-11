const express = require('express');
const router = express.Router();
const { addproducts, listProducts, productDetail, tour_stats } = require(`../controllers/productsController`);
const { validateToken } = require('../controllers/authController');

// API ROUTES
router.route('').post(validateToken, addproducts).get(validateToken, listProducts);

router.route('/stats').get(validateToken, tour_stats);

router.route('/:id').get(validateToken, productDetail);

module.exports = router; 
