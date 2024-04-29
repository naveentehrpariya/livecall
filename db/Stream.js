const mongoose = require('mongoose');
const validator = require('validator');

const schema = new mongoose.Schema({
    title: {
        type:String, 
        required:[true, 'Please enter your stream title.'],
        minLength:5,
    },
    streamkey: {
        required:[true, 'Please enter your stream key.'],
        type:String,
        minLength:10,
    },
    resolution: {
        type:String,
        required:[true, 'Please choose a resolution for your stream.'],
    },
    thumbnail: {
        type:String,
    },
    active : { 
        type:Boolean,
        default:true,
        select:false,
    },
    createdAt: {
         type: Date,
         default: Date.now()     
   },
   endedAt : Date,
});


const Stream = mongoose.model('streams', schema);
module.exports = User;

 