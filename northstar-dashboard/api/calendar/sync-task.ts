import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
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
    if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });

    const { title, description, startTime, endTime } = req.body;

    if (!title || !startTime || !endTime) {
        return res.status(400).json({ error: "Missing required fields: title, startTime, endTime" });
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

        const event = {
            summary: title,
            description: description || '',
            start: {
                dateTime: startTime, // ISO format expected
                timeZone: 'America/Toronto', // Explicitly set as per requirements
            },
            end: {
                dateTime: endTime,
                timeZone: 'America/Toronto',
            },
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
        });

        return res.status(200).json({ eventId: response.data.id, link: response.data.htmlLink });

    } catch (error: any) {
        console.error("Sync Task Error:", error);
        if (error.code === 401 || error.message.includes('invalid_grant')) {
            return res.status(401).json({ error: "Authentication failed. Please reconnect Google Calendar." });
        }
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
