const catchAsync = require("../utils/catchAsync");
const Razorpay = require('razorpay');
const crypto = require('crypto');


const SECRET = 'iAXYM7PgI2N39SGftJvS8w61';
const razorpay = new Razorpay({
   key_id: 'rzp_test_VinUdGDTgOGzJE',
   key_secret: SECRET
});

const domain = process.env.DOMAIN_URL
exports.createOrder = catchAsync (async (req,res) => {
   const { amount, currency = 'INR', description } = req.body;
   const options = {
      amount: amount * 100, // Amount in smallest currency unit (e.g., paise for INR)
      currency: currency,
      description: description,
      customer: {
         email: req.user.email,
      },
      notify: {
         email: true, // Send email notification to customer
         sms: true,   // Send SMS notification to customer (if phone is provided)
      },
      notes: {
         userId: req.user._id,      // Add user ID or any other identifier
         userEmail: req.user.email // Add user email
      },
      callback_url: `${domain}/payment/status`, // Redirect URL after payment
      callback_method: 'get', 
   };
   try {
      const paymentLink = await razorpay.paymentLink.create(options);
      res.json({
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
     if (event === 'payment.captured') {
       // Extract user information from the notes field
         const payment = req.body.payload.payment.entity;
         console.log("webhook payment",payment)
     }
     res.json({ status: 'ok' });
   } else {
     res.status(400).send('Invalid signature');
   }
});