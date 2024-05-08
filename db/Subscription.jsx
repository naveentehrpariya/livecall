const mongoose = require('mongoose');
const validator = require('validator');

const schema = new mongoose.Schema({
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'pricings' },
    status : { 
        type:Number,
        default:1, // 1-active 0-expired 2-cancelled
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    createdAt: {
         type: Date,
         default: Date.now()     
    },
    upcomingPayment : {
      type: Date,
    },
    endedAt : Date,
});


const Subscription = mongoose.model('subscriptions', schema);
module.exports = Subscription;

 