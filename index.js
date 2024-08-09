const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
require('dotenv').config()
const globalErrorHandler = require("./middlewares/gobalErrorHandler");
const errorHandler = require("./middlewares/errorHandler");
const multer = require('multer');
const handleFileUpload = require('./utils/file-upload-util');
const { validateToken } = require('./controllers/authController');
const { subscriptionWebhook } = require('./controllers/stripeController');
const Files = require('./db/Files');
const AppError = require('./utils/AppError');
const logger = require('./utils/logger');
const { default: axios } = require('axios');
require('./db/config');

const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
};
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(errorHandler);
app.use(globalErrorHandler);

app.post('/subscriptionWebhook', bodyParser.raw({ type: 'application/json' }), subscriptionWebhook);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({limit:'2000mb'}));
// ROUTES
app.use("/user", require('./routes/authRoutes'));
app.use("/product", require('./routes/productsRoutes'));
app.use("/user", require('./routes/userRoutes'));
app.use("", require('./routes/streamRoutes'));
app.use("", require('./routes/stripeRoutes'));
app.use("", require('./routes/FilesRoutes'));
app.use("/admin", require('./routes/adminRoutes'));
app.use("", require('./routes/paypalRoutes'));


// Payment getway 
const braintree = require('braintree');
const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox, // Use Production for live environment
  merchantId: '5rfrzw45brkt6vmn',
  publicKey: 's64tbz7xsx8ffvzs',
  privateKey: '2030892136186a683b3b6cd731b945e8',
});


app.get('/client-token', async (req, res) => {
  try { 
    const token = await gateway.clientToken.generate({});
    res.status(200).json({ success: true, token: token   });
  } catch(error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


app.post('/api/subscribe-plan', async (req, res) => {
  const { paymentMethodNonce, planId } = req.body;

  try {
    // Vault the payment method
    const customerResult = await gateway.customer.create({
      paymentMethodNonce: paymentMethodNonce,
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com"
    });

    if (!customerResult.success) {
      return res.status(400).json({ success: false, error: customerResult.message });
    }

    // Get the vaulted payment method token
    const paymentMethodToken = customerResult.customer.paymentMethods[0].token;

    // Create a subscription with the vaulted payment method
    const subscriptionResult = await gateway.subscription.create({
      paymentMethodToken: paymentMethodToken,
      planId: planId,
      options: {
        startImmediately: true,
      },
    });

    if (subscriptionResult.success) {
      res.status(200).json({ success: true, subscription: subscriptionResult.subscription });
    } else {
      res.status(400).json({ success: false, error: subscriptionResult.message });
    }

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook Endpoint
app.post('/webhook', async (req, res) => {
  const signature = req.body.bt_signature;
  const payload = req.body.bt_payload;

  try {
    const webhookNotification = await gateway.webhookNotification.parse(
      signature,
      payload
    );

    // Handle different types of webhook notifications
    switch (webhookNotification.kind) {
      case braintree.WebhookNotification.Kind.SubscriptionChargedSuccessfully:
        // Handle successful subscription renewal
        const subscriptionId = webhookNotification.subscription.id;
        console.log(`Subscription ${subscriptionId} charged successfully.`);
        break;

      case braintree.WebhookNotification.Kind.SubscriptionChargedUnsuccessfully:
        // Handle unsuccessful subscription renewal
        const failedSubscriptionId = webhookNotification.subscription.id;
        console.log(`Subscription ${failedSubscriptionId} failed to charge.`);
        break;

      // Add more cases to handle other webhook events as needed
      default:
        console.log(`Unhandled webhook notification: ${webhookNotification.kind}`);
    }

    res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});







































































const multerParse = multer({
  dest: "uploads/",
  limits: {
    fileSize: 1024 * 1024 * 2000 // 50MB
  }
});

app.options("/cloud/upload", cors(corsOptions));
app.post("/cloud/upload", cors(corsOptions), validateToken, multerParse.single("attachment"), async (req, res) => {
  const attachment = req.file;
  if (!attachment) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  try {
    const uploadResponse = await handleFileUpload(attachment);
    if (uploadResponse) {
      const file = new Files({
        name: uploadResponse.file.originalname,
        mime: uploadResponse.mime,
        filename: uploadResponse.filename,
        url: uploadResponse.url,
        user: req.user?._id,
        size: uploadResponse.size,
      });
      const fileUploaded = await file.save();

      if (!fileUploaded) {
        return res.status(500).json({
          message: "File upload failed",
          error: uploadResponse
        });
      }
      return res.status(201).json({
        message: "File uploaded to storage.",
        file_data: fileUploaded,
      });
    
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(500).json({
        message: "File upload failed",
        error: uploadResponse
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "An error occurred during file upload",
    });
  }
});

app.get('/', (req, res) => {
  res.send({
    message: "ACTIVE last2",
    status: 200
  });
});

app.all('*', (req, res, next) => {
  res.status(404).json({
      status: 404,
      message: `NOT FOUND`
  });
});

const port = process.env.PORT;
app.listen(port, () => { console.log(`On PORT ${port} SERVER RUNNINGGGGG.....`) });
