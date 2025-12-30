import { google } from 'googleapis';

export const getOAuth2Client = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/api/auth/google/callback';

    if (!clientId || !clientSecret) {
        throw new Error('Missing Google OAuth credentials');
    }

    return new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );
};
