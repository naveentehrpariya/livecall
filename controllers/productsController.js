const Products  = require("../db/Products");
const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");

const addproducts = catchAsync ( async (req, res)=>{
   
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



const listProducts = catchAsync ( async (req, res)=>{
    const feature = new APIFeatures(Products.find(), req.query).filter().sort().limit_fields().paginate();
    const data = await feature.query;
    if(data){ 
        res.json({ 
            status:true, 
            data: data
        });
    } else {  
        res.json({ 
            status:true,
            data: data
        }); 
    } 
}); 

const productDetail = async (req, res)=>{
    try {
        const id = req.params;
        res.json({ 
            status:true, 
            data: id
        });
        // const result = await Products.find();
        // if(result){ 
        //     res.json({ 
        //         status:true, 
        //         data: id
        //     });
        // } else {  
        //     res.json({ 
        //         status:true,
        //         data: id
        //     }); 
        // } 
    } catch(_err){ 
        res.json({ 
            status:false, 
            error: _err 
        });
    } 
}; 

const tour_stats = catchAsync ( async (req, res)=>{
    const stats = await Products.aggregate([
        {$match: {price : { $gte:2000}}},
        {$group: {
                    _id: null,
                    averagePrice: { $avg: '$price'},
                    minRating: { $min: '$rating'},
                    maxRating: { $max: '$rating'},
                    avarageRating: { $avg: '$rating'},
            }
        }
    ]);
    if(stats){
        res.json({ 
            status:true, 
            data: stats
        });
    }
}); 



module.exports = { addproducts, listProducts, productDetail, tour_stats } 