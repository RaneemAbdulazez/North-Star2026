import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/firebaseAdmin.js';
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
    const db = getDb();

    try {
        // --- GET: List Tasks ---
        if (req.method === 'GET') {
            const tasksRef = db.collection('tasks');
            const snapshot = await tasksRef
                .where('status', '!=', 'done')
                .get();

            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            return res.status(200).json({ tasks });
        }

        // --- PATCH: Schedule Task ---
        if (req.method === 'PATCH') {
            const { taskId, date, estimated_minutes } = req.body;

            if (!taskId) return res.status(400).json({ error: "Missing taskId" });

            const taskRef = db.collection('tasks').doc(taskId);

            const updates: any = {
                updated_at: FieldValue.serverTimestamp()
            };

            if (date !== undefined) updates.scheduled_date = date;
            if (estimated_minutes !== undefined) updates.estimated_minutes = Number(estimated_minutes);

            await taskRef.update(updates);

            return res.status(200).json({ success: true, taskId, updates });
        }

        return res.status(405).json({ error: "Method Not Allowed" });

    } catch (error: any) {
        console.error("Tasks API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
