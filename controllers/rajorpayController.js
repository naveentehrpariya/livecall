const catchAsync = require("../utils/catchAsync");
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Pricing = require("../db/Pricing");
const User = require("../db/Users");
const Subscription = require("../db/Subscription");
const logger = require("../utils/logger");

const SECRET = 'iAXYM7PgI2N39SGftJvS8w61';
const razorpay = new Razorpay({
   key_id: 'rzp_test_VinUdGDTgOGzJE',
   key_secret: SECRET
});

const domain = process.env.DOMAIN_URL;
exports.createOrder = catchAsync (async (req,res) => {
   const { currency = 'INR' } = req.body;
   const id = req.body.id;
   const plan = await Pricing.findById(id);
   const options = {
      amount: plan.price * 100,
      currency: currency,
      description: plan.description,
      customer: {
         email: req.user.email,
      },
      notify: {
         email: true,
         sms: true,
      },
      notes: {
         userId: req.user._id,
         userEmail: req.user.email,
         planID:id
      },
      callback_url: `${domain}/payment/status`,
      callback_method: 'get', 
   };
   try {
      const paymentLink = await razorpay.paymentLink.create(options);
      res.json({
         status:true,
         id: paymentLink.id,
         short_url: paymentLink.short_url,
         amount: paymentLink.amount, 
      });
   } catch (error) {
      res.status(500).json({ error: error });
   }
});

exports.paymentWebhook = catchAsync (async (req,res) => {
   const shasum = crypto.createHmac('sha256', SECRET);
   shasum.update(JSON.stringify(req.body));
   const digest = shasum.digest('hex');
   if (digest === req.headers['x-razorpay-signature']) {
     const event = req.body.event;
     if (req.body.payload && event === 'payment.captured'){
         const payment = req.body.payload.payment.entity;
         console.log("webhook payment",payment);
         logger(JSON.stringify(payment));
         const user = await User.findById(payment.notes.userId);
         const plan = await Pricing.findById(payment.notes.planID);

         const endOnDate = new Date();
         const duration = parseInt(plan.duration);

         const ishaveAlreadySubscription = await Subscription.findOne({user: user._id, status: 'active'});
         console.log("ishaveAlreadySubscription",ishaveAlreadySubscription)
         if(ishaveAlreadySubscription){
            ishaveAlreadySubscription.status = 'inactive';
            await ishaveAlreadySubscription.save();
         }
         
         const endDate = endOnDate.setMonth(endOnDate.getMonth() + duration)
         const subcription = new Subscription({
            plan: plan._id,
            status: 'active',
            user: user._id,
            updatedAt: Date.now(),
            endOn: endDate,
         });

         user.plan_end_on = endDate;
         user.plan = plan._id;
         await user.save();
         await subcription.save();
     } else { 
        logger('WEBHOOK NOT WORKING');
         logger(JSON.stringify(event));
     }
     res.json({ status: 'ok' });
   } else {
     res.status(400).send('Invalid signature');
   }
});


