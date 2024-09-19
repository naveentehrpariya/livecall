const mongoose = require('mongoose');
const validator = require('validator');

const schema = new mongoose.Schema({
    title: {
        type:String, 
        required:[true, 'Please enter your stream title.'],
    },
    stream_type: String,
    resolution:String,
    thumbnail: String,
    audio:String,
    video: String,
    radio: String,
    status: {
        type:Number,
        default:1,
    },
    platformtype: String,
    stream_url: String,
    streamkey: String,
    streamId: String,
    ordered: {
        type:Boolean,
        default:true,
    },
    description: String,
    playlistId: String,
    active : { 
        type:Boolean,
        default:true,
        select:false,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    createdAt: Date,
    updatedAt: Date,
    endedAt : Date,
});


const Stream = mongoose.model('streams', schema);
module.exports = Stream;

 