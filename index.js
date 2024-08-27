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
app.use("", require('./routes/rajorpayRoutes'));


const multerParse = multer({
  dest: "uploads/",
  limits: {
    fileSize: 1024 * 1024 * 2000 
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
