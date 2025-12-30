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
    if (req.method !== 'GET') return res.status(405).json({ error: "Method Not Allowed" });

    try {
        const oauth2Client = getOAuth2Client();

        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
        ];

        const authorizationUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Crucial for receiving a refresh token
            scope: scopes,
            include_granted_scopes: true,
            prompt: 'consent' // Force consent to ensure we get a refresh token
        });

        // Redirect content to the Auth URL
        return res.redirect(authorizationUrl);

    } catch (error: any) {
        console.error("Auth Route Error:", error);
        return res.status(500).json({
            error: error.message,
            location: "OAuth Initialization",
            stack: error.stack
        });
    }
}

export default allowCors(handler);
