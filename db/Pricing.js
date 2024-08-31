const mongoose = require('mongoose');
const validator = require('validator');

const schema = new mongoose.Schema({
   name: {
      type:String, 
      required:[true, 'Please enter name your pricing plan.'],
   },
   resolutions: {
      type:String,
   },
   description: {
      type:String,
   },
   price: {
      type:Number,
   },
   allowed_streams: {
      type:Number,
   },
   storage: {
      type:String,
   },
   createdAt: {
      type: Date,
      default: Date.now()     
   },
   currency:{
      type:String,
      default:'USD', 
   },
   status : {
      type:String,
      default:'active',
   },
   duration : {
      type:String,
      default:1,
   },
   duration_title : {
      type:String,
      default:'monthly',
   },
});

const Pricing = mongoose.model('pricings', schema);
module.exports = Pricing;

 