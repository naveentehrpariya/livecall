const catchAsync  = require("../utils/catchAsync");
const Feature = require("../db/Feature");
const Testimonial = require("../db/Testimonial");
 
// FEATUTRES
exports.addFeature = catchAsync(async (req, res) => {
    const features =  await Feature.find({});
    // if (features && features.length == 4) {
    //   return res.status(200).json({ status: false, message: 'You can add only 4 features items.' });
    // }
    const { title, description } = req.body;
    const feature =  await Feature.create({
      title : title, 
      description : description,
    }); 
    
    await feature.save();
    res.json({
        status: true,
        message: 'Feature added successfully.'
    });
});

exports.editFeature = catchAsync(async (req, res) => {
  const { id, title, description } = req.body;
  const feature = await Feature.findByIdAndUpdate(id, {
    title,
    description
  }, { new: true });
  if (!feature) {
    return res.status(404).json({ status: false, message: 'Feature not found' });
  }
  res.json({
    status: true,
    message: 'Feature updated successfully',
    result: feature
  });
});

exports.deleteFeature = catchAsync(async (req, res) => {
  const { id } = req.params;
  const feature = await Feature.findByIdAndRemove(id);
  if (!feature) {
    return res.status(404).json({ message: 'Feature not found' });
  }
  res.json({
    status: true,
    message: 'Feature deleted successfully.'
  });
});

exports.allFeatures = catchAsync(async (req, res) => {
    const features =  await Feature.find({});
    if(features){ 
        res.json({ 
            status:true, 
            result: features
        });
    } else {  
        res.json({ 
            status:true,
            data: []
        }); 
    } 
}); 











// ===================  TESTIMONIALS  ==============================
exports.addTestimonial = catchAsync(async (req, res) => {
  const { name, description, avatar } = req.body;
  const testimonial =  await Testimonial.create({
    name : name,
    description : description,
    avatar : avatar
  });
  await testimonial.save();
  res.json({
      status: true,
      message: 'Testimonial added successfully.'
  });
});

exports.editTestimonial = catchAsync(async (req, res) => {
  const { id, name, avatar, description } = req.body;
  const testimonial = await Testimonial.findByIdAndUpdate(id, {
    name,
    avatar,
    description
  }, { new: true });
  if (!testimonial) {
    return res.status(404).json({ status: false, message: 'Testimonial not found' });
  }
  res.json({
    status: true,
    message: 'testimonial updated successfully',
    result: testimonial
  });
});

exports.deleteTestimonial = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await Testimonial.findByIdAndRemove(id);
  if (!result) {
    return res.status(404).json({ message: 'Testimonial not found' });
  }
  res.json({
    status: true,
    message: 'Testimonial deleted successfully.'
  });
});

exports.allTestimonial = catchAsync(async (req, res) => {
  const testimonials =  await Testimonial.find({});
  if(testimonials){ 
      res.json({ 
          status:true, 
          result: testimonials
      });
  } else {  
      res.json({ 
          status:true,
          data: []
      }); 
  } 
}); 


