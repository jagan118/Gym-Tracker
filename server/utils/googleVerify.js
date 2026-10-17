const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (idToken) => {
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.includes('your-google-client-id')) {
    const error = new Error('Google sign-in is not configured on the server. Set GOOGLE_CLIENT_ID in server/.env.');
    error.statusCode = 503;
    throw error;
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      const error = new Error('Google account must have a verified email address.');
      error.statusCode = 401;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.statusCode) throw error;
    const invalidToken = new Error('Google sign-in token is invalid or expired. Please try again.');
    invalidToken.statusCode = 401;
    throw invalidToken;
  }
};

module.exports = verifyGoogleToken;
