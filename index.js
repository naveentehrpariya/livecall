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




// paypal integration
const PAYPAL_API = 'https://api-m.sandbox.paypal.com';
const CLIENT_ID = process.env.PAYPAL_ID;
const SECRET =  process.env.PAYPAL_SECRET;

// Middleware for PayPal API authentication
const getAccessToken = async () => {
  const response = await axios({
      method: 'post',
      url: `${PAYPAL_API}/v1/oauth2/token`,
      auth: {
          username: CLIENT_ID,
          password: SECRET,
      },
      params: {
          grant_type: 'client_credentials',
      },
  });
  return response.data.access_token;
};


app.post('/create-product', async (req, res) => {
  const accessToken = await getAccessToken();
  const productData = {
      name: "TEST PRODUCTS",
      description: "eq.body.description",
      type: 'SERVICE',
      category: 'SOFTWARE',
  };

  try {
      const response = await axios.post(`${PAYPAL_API}/v1/catalogs/products`, productData, {
          headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
          },
      });
      res.json(response.data);
  } catch (error) {
      res.status(500).send(error.response.data);
  }
});

app.post('/create-plan', async (req, res) => {
  const accessToken = await getAccessToken();
  const planData = {
      product_id: req.body.product_id,
      name: req.body.name,
      description: req.body.description,
      billing_cycles: [
          {
              frequency: {
                  interval_unit: 'MONTH',
                  interval_count: 1,
              },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0, // 0 means it will renew indefinitely
              pricing_scheme: {
                  fixed_price: {
                      currency_code: 'USD',
                      value: req.body.price, // Ensure this value is provided correctly
                  },
              },
          },
      ],
      payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
              currency_code: 'USD',
              value: '0',
          },
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3,
      },
  };

  // Validate that price is provided
  if (!req.body.price) {
      return res.status(400).json({ error: 'Price is required.' });
  }

  try {
      const response = await axios.post(`${PAYPAL_API}/v1/billing/plans`, planData, {
          headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
          },
      });
      res.json(response.data);
  } catch (error) {
      res.status(500).send(error.response.data);
  }
});

app.get('/list-plans', async (req, res) => {
  const accessToken = await getAccessToken();
  try {
      const response = await axios.get(`${PAYPAL_API}/v1/billing/plans`, {
          headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
          },
      });
      res.json(response.data);
  } catch (error) {
      res.status(500).send(error.response.data);
  }
});

app.get('/plan/:plan_id', async (req, res) => {
  const accessToken = await getAccessToken();
  try {
      const response = await axios.get(`${PAYPAL_API}/v1/billing/plans/${req.params.plan_id}`, {
          headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
          },
      });
      res.json(response.data);
  } catch (error) {
      res.status(500).send(error.response.data);
  }
});


app.post('/subscribe-plan', async (req, res) => {
  try {
  console.log("req.body.plan_id",req.body.plan_id)
  const accessToken = await getAccessToken();
  const subscriptionData = {
      plan_id: req.body.plan_id,
      subscriber: {
          name: {
              given_name: req.body.given_name,
              surname: req.body.surname,
          },
          email_address: req.body.email,
      },
      application_context: {
          brand_name: 'YOUR_BRAND_NAME',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: 'https://your-return-url.com',
          cancel_url: 'https://your-cancel-url.com',
      },
  };
      const response = await axios.post(`${PAYPAL_API}/v1/billing/subscriptions`, subscriptionData, {
          headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
          },
      });
      res.json(response.data);
  } catch (error) {
      res.status(500).send(error.response.data);
  }
});


app.post('/test-endpoint', async (req, res) => {
  console.log("Handler started"); // This should print
  try {
      // Simulate some asynchronous operation
      const result = await new Promise((resolve) => setTimeout(() => resolve("Success"), 1000));
      
      console.log("Operation completed"); // This should print
      return res.json({ message: result }); // Send response
  } catch (error) {
      console.error("Error occurred:", error); // Log error
      return res.status(500).send("Internal Server Error"); // Send error response
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
