const Products = require("../db/Products");
const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");
const stripe = require('.../../../db/Stripe');
// const stripe = require('stripe')('sk_test_51OOc6oCmFHIIsmOruh6oLBJN6wovOPHpBVdGEMVWALcc3SAcR3nnMCgt9ot6juPR88y9jd3qwRBikBolxUUaz27R00TwiinahX');

const createStripeCustomer = async (email, paymentMethodId = null) => {
  const customer = await stripe.customers.create({
    email: email
  });
  return customer;
};

const createStripeSubscription = async (customerId, priceId) => {
  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    expand: ['latest_invoice.payment_intent'],
  });
};

const create_pricing_plan = catchAsync ( async (req, res)=>{
    const product =  await stripe.products.create({
        name: "INDIAN_PRODUCT",
        description: "This is a test product.",
    }); 
    const product_price = "5000";
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: parseInt(product_price*100),
      currency: 'inr',
      recurring: { interval: 'month' },
    });
    console.log("price",price)
    if(product){ 
        res.status(200).json({ 
            status:true, 
            data:product 
        })
    } else {  
        res.status(400).json({
            error:product
        }); 
    } 
});


const subscribe = catchAsync ( async (req, res)=>{
  try {
      const domainURL = 'http://localhost:8080';
      const priceId = "price_1P698SSIg29rXj3yvGj39RS7";
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          { 
            price_data: {
              product : 'prod_Pw1AByYXlU0qtW',
              unit_amount_decimal : 5000*100,
              currency:"inr",
              recurring : {
                interval : 'month',
                interval_count : 1,
              },
            },
            quantity: 1
          }
        ],
        // ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
        success_url: `${domainURL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${domainURL}/canceled.html`,
        // automatic_tax: { enabled: true }
      });
      res.json({
        status:true,
        url: session.url,
      });
    } catch (e) {
      res.json({
        status:false,
        message: e.message,
      });
    }

    // const email = 'naveen@internetbusinesssolutionsindia.com';
    // const paymentMethodId = '';
    // let customer = await createStripeCustomer(email);
    // if (paymentMethodId) {
    //   await attachPaymentMethodToCustomer(customer.id, paymentMethodId);
    // }

    // const subscription = await createStripeSubscription(customer.id, priceId);
    // console.log("Subscription successful", subscription);

    // if(subscription){ 
    //     res.status(200).json({ 
    //         status:true, 
    //         subscription:subscription 
    //     });
    // } else {  
    //     res.status(400).json({
    //       status:false,
    //       error:subscription
    //     }); 
    // } 
});

module.exports = { subscribe, create_pricing_plan } 


// id: 'prod_Pw0VWsq30v7oZp',
// id: 'price_1P68U4SIg29rXj3yjj5rkV9A'