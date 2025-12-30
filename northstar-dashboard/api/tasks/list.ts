import type { VercelRequest, VercelResponse } from '@vercel/node';
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

    try {
        const db = getDb();
        const tasksRef = db.collection('tasks');

        // Fetch all incomplete tasks
        // For planner, we might want tasks that are EITHER not scheduled OR scheduled for this week.
        // For simplicity, let's fetch ALL incomplete and let frontend filter.
        const snapshot = await tasksRef
            .where('status', '!=', 'done')
            .get();

        if (snapshot.empty) {
            return res.status(200).json({ tasks: [] });
        }

        const tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return res.status(200).json({ tasks });

    } catch (error: any) {
        console.error("List Tasks Error:", error);
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
