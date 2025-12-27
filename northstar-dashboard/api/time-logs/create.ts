import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/lib/firebaseAdmin.js';

// Helper to handle CORS
const allowCors = (fn: any) => async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
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
        const { type, data } = req.body;

        if (!type || !data) {
            return res.status(400).json({ error: 'Missing type or data' });
        }

        if (type === 'work_log') {
            // Validate required fields for work_log
            if (!data.project_id || !data.hours) {
                return res.status(400).json({ error: 'Missing required work_log fields' });
            }

            const docRef = await db.collection('work_logs').add({
                project_id: data.project_id,
                project_name: data.project_name || 'Unknown',
                hours: Number(data.hours),
                focus_score: data.focus_score || 3,
                date: new Date(),
                created_at: new Date(),
                source: 'chrome_extension_api'
            });

            return res.status(200).json({ success: true, id: docRef.id });
        }
        else if (type === 'habit_log') {
            // Validate required fields for habit_log
            if (!data.habit_id || !data.actual_minutes) {
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
            // Note: In Admin SDK, FieldValue is available from top-level `firebase-admin/firestore`
            // But usually `db` instance from getFirestore doesn't have it directly attached as a static method of the instance.
            // We need to import FieldValue.
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
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
