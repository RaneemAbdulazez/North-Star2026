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

        // TRACE: Log that callback was hit
        try {
            const db = getDb();
            await db.collection('_debug').doc('callback_hit_latest').set({
                timestamp: new Date().toISOString(),
                query: req.query || {},
                headers_host: req.headers['host'] || 'unknown'
            });
            console.log("TRACE: Callback hit logged to DB");
        } catch (traceErr) {
            console.error("TRACE FAILED:", traceErr);
        }

        console.log("Exchanging code for tokens...");
        const { tokens } = await oauth2Client.getToken(code);
        console.log("Tokens received (Masked):", !!tokens.access_token);

        console.log("Initializing Firestore...");
        const db = getDb();
        const userId = 'default';

        console.log(`Saving tokens for user: ${userId}...`);

        // Explicitly await and check result
        await db.collection('users').doc(userId).collection('integrations').doc('google').set({
            ...tokens,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log("Tokens saved successfully. Redirecting...");

        // Redirect to frontend
        const frontendUrl = 'https://north-star2026.vercel.app';
        return res.redirect(`${frontendUrl}/weekly-planner?sync=true`);

    } catch (error: any) {
        console.error("Auth Callback Fatal Error:", error);

        // Persist error to DB for debugging
        try {
            const db = getDb();
            await db.collection('_debug').doc('auth_error').set({
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
        } catch (filesysError) {
            console.error("Failed to log error to DB:", filesysError);
        }

        // Redirect with error param so user sees it
        const frontendUrl = 'https://north-star2026.vercel.app';
        const errorMsg = encodeURIComponent(error.message || "Unknown Callback Error");
        return res.redirect(`${frontendUrl}/weekly-planner?sync=false&error=${errorMsg}`);
    }
}

export default allowCors(handler);
