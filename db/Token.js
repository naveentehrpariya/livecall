const mongoose = require('mongoose');
const schema = new mongoose.Schema({
   token: { type:String },
   user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
   channel: { type:String },
   createdAt: {
      type: Date,
      default: Date.now()     
   },
});

const Token = mongoose.model('tokens', schema);
module.exports = Token;

 