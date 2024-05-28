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
          await Subscription.findByIdAndUpdate(currentSubscription._id, { subscription_status: 'inactive' });
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

const subscriptionRenew = catchAsync(async (req, res) => {
  try {
    const currentSubscription = await Subscription.findOne({ user: req.user._id, status: 'paid' }).populate('plan');

    if (!currentSubscription) {
      return res.status(400).json({
        status: false,
        message: "No active subscription found."
      });
    } 
    
    const currentProduct = await stripe.products.retrieve(currentSubscription.plan.productId);

    if (!currentProduct) {
      return res.status(400).json({
        status: false,
        message: "Product not found."
      });
    }

    const newProduct = await stripe.products.retrieve(currentProduct.default_price.product);
    if (!newProduct) {
      return res.status(400).json({
        status: false,
        message: "New product not found."
      });
    }

    const subscription = await stripe.subscriptions.retrieve(currentSubscription.subscription_id);
    console.log("subscription",subscription)

    if (!subscription) {
      return res.status(400).json({
        status: false,
        message: "Subscription not found."
      });
    }

    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      items: [{
        price: newProduct.default_price.id,
        quantity_mode: 1
      }]
    });

    if (!updatedSubscription) {
      return res.status(400).json({
        status: false,
        message: "Failed to update subscription."
      });
    }

    const updatedSubscriptionItem = updatedSubscription.data.items.data.find(item => item.price === newProduct.default_price.id);

    if (!updatedSubscriptionItem) {
      return res.status(400).json({
        status: false,
        message: "Failed to update subscription."
      });
    }

    const updatedSubscriptionPlan = await Pricing.findOne({ productId: newProduct.id });

    if (!updatedSubscriptionPlan) {
      return res.status(400).json({
        status: false,
        message: "Failed to update subscription plan."
      });
    }

    await Subscription.findByIdAndUpdate(currentSubscription._id, {
      plan: updatedSubscriptionPlan._id,
      subscription_status : 'renewed',
    });

    // Update the user's upcoming payment date
    const currentUser = await User.findById(req.user._id);
    if (updatedSubscription.current_period_end && currentUser.upcomingPayment) {
      const updatedPaymentDate = new Date(updatedSubscription.current_period_end * 1000);
      await User.findByIdAndUpdate(req.user._id, {
        upcomingPayment: updatedPaymentDate
      });
    }
    await subscriptionRenew(req, res);

  } catch (error) {
    res.status(400).json({
      status: false,
      message: "Failed to renew subscription."
    });
  }
});
  
module.exports = { disable_pricing_plan, confirmSubscription, subscribe, create_pricing_plan, pricing_plan_lists, my_subscriptions, subscriptionRenew, update_pricing_plan } 
