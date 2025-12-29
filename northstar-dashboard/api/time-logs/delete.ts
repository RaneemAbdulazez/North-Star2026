import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/lib/firebaseAdmin.js';

// Helper to handle CORS
const allowCors = (fn: any) => async (req: VercelRequest, res: VercelResponse) => {
    const allowedOrigins = [
        'chrome-extension://clnclimmpkjodcfjhbpgpobpkkbhpdpm',
        'chrome-extension://lnbmhdpfadgociijpokfoeqlppjcpmih',
        'http://localhost:5173',
        'https://north-star2026.vercel.app'
    ];
    const origin = req.headers.origin;

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
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const db = getDb();
        const { id, type } = req.body; // Expecting JSON body { "id": "...", "type": "work_log" }

        if (!id) {
            return res.status(400).json({ error: 'Missing log ID' });
        }

        const logType = type || 'work_log';

        if (logType === 'work_log') {
            await db.collection('work_logs').doc(id).delete();
            return res.status(200).json({ success: true, message: 'Log deleted' });
        } else if (logType === 'habit_log') {
            // For habit logs, we might want to decrement the total count on the habit, 
            // but for now let's just delete the log to keep it simple, 
            // or we'd need to fetch the log first to know how much to decrement.
            // As per requirements, "Refund" logic is primarily for project hours which are calculated dynamically.
            await db.collection('habit_logs').doc(id).delete();
            return res.status(200).json({ success: true, message: 'Habit log deleted' });
        } else {
            return res.status(400).json({ error: 'Invalid log type' });
        }

    } catch (error: any) {
        console.error("API Delete Error:", error);
        return res.status(500).json({
            error: error.message
        });
    }
}

export default allowCors(handler);
