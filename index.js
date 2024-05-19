const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan')
const { spawn } = require('child_process');

app.use(morgan('dev')); 
const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, 
}; 
app.use(cors(corsOptions));


const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const globalErrorHandler = require("./middlewares/gobalErrorHandler");
const errorHandler = require("./middlewares/errorHandler");
const AppError = require('./utils/AppError');
const Stream = require('./db/Stream');
require('./db/config');
 
app.use(express.json()); 
app.use(errorHandler);  
app.use(globalErrorHandler); 


// ROUTES
app.use("/user", require('./routes/authRoutes'));
app.use("/product", require('./routes/productsRoutes'));
app.use("/user", require('./routes/userRoutes'));
app.use("", require('./routes/streamRoutes'));
app.use("", require('./routes/stripeRoutes'));
app.use("", require('./routes/FilesRoutes'));

const multer = require('multer');
const multerParse = multer({
  dest: "uploads/",
});
const handleFileUpload = require('./utils/file-upload-util');
const { validateToken } = require('./controllers/authController');
const Files = require('./db/Files');

app.post("/cloud/upload", validateToken, multerParse.fields([{name: "attachment",},]),
  async (req, res) => {
    const attachment = req.files?.attachment?.[0];
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
        });
        const fileupoaded = await file.save();

        if (!fileupoaded) {
          return res.status(500).json({
            message: "File upload failed",
            error :uploadResponse
          });
        }
        
        return res.status(201).json({
          message: "File uploadeded to storage.",
          file_data: fileupoaded,
        });
      } else {
        res.status(500).json({
          message: "File upload failed",
          error :uploadResponse
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "An error occurred during file upload",
      });
    }
  }
);

app.get('/', (req, res)=>{ 
  res.send({
      status:"Active Latest",  
      Status :200
  });   
}); 

app.all('*', (req, res, next) => { 
  next(new AppError("Endpoint not found !!", 404    ));         
});

const port = process.env.PORT;
app.listen(port, ()=>{ console.log(`On PORT ${port} SERVER RUNNINGGGGG.....`) });