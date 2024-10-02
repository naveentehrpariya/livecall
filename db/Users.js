const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Files = require('./Files');

const schema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter your name.'],
    },
    email: {
        type: String,
        required: [true, 'Please enter your email address.'],
        lowercase: true,
        validate: [validator.isEmail, 'Please provide a valid email address.'],
        unique: true
    },
    free_trial: {
        type: Date,
        default: function () {
            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 1);
            return threeDaysFromNow;
        }
    },
    plan_end_on: {type: Date},
    streamLimit: { type: Number, default: 0},
    allowed_resolutions: { type: [String], default: ['1080'] }, 

    avatar: {type: String},
    uploaded_content: { type : String},

    password: {
        type: String,
        required: [true, 'Please enter your password.'],
        select: false
    },
    confirmPassword: {
        type: String,
        required: true,
        required: [true, 'Please re-enter your password.'],
        select: false,
        validate: {
            validator: function (val) { return val === this.password },
            message: "Passwords did't matched."
        }
    },
    country : { 
        type : String
    },
    country_code : { 
        type : String
    },
    currency : {
        type : String
    },

    status: {
        type: String,
        default: "active",
    },

    role: {
        type: String,
        default:'0'
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    mailVerifiedAt: {
        type: Date,
        default: null
    },
    changedPasswordAt: Date,
    passwordResetToken: String,
    resetTokenExpire: Date,
    mailVerificationToken: String,
    mailTokenExpire: Date,
    deletedAt: {
        type: Date
    },
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

schema.virtual('trialStatus').get(function () {
    const currentDate = new Date();
    if (this.free_trial > currentDate) {
        return 'active';
    } else {
        return 'ended';
    }
}); 
 
schema.virtual('planStatus').get(function () {
    const currentDate = new Date();
    if (this.plan && (this.plan_end_on > currentDate)) {
        return 'active';
    } else {
        return 'ended';
    }
});

schema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    this.confirmPassword = undefined;
});

schema.pre(/^find/, function (next) {
    this.find({ active: { $ne: false } });
    next();
});

schema.methods.checkPassword = async function (pass, hash) {
    return await bcrypt.compare(pass, hash);
}

schema.methods.createPasswordResetToken = async function () {
    const token = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    this.resetTokenExpire = Date.now() + 10 * 60 * 1000;
    return token;
}

schema.methods.createMailVerificationToken = async function () {
    const token = crypto.randomBytes(32).toString('hex');
    this.mailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
    this.mailTokenExpire = Date.now() + 10 * 60 * 1000;
    return token;
}

schema.methods.getUploadedContentSize = async function () {
    try {
        const id = this._id;
        const files = await Files.find({ user: id, deletedAt: { $in: [null, ''] } });

        // If no files found, set totalSize to 0
        const totalSize = files.reduce((acc, file) => acc + parseInt(file.size || 0), 0);

        // Convert total size from bytes to MB
        const totalSizeInMB = totalSize

        // Add total size to the user instance
        this.uploaded_content = totalSizeInMB;

        return totalSizeInMB; // Optional: You can return the value if needed
    } catch (error) {
        console.error('Error calculating uploaded content size:', error);
        this.uploaded_content = 0; // In case of error, set uploaded content size to 0
        return 0;
    }
}


const User = mongoose.model('users', schema);
module.exports = User;
