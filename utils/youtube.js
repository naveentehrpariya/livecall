const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Load OAuth2 client credentials
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'YOUR_REDIRECT_URI';
const REFRESH_TOKEN = 'YOUR_REFRESH_TOKEN';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client
});

module.exports = youtube;
