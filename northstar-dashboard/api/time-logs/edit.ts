import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../_lib/firebaseAdmin';
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
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'PATCH' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const db = getDb();
        const { logId, newTaskName, newDuration, type } = req.body;

        if (!logId) {
            return res.status(400).json({ error: 'Missing log ID' });
        }

        const logType = type || 'work_log';

        if (logType === 'work_log') {
            const logRef = db.collection('work_logs').doc(logId);
            const logSnap = await logRef.get();

            if (!logSnap.exists) {
                return res.status(404).json({ error: 'Log not found' });
            }

            const logData = logSnap.data();
            const oldHours = Number(logData?.hours) || 0;
            const projectId = logData?.project_id;

            const newHours = Number(newDuration); // newDuration should be in hours

            if (isNaN(newHours)) {
                return res.status(400).json({ error: 'Invalid duration' });
            }

            // Update the Log
            await logRef.update({
                task_name: newTaskName, // Ensure we update task_name (or project_name based on usage)
                hours: newHours,
                updated_at: FieldValue.serverTimestamp()
            });

            // Update Project Spent Hours
            const diff = newHours - oldHours;

            if (projectId && Math.abs(diff) > 0.001) {
                const projectRef = db.collection('projects').doc(projectId);
                await projectRef.update({
                    spent_hours: FieldValue.increment(diff)
                });
            }

            return res.status(200).json({ success: true, message: 'Log updated and hours reconciled', diff });
        }

        // Handle Habit Logs if needed...
        return res.status(400).json({ error: 'Edit not implemented for this log type yet' });

    } catch (error: any) {
        console.error("API Edit Error:", error);
        return res.status(500).json({
            error: error.message
        });
    }
}

export default allowCors(handler);
