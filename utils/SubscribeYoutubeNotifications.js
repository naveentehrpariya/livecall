const crypto = require('crypto');
const YoutubeNotification = require('../db/YoutubeNotification');
const axios = require('axios');

const generateSecret = () => {
   return crypto.randomBytes(32).toString('hex');
};

const SubscribeYouTubeNotifications = async (userId, channelId, streamKey) => {
   try {
      const isAlready = await YoutubeNotification.findOne({ streamKey });
      if(isAlready){
         return {
            success: false,
            message: 'Channel is already subscribed.',
         };
      }
     else {
         const hubUrl = 'https://pubsubhubbub.appspot.com/subscribe';
         const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
         // const callbackUrl = `https://serverrai.runstream.co/notification/youtube/callback/${streamKey}`;
         const callbackUrl = `https://10be-2402-a00-1b1-1ae4-448f-6de0-bb9e-f09b.ngrok-free.app/notification/youtube/callback/${streamKey}`;
         const secret = generateSecret();
   
         const response = await axios.post(hubUrl, null, {
            params: {
               'hub.mode': 'subscribe',
               'hub.topic': topicUrl,
               'hub.callback': callbackUrl,
               'hub.secret': secret,
               'hub.verify': 'async',
            },
         });
   
         console.log('Subscription response:', response.data);
         const subscription = new YoutubeNotification ({
            userId,
            channelId,
            callbackUrl,
            secret,
            streamKey
         });
         const saved = await subscription.save();
         if(!saved){
            return {
               success: false,
               message: 'Failed to subscribe youtube notifications.',
            };
         }
         return {
            success: true,
            subscription: subscription
         };
      }
      return
   } catch (err) {
      console.error(`Error subscribing to YouTube notifications for channel ${channelId}:`, err);
      return {
         success: false,
         message: `Error subscribing to YouTube notifications: ${err.message}`,
      };
   }
};

module.exports = SubscribeYouTubeNotifications;
