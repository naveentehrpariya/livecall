const express = require('express');
const app = express();
const morgan = require('morgan')
app.use(morgan('dev')); 

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const globalErrorHandler = require("./middlewares/gobalErrorHandler");
const errorHandler = require("./middlewares/errorHandler");
const cors = require('cors');
const AppError = require('./utils/AppError');
require('./db/config');
 
// MIDDLE-WARES 
app.use(cors()); 
app.use(express.json()); 
app.use(errorHandler);  
app.use(globalErrorHandler); 

// ROUTES
app.use("/user", require('./routes/authRoutes'));
app.use("/product", require('./routes/productsRoutes'));
app.use("/user", require('./routes/userRoutes'));
app.use("", require('./routes/streamRoutes'));

 
app.all('*', (req, res, next) => { 
    next(new AppError("Endpoint not found !!", 404    ));         
});


app.get('/', (req, res)=>{ 
  res.send({
      status:"Active",  
      Status :200
  });   
}); 

const port = 8080;
app.listen(port, ()=>{ console.log(`On PORT ${port} SERVER RUNNINGGGGG.....`) });