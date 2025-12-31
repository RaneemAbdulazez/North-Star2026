import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

const allowCors = (fn: any) => async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
    const db = getDb();
    const userId = 'default';

    try {
        const goalsRef = db.collection('users').doc(userId).collection('goals');

        // GET: List goals for a specific week
        if (req.method === 'GET') {
            const { weekId } = req.query;

            let query = goalsRef.orderBy('created_at', 'desc');

            if (weekId) {
                query = query.where('weekId', '==', weekId);
            }

            const snapshot = await query.get();
            const goals = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            return res.status(200).json({ goals });
        }

        // POST: Create a new goal
        if (req.method === 'POST') {
            const { title, projectId, weekId, estimatedInfo } = req.body;

            if (!title || !projectId || !weekId) {
                return res.status(400).json({ error: "Missing required fields (title, projectId, weekId)" });
            }

            const newGoal = {
                title,
                projectId,
                weekId,
                estimated_hours: Number(estimatedInfo) || 0,
                status: 'in_progress',
                created_at: FieldValue.serverTimestamp()
            };

            const docRef = await goalsRef.add(newGoal);
            return res.status(201).json({ id: docRef.id, ...newGoal });
        }

        return res.status(405).json({ error: "Method Not Allowed" });

    } catch (error: any) {
        console.error("Goals API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
