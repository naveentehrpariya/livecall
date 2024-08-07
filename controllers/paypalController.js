const { paypal } = require('../config/paypalClient');
const catchAsync = require("../utils/catchAsync");

const createPaypalProduct = (req, res) => {
   const plan = {
     "name": "Basic Plan",
     "description": "Basic subscription",
     "type": "INFINITE",
     "payment_definitions": [
       {
         "name": "Regular Payments",
         "type": "REGULAR",
         "frequency": "Month",
         "frequency_interval": "1",
         "amount": {
           "value": "9.99",
           "currency": "USD"
         },
         "cycles": "0",
         "charge_models": [
           {
             "type": "SHIPPING",
             "amount": {
               "value": "1",
               "currency": "USD"
             }
           },
           {
             "type": "TAX",
             "amount": {
               "value": "1",
               "currency": "USD"
             }
           }
         ]
       }
     ],
     "merchant_preferences": {
       "auto_bill_amount": "YES",
       "cancel_url": "http://www.cancel.com",
       "initial_fail_amount_action": "CONTINUE",
       "max_fail_attempts": "1",
       "return_url": "http://www.success.com"
     }
   };
 
   paypal.billingPlan.create(plan, function (error, plan) {
     if (error) {
       console.log(error);
       throw error;
     } else {
       console.log("Plan Created");
       console.log(plan);
       res.json(plan);
     }
   });
 };
 

module.exports = { createPaypalProduct };
