const mongoose = require('mongoose');
const schema = new mongoose.Schema({
   token: { type:String },
   user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
   channel: { type:String },
   channel_name: { type:String },
   refresh_token : { type:String },
   createdAt: {
      type: Date,
      default: Date.now()     
   },
   status:{
      type: String,
      default: 'active'
   }
});

const Token = mongoose.model('tokens', schema);
module.exports = Token;

 