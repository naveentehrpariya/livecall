const catchAsync = require("../utils/catchAsync");
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Pricing = require("../db/Pricing");
const User = require("../db/Users");
const Subscription = require("../db/Subscription");
const logger = require("../utils/logger");
const axios = require('axios');
const domain = process.env.DOMAIN_URL;

const SECRET = process.env.RAJORPAY_SECRET
const razorpay = new Razorpay({
   key_id: process.env.RAJORPAY_ID,
   key_secret: SECRET
});

async function getExchangeRates(baseCurrency) {
   const apiKey = process.env.EXCHANGE_RATE_KEY;
   const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`
   try {
       const response = await axios.get(url);
       console.log("response",response)
       if(response.data && response.data.conversion_rates){
         return response.data.conversion_rates
       } else { 
          return {
            USD: 1,
         }
       }
   } catch (error) {
       console.log('Error fetching exchange rates:', error);
   }
}

async function convertCurrency(amount, fromCurrency, toCurrency) {
   try {
       const rates = await getExchangeRates(fromCurrency);
       const conversionRate = rates[toCurrency];
       console.log("conversionRate", conversionRate);

       // Properly handle undefined or invalid rates
       if (!conversionRate) {
         console.log('Invalid or missing conversion rate, using a default.');
         return {
            amount: amount,
            convertedAmount: amount * 100, // Fallback, assuming no conversion
          }; 
       }

       // Convert the amount using the correct conversion rate
       const convertedAmount = amount * conversionRate;
       return {
         amount: amount, 
         convertedAmount: convertedAmount,
         rate: conversionRate
       };
   } catch (error) {
       console.log('Error converting currency:', error);
   }
}


exports.createOrder = catchAsync(async (req, res) => {
   console.log("req.body", req.body);
   let duration = req.body.duration || 1;
   let currency =  req.body.currency;
   const id = req.body.id;
   const plan = await Pricing.findById(id);
   let lastprice = (plan.price * 100)* parseInt(duration);
   
   if (currency !== plan.currency) {
      const result = await convertCurrency(plan.price, plan.currency, currency);
      console.log("CURRENCY CONVERTED", result);
      if(result&& result.convertedAmount){
         lastprice = result.convertedAmount * 100;
      } else { 
         lastprice = plan.price * 100;
         currency = 'USD'
      }
   }
   const options = {
      amount: Math.round(lastprice),
      currency: currency || 'USD', 
      description: plan.description,
      customer: {
         email: req.user.email,
      },
      notify: {
         email: true,
         sms: true,
      },
      notes: {
         duration: duration,
         userId: req.user._id,
         userEmail: req.user.email,
         planID: id
      },
      callback_url: `${domain}/payment/status`,
      callback_method: 'get', 
   };

   try {
      const paymentLink = await razorpay.paymentLink.create(options);
      res.json({
         status: true,
         id: paymentLink.id,
         short_url: paymentLink.short_url,
         amount: paymentLink.amount, 
      });
   } catch (error) {
      console.error('Error creating payment link:', error);
      res.status(500).json({ status:false, error: 'Failed to create payment link.' });
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
         const duration = parseInt(payment.notes.planID);

         const ishaveAlreadySubscription = await Subscription.findOne({user: user._id, status: 'active'});
         console.log("ishaveAlreadySubscription",ishaveAlreadySubscription);
         if(ishaveAlreadySubscription){
            ishaveAlreadySubscription.status = 'inactive';
            await ishaveAlreadySubscription.save();
         }
         
         const endDate = endOnDate.setMonth(endOnDate.getMonth() + duration)
         const subcription = new Subscription({
            plan: plan._id,
            status: 'active',
            duration: duration,
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


