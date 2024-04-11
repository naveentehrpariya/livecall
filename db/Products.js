const mongo = require('mongoose'); 
const slugify = require('slugify'); 
const schema = new mongo.Schema({
    name:{ 
        type:String,
        require:true,
        unique :true,
        // minLength:[50, 'Name Length should be min of 50 charcters']
    },
    description:String,
    price:  {
        type :String,
        unique:true,
        // validate : {
        //     validator : function(val){ 
        //         return val < "1000"
        //     },
        //     message : 'Price can not be 20000'
        // }
    },
    category:String,
    thumb:String,
    rating :{type:Number},
    technology: String,
    discount:String,
    emi : String,
    slug: String,
    slugtest: {
        type:String
    },
    // year: {
    //     type :Number,
    //     enum : { 
    //         values : [2022, 2023, 2020, 2021],
    //         message : "These Fields are not allowed"
    //     }
    // },
    createdAt: {
        type: Date,
        default: Date.now()     
    },
}); 

// Will runs ony when .save or .create trigger not for insertMany
schema.pre('save',function(next){
    this.slugtest= slugify(this.name, {lower:true})
    next();
});

// To Not Find All Document Matching this Condition
// schema.pre(/^find/,function(next){
//     this.find({year : {$ne:'2023'}})
//     next();
// });


module.exports = mongo.model('products', schema);