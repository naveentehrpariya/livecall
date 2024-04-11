const fs = require('fs');
const express = require('express');
const app = express();
const cors = require('cors');
require('./db/config');
app.use(cors()); 
app.use(express.json()); 

console.log(process.argv);



const addPro =  async () => { 
   const products = JSON.parse(fs.readFileSync('./data/products.json', 'utf-8'));  
   const add = await Products.create(products);
   if(add){ 
      console.log("Products Added", add);
   } else { 
      console.warn("Failed to add products", add);
   }
   process.exit();
}


const deletePro =  async () => { 
   const add = await Products.deleteMany();
   if(add){ 
      console.log("Products Deleted");
   } else { 
      console.warn("Failed to Delete products", add);
   }
   process.exit();
}


const Products = require('./db/Products');

 if(process.argv[2] === '--import'){ 
   addPro();
 } else if (process.argv[2] === '--delete') {
   deletePro();
 }

  
app.listen(5000, ()=>{console.log("SERVER RUNNINGGGGG.....")});