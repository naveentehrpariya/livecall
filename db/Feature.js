const mongo = require('mongoose'); 
const schema = new mongo.Schema({
    title:{ 
        type:String,
        require:true,
        minLength:[5, 'Title length should be min 5 charcters'],
        maxLength:[60, 'Title length should not be max than 60 charcters']
    },
    description:{
        type:String,
        require:true,
        minLength:[20, 'Description length should be min 20 charcters'],
        maxLength:[450, 'Description length should not be max than 450 charcters']
    },
    createdAt: {
        type: Date,
        default: Date.now()     
    },
}); 

module.exports = mongo.model('features', schema);