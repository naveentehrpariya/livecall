const mongoose = require('mongoose');
const validator = require('validator');

const schema = new mongoose.Schema({
   name: {
      type:String, 
      required:[true, 'Please enter name your pricing plan.'],
   },
   description: {
      type:String,
   },
   price: {
      type:Number,
   },
   priceId: {
      type:String,
   },
   productId: {
      type:String,
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
      default:'usd', 
   },
   recurring : {
      type:String,
      default:'month', 
   }
});


const Pricing = mongoose.model('pricings', schema);
module.exports = Pricing;

 