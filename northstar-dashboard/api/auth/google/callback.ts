import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOAuth2Client } from '../../_lib/googleAuth.js';
import { getDb } from '../../_lib/firebaseAdmin.js';

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

    const { code } = req.query;

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: "Missing authorization code" });
    }

    try {
        const oauth2Client = getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);

        // Store tokens in Firestore
        // Since we don't have a user session, we'll store in a default user doc or a 'settings' doc.
        // Let's use 'settings/google_calendar' or similar. 
        // Given 'tasks' are global, 'settings' should be too.

        const db = getDb();

        // Use a fixed ID for the single user of this dashboard
        await db.collection('settings').doc('google_calendar').set({
            ...tokens,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        // Redirect back to the implementation
        // For now, redirect to the main planner page
        // We'll assume the frontend is running on localhost:5173 or we can redirect to '/'
        // But in production it might be different. 
        // Best to redirect to the frontend URL.

        // Determine frontend URL (simplified for now)
        // If strict separation, we'd want 'http://localhost:5173/weekly-planner?connected=true'
        // For production, we can deduce from REFERER or config.

        const frontendUrl = 'https://north-star2026.vercel.app';
        const redirectUrl = `${frontendUrl}/weekly-planner?google_connected=true`;

        return res.redirect(redirectUrl);

    } catch (error: any) {
        console.error("Auth Callback Error:", error);
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
