import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
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
    if (req.method !== 'GET') return res.status(405).json({ error: "Method Not Allowed" });

    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({ error: "Missing start or end date query parameters" });
    }

    try {
        const db = getDb();
        const doc = await db.collection('settings').doc('google_calendar').get();

        if (!doc.exists) {
            return res.status(401).json({ error: "Google Calendar not connected" });
        }

        const tokens = doc.data();
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials(tokens as any);

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: start as string,
            timeMax: end as string,
            singleEvents: true,
            orderBy: 'startTime',
        });

        // If credentials changed (e.g. refreshed), save them back
        // oauth2Client emits 'tokens' event but in serverless we might check credentials directly
        // However, googleapis usually handles refresh automatically if refresh_token is present.
        // Capturing new tokens in serverless is tricky without using the 'tokens' event listener *during* the API call?
        // Actually, oauth2Client.credentials would be updated if a refresh happened.

        // TODO: Reliable token update persisting.
        // For now, assuming basic refresh works in memory for the request duration. 
        // If it refreshed, we should persist.
        // But doing it after the request might be enough if we can access the updated credentials.

        return res.status(200).json({ events: response.data.items });

    } catch (error: any) {
        console.error("Fetch Events Error:", error);
        if (error.code === 401 || error.message.includes('invalid_grant')) {
            return res.status(401).json({ error: "Authentication failed. Please reconnect Google Calendar." });
        }
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
