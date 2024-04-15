const Products = require("../db/Products");
const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");
const stripe = require('.../../../db/Stripe');
// const stripe = require('stripe')('sk_test_51O5itNSIg29rXj3yBHirQ8SqBJljWoFncjyaOhEFRQceT83RK26srCwS88OkzYgSo68C1cOzWlk10VBOrT7k6XlV006Js6CHHl');

const email = 'naveen@internetbusinesssolutionsindia.com';

 
// Function to create a Stripe price for the product
const createStripePrice = async (productId, unitAmount, currency = 'usd', recurring) => {
  const data = await stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency: currency,
    recurring: recurring,
  });
  console.log("data();",data)
  return data
};

// createStripePrice();

// Enhanced subscribe function to use a priceId directly
const subscribeToPlan = async (email, paymentMethodId, priceId) => {
  // Create a new Stripe customer or retrieve existing one
  let customer = await createStripeCustomer(email, paymentMethodId);

  // Attach the payment method to the customer (if provided)
  if (paymentMethodId) {
    await attachPaymentMethodToCustomer(customer.id, paymentMethodId);
  }

  // Create a subscription for the customer using the priceId
  const subscription = await createStripeSubscription(customer.id, priceId);

  console.log("Subscription successful", subscription);
};


const getAllSubscriptions = async () => {
  const subscriptions = await stripe.subscriptions.list();
  console.log("subscriptions",subscriptions)
};

getAllSubscriptions();



const create_subscription = catchAsync ( async (req, res)=>{
    
    const product =  await stripe.products.create({
        name: "TEST PRODUCT __0001",
        description: "This is a test product.",
    });

    const updated = Object.assign( {user_id:5}, req.body );
    // const product = await Products.create(updated);
    // if(product){ 
    //     res.status(200).json({ 
    //         status:true, 
    //         data:product 
    //     });
    // } else {  
    //     res.status(400).json({
    //         error:product
    //     }); 
    // } 
});

const subscribe = catchAsync ( async (req, res)=>{
  const updated = Object.assign( {user_id:5}, req.body );
  const product = await Products.create(updated);
  if(product){ 
      res.status(200).json({ 
          status:true, 
          data:product 
      });
  } else {  
      res.status(400).json({
          error:product
      }); 
  } 
});
 
module.exports = { subscribe, create_subscription } 