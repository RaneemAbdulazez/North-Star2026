import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOAuth2Client } from '../_lib/googleAuth.js';

const allowCors = (fn: any) => async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const oauth2Client = getOAuth2Client();

        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
        ];

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            include_granted_scopes: true,
            prompt: 'consent'
        });

        // Return URL directly so we can inspect it in the browser
        return res.status(200).json({
            url,
            debug_redirect_uri: process.env.GOOGLE_REDIRECT_URI || "MISSING (Using default)"
        });

    } catch (error: any) {
        console.error("Auth URL Generation Error:", error);
        return res.status(500).json({
            error: "Failed to generate URL",
            details: error.message,
            stack: error.stack
        });
    }
}

export default allowCors(handler);
