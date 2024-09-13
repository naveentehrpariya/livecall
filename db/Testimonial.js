const mongo = require('mongoose'); 
const schema = new mongo.Schema({
    name:{ 
        type:String,
        require:true,
        minLength:[3, 'Name should be min 3 charcters'],
        maxLength:[30, 'Name should not be max than 30 charcters']
    },
    description:{
        type:String,
        require:true,
        minLength:[30, 'Description length should be min 30 charcters'],
        maxLength:[400, 'Description length should not be max than 400 charcters']
    },
    avatar:{
        type:String,
        require:true,
    },
    createdAt: {
        type: Date,
        default: Date.now()     
    },
}); 

module.exports = mongo.model('testimonials', schema);