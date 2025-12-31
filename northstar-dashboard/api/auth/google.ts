import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOAuth2Client } from '../_lib/googleAuth.js';
import { getDb } from '../_lib/firebaseAdmin.js';

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
    console.log("CRITICAL: OAuth Flow Triggered from Frontend at " + new Date().toISOString());
    console.log("Request Method:", req.method);

    if (req.method !== 'GET') {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        // PRE-CHECK: If user already has tokens, skip to Planner
        // (This prevents the 'Blank Page' loop if they click connect again)
        try {
            const db = getDb();
            const doc = await db.collection('users').doc('default').collection('integrations').doc('google').get();
            if (doc.exists) {
                console.log("Tokens already exist. Redirecting to Planner.");
                // Check if they are actually valid? (Optional, but safe to assume for now)
                if (process.env.ForceAuth !== 'true') {
                    // ATOMIC REDIRECT to Planner
                    res.writeHead(302, { Location: 'https://north-star2026.vercel.app/weekly-planner?sync=true' });
                    res.end();
                    return;
                }
            }
        } catch (dbErr) {
            console.warn("DB Pre-check failed, proceeding to Auth:", dbErr);
        }

        const oauth2Client = getOAuth2Client();

        console.log("Generating URL...");

        // Scope: Read/Write Access required for Syncing specific tasks
        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
        ];

        const authorizationUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Request refresh token
            scope: scopes,
            include_granted_scopes: true,
            prompt: 'consent' // Force consent listener to ensure refresh token is returned
        });

        console.log("Atomic Redirect to:", authorizationUrl);

        // ATOMIC REDIRECT (Force 302)
        res.writeHead(302, { Location: authorizationUrl });
        res.end();
        return;

    } catch (error: any) {
        console.error("CRITICAL Auth Route Error:", error);
        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}

export default allowCors(handler);
