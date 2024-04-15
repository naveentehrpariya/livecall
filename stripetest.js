const express = require('express');
const app = express();
const morgan = require('morgan')
app.use(morgan('dev')); 
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const globalErrorHandler = require("./middlewares/gobalErrorHandler");
const errorHandler = require("./middlewares/errorHandler");
const cors = require('cors');
const AppError = require('./utils/AppError');
require('./db/config');
// MIDDLE-WARES 
app.use(cors()); 
app.use(express.json()); 
app.use(errorHandler);  
app.use(globalErrorHandler); 
const catchAsync  = require(".//utils/catchAsync");

const stripe = require('stripe')('sk_test_51O5itNSIg29rXj3yBHirQ8SqBJljWoFncjyaOhEFRQceT83RK26srCwS88OkzYgSo68C1cOzWlk10VBOrT7k6XlV006Js6CHHl');
const email = 'naveen@internetbusinesssolutionsindia.com';

// Function to create a Stripe product
const createStripeProduct = async (name, description) => {
  const data =  await stripe.products.create({
    name: "TEST PRODUCT __0001",
    description: "This is a test product.",
  });
  console.log("createStripeProduct();",data)
  return data

};
createStripeProduct();

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








app.all('*', (req, res, next) => { 
    next(new AppError("Endpoint not found !!", 404    ));         
});
app.get('/', (req, res)=>{ 
  res.send({
      status:"Active",  
      Status :200
  });   
}); 

const port = 8080;
app.listen(port, ()=>{ console.log(`On PORT ${port} SERVER RUNNINGGGGG.....`) });



