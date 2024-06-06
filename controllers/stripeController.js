const cron = require('node-cron');
const catchAsync  = require("../utils/catchAsync");
const Pricing = require("../db/Pricing");
const Subscription = require("../db/Subscription");
const User = require("../db/Users");
const logger = require("../utils/logger");
const stripe = require('stripe')(process.env.STRIPE_KEY);
const domainURL = process.env.DOMAIN_URL;
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
        upcomingPayment: null,
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
        } 
      ); 
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
          await stripe.subscriptions.cancel(currentSubscription.subscription_id);
        } 
        item.upcomingPayment = new Date(endDate*1000);
        item.status = session.payment_status;
        item.subscription_id = session.subscription;
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

  const endpointSecret = process.env.SUSBCRIPTION_RENEW_SECRET ;
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  switch (event.type) {
    case 'customer.subscription.deleted':
      const customerDeleted = event.data.object;
      const currentSubscription = await Subscription.findOne({ subscription_id : customerDeleted.id, status:"paid" });
      if (currentSubscription) {
        await Subscription.findByIdAndUpdate(currentSubscription._id, { status: 'inactive', updatedAt:Date.now()});
      }
      logger(`Subscription DELETED !!`);
      logger(customerDeleted);
      console.log(`Subscription ${customerDeleted.id} DELETED !!`);
      break;
    case 'invoice.payment_failed':
      const failedSubscription = event.data.object;
      const currentActive = await Subscription.findOne({ subscription_id : failedSubscription.id});
      if (currentActive) {
        await Subscription.findByIdAndUpdate(currentActive._id, { status:'canceled', cancelledAt:Date.now(), updatedAt:Date.now()});
      }
      logger(`Subscription DELETED !!`);
      logger(failedSubscription);
      console.log(`Subscription ${failedSubscription.id} payment_failed !!`);

      break;
    case 'invoice.updated':
      console.log("INVOICE updated");
      break;
    case 'invoice.payment_succeeded':
      const srenew = event.data.object;
      console.log("INVOICE payment succecceed");
      const renewedId = srenew.id;
      if(srenew.billing_reason === 'subscription_cycle'){
        const current = await Subscription.findOne({ subscription_id : renewedId});
        if (current){ await Subscription.findByIdAndUpdate(current._id, { status:'inactive', updatedAt:Date.now()})}
        const newsubcription = new Subscription({
          plan: current.plan,
          user: current.user,
          createdAt: Date.now(),
          upcomingPayment : new Date(srenew.period_end*1000), 
          status : srenew.status,
          subscription_id : renewedId,
          session_id : current.session_id
        });
        await newsubcription.save();
      } else {
        const current = await Subscription.findOne({ subscription_id : renewedId, status : "pending"});
        if (current){
          await Subscription.findByIdAndUpdate(renewedId._id, { 
            status:'paid', 
            updatedAt:Date.now(),
            subscription_id : renewedId,
            upcomingPayment : new Date(srenew.period_end*1000), 
          });
        }
      }
      logger(`Subscription renewed !!`);
      logger(srenew);
      console.log(`Subscription ${renewedId} payment_failed !!`);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  res.send({ received: true });
});

const checkPendingSubscriptions = async () => {
  try {
    const pendingSubscriptions = await Subscription.find({ status: 'pending' });
    for (const sub of pendingSubscriptions) {
      const session = await stripe.checkout.sessions.retrieve(sub.session_id);
      if (session && session.payment_status === 'paid') {
        const subscriptionData = await stripe.subscriptions.retrieve(session.subscription);
        const endDate = subscriptionData.current_period_end;
        await User.findByIdAndUpdate(sub.user, { plan: sub.plan });
        const currentSubscription = await Subscription.findOne({ user: sub.user, status: 'paid' });
        if (currentSubscription) {
          await stripe.subscriptions.cancel(currentSubscription.subscription_id);
        }
        sub.upcomingPayment = new Date(endDate * 1000);
        sub.status = session.payment_status;
        sub.subscription_id = session.subscription;
        await sub.save();
        logger(`Subscription ${sub._id} marked as paid.`);
      } else {
        sub.status = 'payment_failed';
        await sub.save();
        logger(`Subscription ${sub._id} payment failed.`);
      }
    }
  } catch (error) {
    logger(`Error checking pending subscriptions: ${error.message}`);
  }
};

cron.schedule('0 * * * *', () => {
  logger('Running checkPendingSubscriptions cron job');
  checkPendingSubscriptions();
});

module.exports = { planDetail, cancelSubscription, disable_pricing_plan, confirmSubscription, subscribe, create_pricing_plan, pricing_plan_lists, my_subscriptions, subscriptionWebhook, update_pricing_plan } 
