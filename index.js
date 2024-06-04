const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan');

// Apply CORS middleware before other middlewares and routes
const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
};
app.use(cors(corsOptions));

app.use(morgan('dev'));

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({limit:'50mb'}));

const globalErrorHandler = require("./middlewares/gobalErrorHandler");
const errorHandler = require("./middlewares/errorHandler");
const AppError = require('./utils/AppError');
require('./db/config');

const multer = require('multer');
const handleFileUpload = require('./utils/file-upload-util');
const { validateToken } = require('./controllers/authController');
const Files = require('./db/Files');

app.use(bodyParser.raw({type: 'application/json'}));

// ROUTES
app.use("/user", require('./routes/authRoutes'));
app.use("/product", require('./routes/productsRoutes'));
app.use("/user", require('./routes/userRoutes'));
app.use("", require('./routes/streamRoutes'));
app.use("", require('./routes/stripeRoutes'));
app.use("", require('./routes/FilesRoutes'));
app.use("/admin", require('./routes/adminRoutes'));
// Specific CORS handling for file upload route
// Handle preflight request


const multerParse = multer({
  dest: "uploads/",
  limits: {
    fileSize: 1024 * 1024 * 50 // 50MB
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

app.use(express.json());
app.use(errorHandler);
app.use(globalErrorHandler);

app.get('/', (req, res) => {
  res.send({
    message: "ACTIVE",
    status: 200
  });
});

app.all('*', (req, res, next) => {
  next(new AppError("Endpoint not found !!", 404));
});

const port = process.env.PORT;
app.listen(port, () => { console.log(`On PORT ${port} SERVER RUNNINGGGGG.....`) });
