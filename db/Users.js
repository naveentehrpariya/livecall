const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const schema = new mongoose.Schema({
    name: {
        type:String, 
        required:[true, 'Please enter your name.'],
    },
    username: {
        required:[true, 'Please enter your username.'],
        unique:[true, 'Username is already taken.'], 
        type:String,
        minLength:5,
        maxLength:10
    },
    email: {
        type:String,
        unique:true, 
        required:[true, 'Please enter your email address.'],
        lowercase:true,
        validate: [validator.isEmail, 'Please provide a valid email address.']
    },
    stripe_id: {
        type:String,
    },
    avatar: {
        type:String,
    },
    password: {
        type:String,
        required:[true, 'Please enter your password.'],
        select:false
    },
    confirmPassword: {
        type:String,
        required:true,
        required:[true, 'Please re enter your password.'],
        select:false,
        validate : {
            validator : function (val) { return val === this.password },
            message : 'Password did\'t matched.'
        }
    },
    active : { 
        type:Boolean,
        default:true,
        select:false,
    },
    changedPasswordAt: Date,
    passwordResetToken : String,
    resetTokenExpire : Date,
});

schema.pre('save', async function(next) { 
    if(!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    this.confirmPassword = undefined;
});

// To remove all inactive user from search results
schema.pre(/ˆfind/, async function(next) { 
    this.find({active: {$ne:false}});    
});

schema.methods.checkPassword = async function (pass, hash) { 
    return await bcrypt.compare(pass, hash);
}

schema.methods.createPasswordResetToken  = async function() { 
    const token = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    this.resetTokenExpire = Date.now() + 10 * 60 * 1000;
    return token;
}

const User = mongoose.model('users', schema);
module.exports = User;

 