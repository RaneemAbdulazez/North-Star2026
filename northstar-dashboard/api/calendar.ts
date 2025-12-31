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
        return res.status(400).json({
            error: "Environment Configuration Error",
            message: "Missing Google Environment Variables",
            env_check: {
                has_client_id: !!process.env.GOOGLE_CLIENT_ID,
                has_client_secret: !!process.env.GOOGLE_CLIENT_SECRET
            }
        });
    }

    try {
        // --- GET: Fetch Events ---
        if (req.method === 'GET') {
            const { start, end } = req.query;
            console.log("Fetching calendar for user: default");

            // Updated path to user-specific document (using default for single-tenant)
            const doc = await db.collection('users').doc('default').collection('integrations').doc('google').get();

            console.log("Calendar API: Checking tokens for user: 'default'");

            if (!doc.exists) {
                console.log("Calendar API: No tokens found for 'default'");
                // Return empty events instead of 401 to prevent UI crash
                return res.status(200).json({ events: [] });
            }

            const tokens = doc.data();
            console.log("Calendar API: Tokens found. Access Token present?", !!tokens?.access_token);

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

            console.log("Events found:", response.data.items?.length || 0);

            return res.status(200).json({ events: response.data.items });
        }

        // --- POST: Sync Task ---
        if (req.method === 'POST') {
            const { title, description, startTime, endTime } = req.body;
            // ... existing checks ...
            if (!title || !startTime || !endTime) {
                return res.status(400).json({ error: "Missing required fields: title, startTime, endTime" });
            }

            const doc = await db.collection('users').doc('default').collection('integrations').doc('google').get();
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
        console.error("Calendar API Error Detailed:", {
            message: error.message,
            code: error.code,
            response: error.response?.data
        });

        if (error.code === 401 || error.message.includes('invalid_grant')) {
            // For GET requests, return empty array to keep UI stable
            if (req.method === 'GET') {
                return res.status(200).json({ events: [] });
            }
            return res.status(401).json({
                error: "Authentication failed",
                authUrl: "/api/auth/google"
            });
        }
        return res.status(500).json({
            error: "Calendar Sync Failed",
            message: error.message,
            details: error.response?.data || "No external API response",
            stack: error.stack
        });
    }
}

export default allowCors(handler);
