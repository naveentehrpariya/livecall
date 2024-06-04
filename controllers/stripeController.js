const catchAsync  = require("../utils/catchAsync");
const Pricing = require("../db/Pricing");
const Subscription = require("../db/Subscription");
const User = require("../db/Users");
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
      resolutions : JSON.stringify(req.body.resolutions)
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

const update_pricing_plan = catchAsync(async (req, res) => {
  try {
    const plan = await Pricing.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        status: false,
        error: 'Pricing plan not found.',
      });
    }

    // Update Stripe product
    const product = await stripe.products.update(plan.productId, {
      name: req.body.name,
      description: req.body.description,
    });

    // Convert the existing and new prices to the same unit (cents) for comparison
    const existingPriceInCents = plan.price * 100;
    const newPriceInCents = parseInt(req.body.price * 100);

    let priceId = plan.priceId;
    if (existingPriceInCents !== newPriceInCents) {
      const newPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: newPriceInCents,
        currency: 'usd',
        recurring: { interval: 'month' },
      });

      if (!newPrice) {
        return res.status(400).json({
          status: false,
          plan: null,
          error: 'Error creating the new price.',
        });
      }
      await stripe.prices.update(plan.priceId, { active: false });
      priceId = newPrice.id;
    }

    // Update local database
    plan.name = req.body.name;
    plan.description = req.body.description;
    plan.price = req.body.price;
    plan.allowed_streams = req.body.allowed_streams;
    plan.storage = req.body.storage;
    plan.priceId = priceId;
    plan.resolutions = JSON.stringify(req.body.resolutions)

    const result = await plan.save();

    if (result) {
      return res.status(200).json({
        status: true,
        message: "Pricing plan has been updated.",
        plan: result,
      });
    } else {
      return res.status(400).json({
        status: false,
        plan: null,
        error: 'Error saving the updated plan.',
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
      error: error
    });
  }
});

const disable_pricing_plan = catchAsync(async (req, res) => {
  try {
    const plan = await Pricing.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        status: false,
        error: 'Pricing plan not found.',
      });
    }
    if(plan.status == "active"){
      plan.status = "inactive";
    } else { 
      plan.status = "active";
    }
    const result = await plan.save();

    if (result) {
      return res.status(200).json({
        status: true,
        message: `Pricing marked as ${result.status}.`,
        plan: result,
      });
    } else {
      return res.status(400).json({
        status: false,
        plan: null,
        error: 'Something went wrong in plan saving.',
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
      error: error
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
        upcomingPayment: new Date(Date.now() + (1000 * 60 * 60 * 24 * 30)),
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
        success_url: `${domainURL}/subscription/success/${subcription._id}`,
        cancel_url: `${domainURL}/subscription/cancel/${subcription._id}`,
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
    const items = await Pricing.find({ status : "active"});
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
    });
  }
});

const planDetail = catchAsync ( async (req, res)=>{
  try {
    const {id} = req.params;
    const item = await Pricing.findById(id);
    if(item){
      res.status(200).json({ 
        status:true, 
        plan:item 
      })
    } else {
      res.status(400).json({ 
        status:false, 
        item:null 
      })
    }
  } catch(err){
    res.status(400).json({ 
      status:false, 
      error:err 
    });
  }
});

const my_subscriptions = catchAsync ( async (req, res)=>{
  try {
    const items = await Subscription.findOne({user : req.user._id}).populate('plan').sort({createdAt: -1});
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
    if(!item) {
      res.status(400).json({
        status:false,
        message:"Subscription not found."
      });
      return;
    }
    const sessionId = item.session_id;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if(session && session.id) {
      if(session.subscription && session.payment_status === 'paid'){
        const subscriptionData = await stripe.subscriptions.retrieve(session.subscription);
        const endDate = subscriptionData.current_period_end;
        await User.findByIdAndUpdate(req.user._id, { plan: item.plan });
        const currentSubscription = await Subscription.findOne({ user: req.user._id, status: 'paid' });
        if (currentSubscription) {
          await Subscription.findByIdAndUpdate(currentSubscription._id, { status: 'inactive' });
        }
        item.upcomingPayment = new Date(endDate*1000);
        item.status = session.payment_status;
        item.subscription_id = session.subscription;
  
        const updated = await item.save();
        if(updated) {
          res.status(200).json({
            status:true,
            message:"Payment has been completed successfully",
          });
        } else {
          res.status(400).json({
            status:false,
            message:"Subscription payment failed.",
            error : updated
          });
        }
      } else {
        res.status(400).json({
          status:false,
          message:"Your payment has been failed."
        });
      }
    } else {
      res.status(400).json({
        status:false,
        message:"Session not found."
      });
    }
  } catch(err) {
    res.status(400).json({
      status:false,
      message:"Something went wrong.",
      error:err
    });
  }
});

const cancelSubscription = catchAsync(async (req, res) => {
  try {
    const mysub = await Subscription.findOne({status : "paid"});
    if(!mysub){
      res.json({
        status:false,
        message: "No active subscription found on this account."
      });
    }
    const deletedSubscription = await stripe.subscriptions.cancel(mysub.subscription_id);
    if(deletedSubscription.status === 'canceled'){
      mysub.status = 'canceled'
      mysub.cancelledAt =  Date.now();
      await mysub.save();
      res.status(200).json({
        status : true,
        message :"Your subscription has been cancelled."
      });
    } else {
      res.status(400).json({
        status : false,
        message :"Failed to cancel your subscription."
      });
    }
  } catch (error) {
    res.status(500).json({ 
      status : false,
      message :"Something went wrong",
      error: error.message
     });
  }
});

const subscriptionWebhook = catchAsync(async (req, res) => {
    const sig = request.headers['stripe-signature'];
    const endpointSecret = 'whsec_N2BVT5rKy71GaFpWXSC5q59Gi1wSFRIV'
    let event;
    console.log("webhook called")
  
    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
  
    console.log("event.type",event.type)
    // Handle the event
    switch (event.type) {
      case 'invoice.updated':
        const invoiceUpdated = event.data.object;
        console.log("invoiceUpdated",invoiceUpdated)
        break;
      case 'invoice.created':
        const invoiceCreated = event.data.object;
        console.log("invoiceUpdated",invoiceCreated)
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  
    // Return a 200 response to acknowledge receipt of the event
    response.send();
  });

  


module.exports = { planDetail, cancelSubscription, disable_pricing_plan, confirmSubscription, subscribe, create_pricing_plan, pricing_plan_lists, my_subscriptions, subscriptionWebhook, update_pricing_plan } 
