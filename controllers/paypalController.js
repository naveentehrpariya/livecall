const { paypal } = require('../config/paypalClient');
const catchAsync = require("../utils/catchAsync");

const createPaypalProduct = (req, res) => {
  var billingPlanAttributes = {
      "description": "Create Plan for Regular",
      "merchant_preferences": {
          "auto_bill_amount": "yes",
          "cancel_url": "http://www.cancel.com",
          "initial_fail_amount_action": "continue",
          "max_fail_attempts": "1",
          "return_url": "http://www.success.com",
          "setup_fee": {
              "currency": "USD",
              "value": "25"
          }
      },
      "name": "Testing1-Regular1",
      "payment_definitions": [
          {
              "amount": {
                  "currency": "USD",
                  "value": "100"
              },
              "charge_models": [
                  {
                      "amount": {
                          "currency": "USD",
                          "value": "10.60"
                      },
                      "type": "SHIPPING"
                  },
                  {
                      "amount": {
                          "currency": "USD",
                          "value": "20"
                      },
                      "type": "TAX"
                  }
              ],
              "cycles": "0",
              "frequency": "MONTH",
              "frequency_interval": "1",
              "name": "Regular 1",
              "type": "REGULAR"
          },
          {
              "amount": {
                  "currency": "USD",
                  "value": "20"
              },
              "charge_models": [
                  {
                      "amount": {
                          "currency": "USD",
                          "value": "10.60"
                      },
                      "type": "SHIPPING"
                  },
                  {
                      "amount": {
                          "currency": "USD",
                          "value": "20"
                      },
                      "type": "TAX"
                  }
              ],
              "cycles": "4",
              "frequency": "MONTH",
              "frequency_interval": "1",
              "name": "Trial 1",
              "type": "TRIAL"
          }
      ],
      "type": "INFINITE"
    };

    paypal.billingPlan.create(billingPlanAttributes, function (error, billingPlan) {
      if (error) {
          console.log(error);
          throw error;
      } else {
          console.log("Create Billing Plan Response");
          console.log(billingPlan);
      }
    });
};

const activatePlan = async (planId) => {
  const billingPlanUpdateAttributes = [
    {
      op: "replace",
      path: "/",
      value: {
        state: "ACTIVE"
      }
    }
  ];

  paypal.billingPlan.update(planId, billingPlanUpdateAttributes, function (error, response) {
    if (error) {
      console.log(error);
      throw error;
    } else {
      console.log("Billing plan activated");
    }
  });
};
 
const subscribeToPlan = (req, res) => {
  const planId = req.body.planId;
  activatePlan(planId)
  const billingAgreementAttributes = {
    name: "Billing Agreement",
    description: "Agreement for plan " + planId,
    start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    plan: {
      id: planId
    },
    payer: {
      payment_method: "paypal"  // PayPal will provide the option to pay by card as well
    }
  };
  paypal.billingAgreement.create(billingAgreementAttributes, function (error, billingAgreement) {
    if (error) {
      console.log(error);
      res.status(500).json({ error: error.response });
    } else {
      for (let i = 0; i < billingAgreement.links.length; i++) {
        if (billingAgreement.links[i].rel === "approval_url") {
          return res.json({url:billingAgreement.links[i].href});
        }
      }
    }
  });
};



const plansLists = async (req, res) => {
  try {
    const list_billing_plan = {
      // 'status': 'ACTIVE',
      'page_size': 5,
      'page': 1,
      'total_required': 'yes'
    };
    const billingPlan = await paypal.billingPlan.list(list_billing_plan);
    console.log("List Billing Plans Response", billingPlan);
    res.status(200).json(billingPlan);
  } catch (error) {
    console.error("Error listing billing plans:", error);
    res.status(500).json({ message: "Failed to list billing plans", error: error.toString() });
  }
};

module.exports = { createPaypalProduct, subscribeToPlan, plansLists };
