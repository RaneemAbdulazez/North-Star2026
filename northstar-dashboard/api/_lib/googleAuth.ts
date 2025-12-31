import { google } from 'googleapis';

export const getOAuth2Client = () => {
    // TODO: REMOVE HARDCODED SECRETS AFTER TESTING
    const clientId = process.env.GOOGLE_CLIENT_ID || "66143510660-v33r72bumkv4di8uofi4fero4pgrnjk0.apps.googleusercontent.com";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "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";
    // HARDCODED FOR PRODUCTION DEBUGGING
    const redirectUri = 'https://north-star2026.vercel.app/api/auth/google/callback';

    // Safe Debug Logging
    console.log("DEBUG [googleAuth]: Initializing with URI:", redirectUri);
    console.log("DEBUG [googleAuth]: GOOGLE_CLIENT_ID present?", !!clientId);

    if (!clientId) throw new Error('CONFIG ERROR: GOOGLE_CLIENT_ID missing.');
    if (!clientSecret) throw new Error('CONFIG ERROR: GOOGLE_CLIENT_SECRET missing.');

    return new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );
};
