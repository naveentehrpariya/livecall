const catchAsync = require("../utils/catchAsync");
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
   key_id: 'rzp_test_ElU7Y74SgUTN2r',
   key_secret: '3WPNoyY8vtSWEOaYR80XNTXA'
});

exports.createPlan = async () => {
   try {
      const plan = await razorpay.plans.create({
         period: "weekly",
         interval: 1,
         item: {
            name: "Test plan - Weekly",
            amount: 69900,
            currency: "INR",
            description: "Description for the test plan"
         },
         notes: {
            notes_key_1: "Tea, Earl Grey, Hot",
            notes_key_2: "Tea, Earl Grey… decaf."
         }
      })
      console.log('Plan Created:', plan);
   } catch (error) {
      console.error('Error creating plan:', error);
   }
};