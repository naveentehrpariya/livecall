const mongoose = require('mongoose');
const schema = new mongoose.Schema({
   name: { type:String },
   mime: {
        type:String,
   },
   size: { type:String },
   filename: { type:String },
   url: { type:String },
   user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
   createdAt: {
      type: Date,
      default: Date.now()     
   },
   deletedAt: {
      type: Date,
   },
});

const Files = mongoose.model('files', schema);
module.exports = Files;

 