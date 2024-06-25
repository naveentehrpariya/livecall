const mongoose = require('mongoose');
const validator = require('validator');

const schema = new mongoose.Schema({
    title: {
        type:String, 
        required:[true, 'Please enter your stream title.'],
    },
    stream_type: {
        type:String, 
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
    radio: {
        type:String,
    },
    status: {
        type:Number,
        default:1,
    },
    stream_url: {
        type:String,
    },
    streamkey: {
        type:String,
    },
    streamId: {
        type:String,
    },
    ordered: {
        type:Boolean,
        default:true,
    },
    description: {
        type:String,
    },
    playlistId: {
        type:String,
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

 