const catchAsync = require("../utils/catchAsync");

const Razorpay = require('razorpay');
const razorpay = new Razorpay({
   key_id: 'rzp_test_ElU7Y74SgUTN2r',
   key_secret: '3WPNoyY8vtSWEOaYR80XNTXA'
});

exports.createPlan = async (req,res) => {
   try {
      console.log("razorpay",razorpay)
      const plan = await razorpay.plans.create({
         period: "monthly",
         interval: "1",
         item: { 
            name: "Test plan - Weekly",
            amount: "69900",
            currency: "INR",
            description: "Description for the test plan"
         },
         notes: {
            notes_key_1: "Tea, Earl Grey, Hot",
            notes_key_2: "Tea, Earl Grey… decaf."
         }
      });
      console.log('Plan Created:', plan);
   } catch (error) {
      console.error('Error creating plan:', error);
   }
};

const getCustomerByEmailOrContact = async (email, contact) => {
   try {
       const customers = await razorpay.customers.all();
       return customers.items.find(customer => 
           customer.email === email || customer.contact === contact
       );
   } catch (error) {
       console.error("Error fetching customers:", error);
       throw error;
   }
};

const getOrCreateCustomer = async (name, email, contact) => {
   try {
       const existingCustomer = await getCustomerByEmailOrContact(email, contact);
       if (existingCustomer) {
           console.log("Existing customer found:", existingCustomer);
           return existingCustomer.id;
       }
       const newCustomer = await razorpay.customers.create({
           name,
           email,
           contact
       });
       return newCustomer.id;
   } catch (error) {
       console.error("Error getting or creating customer:", error);
       return null
   }
};



exports.createSubscription = async (req, res) => {
   try {
      const customerID = getOrCreateCustomer("Naveen", 'naveen@internetbusinesssolutionsindia.com', '9813089043');
      const options = { 
         plan_id: req.body.plan_id,
         customer_id: customerID,
         total_count: 1200,
         start_at: Math.floor(Date.now() / 1000) + 300,
      };
      const subscription = await razorpay.subscriptions.create(options);
      res.json(subscription);
   } catch (error) {
      res.status(500).json({ error: error });
   }
};


// Webhook for Payment Success
// app.post('/webhook', (req, res) => {
//    const webhookSecret = 'YOUR_WEBHOOK_SECRET'; // Replace with your webhook secret
//    const crypto = require('crypto');

//    const generatedSignature = crypto.createHmac('sha256', webhookSecret)
//        .update(JSON.stringify(req.body))
//        .digest('hex');

//    if (generatedSignature === req.headers['x-razorpay-signature']) {
//        // Handle the event
//        console.log('Webhook verified:', req.body);
//        res.status(200).send('Webhook received');
//    } else {
//        res.status(403).send('Signature mismatch');
//    }
// });