import { google } from 'googleapis';

export const getOAuth2Client = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://north-star2026.vercel.app/api/auth/google/callback';

    if (!clientId) console.error("Missing GOOGLE_CLIENT_ID");
    if (!clientSecret) console.error("Missing GOOGLE_CLIENT_SECRET");

    // Log intent without leaking secrets
    console.log("Initializing Google OAuth with redirect:", redirectUri);

    if (!clientId || !clientSecret) {
        throw new Error('Missing Google OAuth credentials');
    }

    return new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );
};
