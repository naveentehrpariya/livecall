const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");
const Pricing = require("../db/Pricing");
const Subscription = require("../db/Subscription");
const stripe = require('stripe')(process.env.STRIPE_KEY);
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
      const productId = req.body.productId;
      const plan = await Pricing.findOne({productId:productId});
      if(!plan){
        res.json({
          status:false,
          message: "Subscription plan not found.",
        });
      }
      const subcription = new Subscription({
        plan: plan._id,
        user: req.user._id,
        updatedAt: Date.now(),     
        upcomingPayment: new Date(Date.now() + (1000 * 60 * 60 * 24 * 30)), // 30 days from now
      });
      await subcription.save();

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
        success_url: `${domainURL}/success?subscription_id=${subcription._id}`,
        cancel_url: `${domainURL}/canceled?subscription_id=${subcription._id}`,
      }); 

      subcription.session_id = session.id;
      await subcription.save();

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


const my_subscriptions = catchAsync ( async (req, res)=>{
  try {
    const items = await Subscription.find({user : req.user._id}).populate('user').populate('plan').sort({createdAt: -1});
    if(items){
      res.status(200).json({ 
        status:true, 
        subscriptions:items 
      })
    } else {
      res.status(400).json({ 
        status:false, 
        subscriptions:null 
      })
    }
  } catch(err){
    res.status(400).json({ 
      status:false, 
      error:err 
    })

  }
      
});


const confirmSubscription = catchAsync ( async (req, res)=>{
  try {
    const item = await Subscription.findById(req.body.id);
    if(req.body.status == 'success'){
      item.status = 1;
    } 
    else {
      item.status = 2;
      item.upcomingPayment = null;
    }
    const updated = await item.save();
    if(updated){
      res.status(200).json({ 
        status:true, 
        message:"Payment has been completed successfully" 
      })
    } else {
      res.status(400).json({ 
        status:false, 
        message:"Subscription payment failed." ,
        error : updated
      })
    }
  } catch(err){
    res.status(400).json({ 
      status:false, 
      message:"Something went wrong Susbcription payment failed.",
      error:err 
    })
  }
});

module.exports = { confirmSubscription, subscribe, create_pricing_plan, pricing_plan_lists, my_subscriptions } 
