const cron = require('node-cron');
const catchAsync  = require("../utils/catchAsync");
const Pricing = require("../db/Pricing");
const Subscription = require("../db/Subscription");
const User = require("../db/Users");
const logger = require("../utils/logger");
const domainURL = process.env.DOMAIN_URL;

exports.create_pricing_plan = catchAsync ( async (req, res)=>{
    const isAlreadyExist = await Pricing.findOne({name:req.body.name});
    if(isAlreadyExist){
      return res.status(400).json({
        status:false,  
        error:'Pricing plan already exist.'
      });
    }
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
      resolutions : JSON.stringify(req.body.resolutions),
      duration : req.body.duration || 1,
      duration_title : req.body.duration_title
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

exports.update_pricing_plan = catchAsync(async (req, res) => {
  try {
    const plan = await Pricing.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        status: false,
        error: 'Pricing plan not found.',
      });
    }
    plan.name = req.body.name;
    plan.description = req.body.description;
    plan.price = req.body.price;
    plan.allowed_streams = req.body.allowed_streams;
    plan.storage = req.body.storage;
    plan.resolutions = JSON.stringify(req.body.resolutions)
    plan.duration = req.body.duration;
    plan.duration_title = req.body.duration_title;
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

exports.disable_pricing_plan = catchAsync(async (req, res) => {
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

exports.pricing_plan_lists = catchAsync ( async (req, res)=>{
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

exports.planDetail = catchAsync ( async (req, res)=>{
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

exports.my_subscriptions = catchAsync ( async (req, res)=>{
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

exports.cancelSubscription = catchAsync(async (req, res) => {
  try {
    const mysub = await Subscription.findOne({status : "paid"});
    if(!mysub){
      res.json({
        status:false,
        message: "No active subscription found on this account."
      });
    }
    mysub.status = 'canceled'
    mysub.cancelledAt =  Date.now();
    await mysub.save();
    res.status(200).json({
      status : true,
      message :"Your subscription has been cancelled."
    });
  } catch (error) {
    res.status(500).json({ 
      status : false,
      message :"Something went wrong",
      error: error.message
     });
  }
});
 
cron.schedule('0 * * * *', () => {
  logger('Running checkPendingSubscriptions cron job');
});
 
