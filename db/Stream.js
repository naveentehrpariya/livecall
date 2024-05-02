const mongoose = require('mongoose');
const validator = require('validator');

const schema = new mongoose.Schema({
    title: {
        type:String, 
        required:[true, 'Please enter your stream title.'],
        minLength:5,
    },
    resolution: {
        type:String,
        // required:[true, 'Please choose a resolution for your stream.'],
    },
    thumbnail: {
        type:String,
    },
    audio: {
        type:String,
    },
    video: {
        type:String,
    },
    streamkey: {
        required:[true, 'Please enter your stream key.'],
        type:String,
        minLength:10,
    },
    active : { 
        type:Boolean,
        default:true,
        select:false,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    createdAt: {
         type: Date,
         default: Date.now()     
   },
   endedAt : Date,
});


const Stream = mongoose.model('streams', schema);
module.exports = Stream;

 