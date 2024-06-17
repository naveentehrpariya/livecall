const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const loadClientSecrets = async () => {
  try {
    const content = fs.readFileSync(CLIENT_SECRETS_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error loading client secrets:', err);
    return null;
  }
};

const getOAuth2Client = async (credentials, redirectUri) => {
  try {
    const { client_secret, client_id } = credentials.web;
    return new google.auth.OAuth2(client_id, client_secret, redirectUri);
  } catch (err) {
    console.error('Error creating OAuth2 client:', err);
    return null;
  }
};

const channelDetails = async (token) => {
  try {
    const credentials = await loadClientSecrets();
    if (!credentials) {
      throw new Error('Failed to load client secrets');
    }

    console.log("credentials getted",credentials)

    const oAuth2Client = await getOAuth2Client(credentials, redirectUri);
    if (!oAuth2Client) {
      throw new Error('Failed to create OAuth2 client');
    }

    // Set the credentials (token) on the OAuth2 client
    oAuth2Client.setCredentials(token);

    const youtube = google.youtube({
      version: 'v3',
      auth: oAuth2Client,
    });

    const response = await youtube.channels.list({
      part: 'snippet,contentDetails,statistics',
      mine: true,
    });

    console.log("channel response", response);
    const channel = response.data.items[0];
    return channel;
  } catch (error) {
    console.error('Error retrieving channel details:', error);
    throw error;
  }
};

module.exports = channelDetails;
