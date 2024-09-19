const catchAsync = require("../utils/catchAsync");
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Pricing = require("../db/Pricing");
const User = require("../db/Users");
const Subscription = require("../db/Subscription");
const logger = require("../utils/logger");
const axios = require('axios');
const sendEmail = require("../utils/Email");
const domain = process.env.DOMAIN_URL;

const SECRET = process.env.RAJORPAY_SECRET
const razorpay = new Razorpay({
   key_id: process.env.RAJORPAY_ID,
   key_secret: SECRET
});

async function getExchangeRates(baseCurrency) {
   const apiKey = process.env.EXCHANGE_RATE_KEY;
   const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`
   try {
       const response = await axios.get(url);
       console.log("response",response)
       if(response.data && response.data.conversion_rates){
         return response.data.conversion_rates
       } else { 
          return {
            USD: 1,
         }
       }
   } catch (error) {
       console.log('Error fetching exchange rates:', error);
   }
}

async function convertCurrency(amount, fromCurrency, toCurrency) {
   try {
       let rates = await getExchangeRates(fromCurrency);
       let tries = 0;
       if(!rates && tries < 3) {
         tries = tries+1
         rates = await getExchangeRates(fromCurrency);
       }
       const conversionRate = rates[toCurrency];
       console.log("conversionRate", conversionRate);
       if (!conversionRate) {
         console.log('Invalid or missing conversion rate, using a default.');
         return {
            amount: amount,
            convertedAmount: amount * 100, // Fallback, assuming no conversion
          }; 
       }

       // Convert the amount using the correct conversion rate
       const convertedAmount = amount * conversionRate;
       return {
         amount: amount, 
         convertedAmount: convertedAmount,
         rate: conversionRate
       };
   } catch (error) {
       console.log('Error converting currency:', error);
   }
}


exports.createOrder = catchAsync(async (req, res) => {
   console.log("req.body", req.body);
   let duration = req.body.duration || 1;
   let currency =  req.body.currency;
   const id = req.body.id;
   const plan = await Pricing.findById(id);
   let lastprice = (plan.price * 100)
   
   if (currency !== plan.currency) {
      const result = await convertCurrency(plan.price, plan.currency, currency);
      if(result&& result.convertedAmount){
         lastprice = result.convertedAmount * 100;
      } else { 
         lastprice = plan.price * 100;
         currency = 'USD'
      }
   }
   const finalprice = parseInt(lastprice) * parseInt(duration);
   const options = {
      amount: Math.round(finalprice),
      currency: currency || 'USD', 
      description: plan.description,
      customer: {
         email: req.user.email,
      },
      notify: {
         email: true,
         sms: true,
      },
      notes: {
         duration: duration,
         userId: req.user._id,
         userEmail: req.user.email,
         planID: id
      },
      callback_url: `${domain}/payment/status`,
      callback_method: 'get', 
   };

   try {
      const paymentLink = await razorpay.paymentLink.create(options);
      res.json({
         status: true,
         id: paymentLink.id,
         short_url: paymentLink.short_url,
         amount: paymentLink.amount, 
      });
   } catch (error) {
      console.error('Error creating payment link:', error);
      res.status(500).json({ status:false, error: 'Failed to create payment link.' });
   }
});


 

exports.paymentWebhook = catchAsync (async (req,res) => {
   const shasum = crypto.createHmac('sha256', SECRET);
   shasum.update(JSON.stringify(req.body));
   const digest = shasum.digest('hex');
   if (digest === req.headers['x-razorpay-signature']) {
     const event = req.body.event;
     if (req.body.payload && event === 'payment.captured'){
         const payment = req.body.payload.payment.entity;
         console.log("webhook payment",payment);
         logger(JSON.stringify(payment));
         const user = await User.findById(payment.notes.userId);
         const plan = await Pricing.findById(payment.notes.planID);
         const endOnDate = new Date();
         const duration = parseInt(payment.notes.duration);

         const ishaveAlreadySubscription = await Subscription.findOne({user: user._id, status: 'active'});
         console.log("ishaveAlreadySubscription",ishaveAlreadySubscription);
         if(ishaveAlreadySubscription){
            ishaveAlreadySubscription.status = 'inactive';
            await ishaveAlreadySubscription.save();
         }
         
         const endDate = endOnDate.setMonth(endOnDate.getMonth() + duration)
         const subcription = new Subscription({
            plan: plan._id,
            status: 'active',
            duration: duration,
            user: user._id,
            updatedAt: Date.now(),
            endOn: endDate,
         }); 

         user.plan_end_on = endDate;
         user.plan_months = duration;
         user.plan = plan._id;

         
         const message = `<html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="content-type" content="text/html; charset=utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0;">
          <meta name="format-detection" content="telephone=no" />

          <style>
            body {
              margin: 0;
              padding: 0;
              min-width: 100%;
              width: 100% !important;
              height: 100% !important;
            }

            body,
            table,
            td,
            div,
            p,
            a {
              -webkit-font-smoothing: antialiased;
              text-size-adjust: 100%;
              -ms-text-size-adjust: 100%;
              -webkit-text-size-adjust: 100%;
              line-height: 100%;
            }

            table,
            td {
              mso-table-lspace: 0pt;
              mso-table-rspace: 0pt;
              border-collapse: collapse !important;
              border-spacing: 0;
            }

            img {
              border: 0;
              line-height: 100%;
              outline: none;
              text-decoration: none;
              -ms-interpolation-mode: bicubic;
            }

            #outlook a {
              padding: 0;
            }

            .ReadMsgBody {
              width: 100%;
            }

            .ExternalClass {
              width: 100%;
            }

            .ExternalClass,
            .ExternalClass p,
            .ExternalClass span,
            .ExternalClass font,
            .ExternalClass td,
            .ExternalClass div {
              line-height: 100%;
            }

            @media all and (min-width: 560px) {
              body {
                margin-top: 30px;
              }
            }
            
            /* Rounded corners */
            @media all and (min-width: 560px) {
              .container {
                border-radius: 8px;
                -webkit-border-radius: 8px;
                -moz-border-radius: 8px;
                -khtml-border-radius: 8px;
              }
            }
            /* Links */
            a,
            a:hover {
              color: #127DB3;
            }

            .footer a,
            .footer a:hover {
              color: #999999;
            }
          </style>
          <title>🎉 Your Plan Purchase Confirmation!</title>
        </head>

        <!-- BODY -->
        <body topmargin="0" rightmargin="0" bottommargin="0" leftmargin="0" marginwidth="0" marginheight="0" width="100%" style="border-collapse: collapse; border-spacing: 0;  padding: 0; width: 100%; height: 100%; -webkit-font-smoothing: antialiased; text-size-adjust: 100%; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; line-height: 100%;
          background-color: #ffffff;
          color: #000000;" bgcolor="#ffffff" text="#000000">
          <table width="100%" align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; width: 100%;" class="background">
            <tr>
              <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0;" bgcolor="#ffffff">
                <table border="0" cellpadding="0" cellspacing="0" align="center" bgcolor="#FFFFFF" width="560" style="border-collapse: collapse; border-spacing: 0; padding: 0; width: inherit;
          max-width: 560px;" class="container">
                  <tr>
                    <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 24px; font-weight: bold; line-height: 130%;padding-top: 25px;color: #000000;font-family: sans-serif;" class="header">
                      <img border="0" vspace="0" hspace="0" src="https://runstream.co/logo-white.png" style="max-width: 250px;" alt="The Idea" title="Runstream" />
                    </td>
                  </tr>
                  <tr>
                    <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%;
              padding-top: 25px;" class="line">
                    </td>
                  </tr>
                  <tr>
                    <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 17px; font-weight: 400; line-height: 160%;
              padding-top: 25px; 
              color: #000000;
              font-family: sans-serif;" class="paragraph">
                      Hi ${user.name || ""},<br> Thank you for choosing Runstream We’re thrilled to confirm your purchase of the <b style="font-weight:bold">${plan.name || ''} </b> plan for ${duration} ${duration > 1 ? "months" : "month"}.
                    </td>
                  </tr>
                  <tr>
                    <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; padding-top: 25px;padding-bottom: 5px;" class="button">
                        <table border="0" cellpadding="0" cellspacing="0" align="center" style="max-width: 240px; min-width: 120px; border-collapse: collapse; border-spacing: 0; padding: 0;">
                          <tr>
                            <td align="center" valign="middle" >
                              <a target="_blank" style=" background-color: #df3939; padding: 12px 24px; margin: 0; text-decoration: none; border-collapse: collapse; border-spacing: 0; border-radius: 10px; -webkit-border-radius: 10px; -moz-border-radius: 10px; -khtml-border-radius: 10px;text-decoration: none;
                                color: #FFFFFF; font-family: sans-serif; font-size: 17px; font-weight: 400; line-height: 120%;" href="https://runstream.co">
                                  Create Stream
                              </a>
                            </td>
                          </tr>
                        </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%;
              padding-top: 25px;" class="line">
                    </td>
                  </tr>
                  <tr>
                    <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 17px; font-weight: 400; line-height: 160%;
              padding-top: 20px;
              padding-bottom: 25px;
              color: #000000;
              font-family: sans-serif;" class="paragraph">
                      If you have any questions or need assistance, feel free to reach out to our support team at <a href="mailto:Support@runstream.co" target="_blank" style=" color: #4b57ff; ">support@runstream.co</a>. We’re here to help!
                    </td>
                  </tr>
                </table>
                <table border="0" cellpadding="0" cellspacing="0" align="center" width="560" style="border-collapse: collapse; border-spacing: 0; padding: 0; width: inherit;
          max-width: 560px;" class="wrapper">
                  <tr>
                    <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 13px; font-weight: 400; line-height: 150%;
              padding-top: 20px;
              padding-bottom: 20px;
              color: #999999;
              font-family: sans-serif;" class="footer">
                      For more information <a href="https://runstream.co/contact" target="_blank" style=" color: #999999; ">contact us</a>. Our support
                      team is available to help you 24 hours a day, seven days a week.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>`;
       await sendEmail({
         email:user.email,
         subject:`🎉 Your Plan Purchase Confirmation!`,
         message
       });


         await user.save();
         await subcription.save();
     } else { 
        logger('WEBHOOK NOT WORKING');
         logger(JSON.stringify(event));
     }
     res.json({ status: 'ok' });
   } else {
     res.status(400).send('Invalid signature');
   }
});


