import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/lib/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

// Helper to handle CORS
const allowCors = (fn: any) => async (req: VercelRequest, res: VercelResponse) => {
    const allowedOrigins = [
        'http://localhost:5173',
        'https://north-star2026.vercel.app',
        'chrome-extension://clnclimmpkjodcfjhbpgpobpkkbhpdpm',
        'chrome-extension://lnbmhdpfadgociijpokfoeqlppjcpmih'
    ];

    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Fallback for non-browser or non-listed origins (optional: allow * if not strict)
        // But for credentials to work, we usually default to not sending header or sending logic
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const db = getDb();

        // internal helper to get param from body or query
        const getParam = (key: string) => (req.body && req.body[key]) || (req.query && req.query[key]);

        const id = getParam('id');
        const type = getParam('type') || 'work_log';

        if (!id) {
            return res.status(400).json({ error: 'Missing log ID' });
        }

        if (type === 'work_log') {
            const logRef = db.collection('work_logs').doc(id as string);
            const logSnap = await logRef.get();

            if (!logSnap.exists) {
                return res.status(404).json({ error: 'Log not found' });
            }

            const logData = logSnap.data();
            const hours = logData?.hours || 0;
            const projectId = logData?.project_id;

            // Delete the log
            await logRef.delete();

            // "Refund" the hours to the project
            // Using 'spent_hours' as per local codebase convention find in Projects.tsx
            if (projectId && hours > 0) {
                const projectRef = db.collection('projects').doc(projectId);
                await projectRef.update({
                    spent_hours: FieldValue.increment(-hours)
                });
            }

            return res.status(200).json({ success: true, message: 'Log deleted and hours refunded' });

        } else if (type === 'habit_log') {
            const logRef = db.collection('habit_logs').doc(id as string);
            await logRef.delete();
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
