const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");
const Pricing = require("../db/Pricing");
const stripe = require('stripe')('sk_test_51OOc6oCmFHIIsmOruh6oLBJN6wovOPHpBVdGEMVWALcc3SAcR3nnMCgt9ot6juPR88y9jd3qwRBikBolxUUaz27R00TwiinahX');
const domainURL = process.env.DOMAIN_URL || "http://localhost:8080";

const create_pricing_plan = catchAsync ( async (req, res)=>{
    const isAlreadyExist = await Pricing.findOne({name:req.body.name});
    if(isAlreadyExist){
      return res.status(400).json({
        status:false,  
        error:'Pricing plan already exist.'
      });
    }

    const product_price = req.body.price;
    const product =  await stripe.products.create({
        name: req.body.name,
        description: req.body.description
    }); 

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: parseInt(product_price*100),
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    if(!price){
      res.status(400).json({
        status:false,
        plan : null,
        error:price
      });
    }

    const plan = new Pricing({
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      allowed_streams: req.body.allowed_streams,
      storage: req.body.storage,
      priceId: price.id,
      productId: price.product,
    });

    const result = await plan.save();
    if(result){ 
      res.status(200).json({ 
          status:true, 
          plan:result 
      })
    } else {  
      res.status(400).json({
          status:false,
          plan : null,
          error:result
      }); 
    } 
});

const subscribe = catchAsync ( async (req, res)=>{
  try {
      const plan = await Pricing.findOne({productId:req.body.productId});
      const productId = req.body.productId;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          { 
            price_data: {
              product : productId,
              unit_amount_decimal : parseInt(plan.price*100),
              currency: plan.currency || "usd",
              recurring : {
                interval : 'month',
                interval_count : 1,
              },
            },
            quantity: 1
          }
        ],
        success_url: `${domainURL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${domainURL}/canceled.html`,
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

const pricing_plan_lists = catchAsync ( async (req, res)=>{
  try {
    const items = await Pricing.find({});
    if(items){
      res.status(200).json({ 
        status:true, 
        items:items 
      })
    } else {
      res.status(400).json({ 
        status:false, 
        items:null 
      })
    }
  } catch(err){
    res.status(400).json({ 
      status:false, 
      error:err 
    })

  }
      
});

module.exports = { subscribe, create_pricing_plan, pricing_plan_lists } 
