import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../_lib/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

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
    if (req.method !== 'PATCH') return res.status(405).json({ error: "Method Not Allowed" });

    try {
        const { taskId, date, estimated_minutes } = req.body;

        if (!taskId) return res.status(400).json({ error: "Missing taskId" });

        const db = getDb();
        const taskRef = db.collection('tasks').doc(taskId);

        const updates: any = {
            updated_at: FieldValue.serverTimestamp()
        };

        if (date !== undefined) updates.scheduled_date = date; // Can be null to unschedule
        if (estimated_minutes !== undefined) updates.estimated_minutes = Number(estimated_minutes);

        await taskRef.update(updates);

        return res.status(200).json({ success: true, taskId, updates });

    } catch (error: any) {
        console.error("Schedule Task Error:", error);
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
