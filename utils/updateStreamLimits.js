const Subscription = require("../db/Subscription");
const User = require("../db/Users");

const updateStreamLimit = async (userId) => {
  try {
   const user = await User.findById(userId);
   const subscriptions = await Subscription.find({ user: userId, status: 'active' });
   let allowedResolutions = user && user.allowed_resolutions || [];
   let streamLimit = user && user.streamLimit || 0;
   for (const sub of subscriptions) {
      const plan = await Pricing.findById(sub.plan);
      const rs = JSON.parse(plan.resolutions);
      console.log("plan.allowed_streams", plan.allowed_streams);
      streamLimit += parseInt(plan.allowed_streams);
      allowedResolutions = new Set([...allowedResolutions, ...rs]);
      console.log("next streamLimit", streamLimit);
      console.log("next allowedResolutions", allowedResolutions);
   }
   return { 
      streamLimit,
      allowedResolutions
   }
  } catch (error) {
    return null
  }
};

module.exports = updateStreamLimit;

