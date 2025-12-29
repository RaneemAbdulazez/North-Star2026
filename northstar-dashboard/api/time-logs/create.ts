import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/lib/firebaseAdmin.js';

// Helper to handle CORS
const allowCors = (fn: any) => async (req: VercelRequest, res: VercelResponse) => {
    const allowedOrigins = [
        'chrome-extension://clnclimmpkjodcfjhbpgpobpkkbhpdpm',
        'chrome-extension://lnbmhdpfadgociijpokfoeqlppjcpmih' // Local dev ID if needed, or keep rigid
    ];
    const origin = req.headers.origin;

    // Allow all for now to debug, or specific origin
    if (origin && (allowedOrigins.includes(origin) || origin.startsWith('http'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Initialize DB lazily to catch config errors here instead of crashing the module
        const db = getDb();

        const { type, data } = req.body;

        if (!type || !data) {
            return res.status(400).json({ error: 'Missing type or data' });
        }

        if (type === 'work_log') {
            // Validate required fields for work_log
            if (!data.project_id || data.hours === undefined) {
                return res.status(400).json({ error: 'Missing required work_log fields' });
            }

            const docRef = await db.collection('work_logs').add({
                project_id: data.project_id,
                project_name: data.project_name || 'Unknown',
                hours: Number(data.hours),
                focus_score: data.focus_score || 3,
                date: data.date ? new Date(data.date) : new Date(),
                created_at: new Date(),
                source: 'chrome_extension_api'
            });

            return res.status(200).json({ success: true, id: docRef.id });
        }
        else if (type === 'habit_log') {
            // Validate required fields for habit_log
            if (!data.habit_id || data.actual_minutes === undefined) {
                return res.status(400).json({ error: 'Missing required habit_log fields' });
            }

            const batch = db.batch();

            // 1. Create Log
            const logRef = db.collection('habit_logs').doc();
            batch.set(logRef, {
                habit_id: data.habit_id,
                habit_name: data.habit_name || 'Unknown',
                completed_at: new Date(),
                actual_minutes: Number(data.actual_minutes),
                source: 'chrome_extension_api'
            });

            // 2. Increment Total
            const { FieldValue } = await import('firebase-admin/firestore');

            const habitRef = db.collection('habits').doc(data.habit_id);

            batch.update(habitRef, {
                total_actual_minutes: FieldValue.increment(Number(data.actual_minutes))
            });

            await batch.commit();

            return res.status(200).json({ success: true, id: logRef.id });
        }
        else {
            return res.status(400).json({ error: 'Invalid log type' });
        }

    } catch (error: any) {
        console.error("API Error:", error);
        return res.status(500).json({
            error: error.message,
            details: "Check Vercel Function Logs for ENV var issues."
        });
    }
}

export default allowCors(handler);
