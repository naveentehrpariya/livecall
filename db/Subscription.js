const mongoose = require('mongoose');
const validator = require('validator');

const schema = new mongoose.Schema({
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'pricings' },
    subscription_status : { 
        type:String,
    },
    status : { 
        type:String,
        default: 'pending', 
    },
    subscription_id : { 
        type:String,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    createdAt: {
         type: Date,
         default: Date.now()     
    },
    session_id : String,
    updatedAt: {
         type: Date,
    },
    upcomingPayment : {
      type: Date,
    },
    endedAt : Date,
});

// new Date(Date.now() + (1000 * 60 * 60 * 24 * 30))
const Subscription = mongoose.model('subscriptions', schema);
module.exports = Subscription;

 