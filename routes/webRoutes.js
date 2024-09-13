const express = require('express');
const router = express.Router();
const webController = require('../controllers/webController');

router.route('/add-feature').post(webController.addFeature);
router.route('/edit-feature').post(webController.editFeature);
router.route('/remove-feature/:id').get(webController.deleteFeature);
router.route('/all-features').get(webController.allFeatures);


router.route('/add-testimonial').post(webController.addTestimonial);
router.route('/edit-testimonial').post(webController.editTestimonial);
router.route('/remove-testimonial/:id').get(webController.deleteTestimonial);
router.route('/all-testimonial').get(webController.allTestimonial);



module.exports = router;