const mongoose = require('mongoose');
const schema = new mongoose.Schema({
   name: { 
      type:String,
      required: [true, "Name can not be empty."],
    },
   email: { 
      type:String,
      required: [true, "Email address is required"],
    },
   message : { 
      type:String,
      required: [true, "Can not send empty request."],
    },
   createdAt: {
      type: Date,
      default: Date.now()     
   },
});
const Inquiry = mongoose.model('inquiries', schema);
module.exports = Inquiry;

 