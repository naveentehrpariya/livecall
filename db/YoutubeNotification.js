const mongoose = require('mongoose');
const channelSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'users',
  },
  channelId: {
    type: String,
    required: true,
  },
  videoId: {
    type: String,
  },
  streamkey: {
    type: String,
    required: true,
  },
  callbackUrl: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const YoutubeNotification = mongoose.model('ChannelSubscription', channelSchema);

module.exports = YoutubeNotification;
