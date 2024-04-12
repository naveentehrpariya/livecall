const Products = require("../db/Products");
const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");

const subscribe = catchAsync ( async (req, res)=>{
  const updated = Object.assign( {user_id:5}, req.body );
  const product = await Products.create(updated);
  if(product){ 
      res.status(200).json({ 
          status:true, 
          data:product 
      });
  } else {  
      res.status(400).json({
          error:product
      }); 
  } 
});
 
module.exports = { subscribe } 