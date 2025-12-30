import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { getOAuth2Client } from './_lib/googleAuth.js';
import { getDb } from './_lib/firebaseAdmin.js';

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
    const db = getDb();
    let oauth2Client;

    // 1. Robust Auth Initialization
    try {
        oauth2Client = getOAuth2Client();
    } catch (e: any) {
        console.error("OAuth Config Error:", e.message);
        return res.status(400).json({ error: "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env vars." });
    }

    try {
        // --- GET: Fetch Events ---
        if (req.method === 'GET') {
            const { start, end } = req.query;

            const doc = await db.collection('settings').doc('google_calendar').get();
            if (!doc.exists) {
                return res.status(401).json({ error: "Google Calendar not connected" });
            }

            const tokens = doc.data();
            oauth2Client.setCredentials(tokens as any);

            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            // 2. Primary Calendar Fetch + Timezone
            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: start as string,
                timeMax: end as string,
                timeZone: 'America/Toronto', // Explicit Timezone
                singleEvents: true,
                orderBy: 'startTime',
            });

            return res.status(200).json({ events: response.data.items });
        }

        // --- POST: Sync Task ---
        if (req.method === 'POST') {
            const { title, description, startTime, endTime } = req.body;
            // ... existing checks ...
            if (!title || !startTime || !endTime) {
                return res.status(400).json({ error: "Missing required fields: title, startTime, endTime" });
            }

            const doc = await db.collection('settings').doc('google_calendar').get();
            if (!doc.exists) {
                return res.status(401).json({ error: "Google Calendar not connected" });
            }

            const tokens = doc.data();
            oauth2Client.setCredentials(tokens as any);

            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

            const event = {
                summary: title,
                description: description || '',
                start: {
                    dateTime: startTime,
                    timeZone: 'America/Toronto',
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
        }

        return res.status(405).json({ error: "Method Not Allowed" });

    } catch (error: any) {
        console.error("Calendar API Error:", error);
        if (error.code === 401 || error.message.includes('invalid_grant')) {
            return res.status(401).json({ error: "Authentication failed. Please reconnect Google Calendar." });
        }
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
