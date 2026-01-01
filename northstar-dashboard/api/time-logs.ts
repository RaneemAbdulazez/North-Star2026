import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/firebaseAdmin.js';
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

    if (origin && (allowedOrigins.includes(origin) || origin.startsWith('http'))) {
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
    const db = getDb();
    const action = req.query.action as string;

    try {
        // --- GET: Daily Stats ---
        if (req.method === 'GET') {
            // Default to daily-stats if no action or explicit action
            if (action === 'daily-stats' || !action) {
                const now = new Date();
                let startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                if (req.query.date) {
                    startOfDay = new Date(req.query.date as string);
                }

                const logsRef = db.collection('work_logs');
                const snapshot = await logsRef
                    .where('date', '>=', startOfDay.toISOString())
                    .get();

                let totalHours = 0;
                let projectBreakdown: { [key: string]: number } = {};

                snapshot.forEach((doc: any) => {
                    const data = doc.data();
                    const h = parseFloat(data.hours) || 0;
                    totalHours += h;
                    if (data.project_id) {
                        projectBreakdown[data.project_id] = (projectBreakdown[data.project_id] || 0) + h;
                    }
                });

                const habitsRef = db.collection('habit_logs');
                const habitSnap = await habitsRef
                    .where('completed_at', '>=', startOfDay.toISOString())
                    .get();

                let habitHours = 0;
                habitSnap.forEach((doc: any) => {
                    const data = doc.data();
                    const mins = parseFloat(data.total_actual_minutes) || 0;
                    habitHours += mins / 60;
                });

                const grandTotal = totalHours + habitHours;
                const DAILY_TARGET = 8.0; // Dynamic targets could be fetched here

                return res.status(200).json({
                    date: startOfDay.toISOString(),
                    total_hours: grandTotal,
                    work_hours: totalHours,
                    habit_hours: habitHours,
                    daily_target: DAILY_TARGET,
                    progress_percent: Math.min((grandTotal / DAILY_TARGET) * 100, 100),
                    projects: projectBreakdown
                });
            }
        }

        // --- POST: Create or Edit ---
        if (req.method === 'POST') {
            if (action === 'edit') {
                // Forward to edit logic below (shared with PATCH)
            } else {
                // CREATE Logic
                const { type, data } = req.body;

                if (!type || !data) {
                    return res.status(400).json({ error: 'Missing type or data' });
                }

                if (type === 'work_log') {
                    if (!data.project_id || data.hours === undefined) {
                        return res.status(400).json({ error: 'Missing required work_log fields' });
                    }

                    const docRef = await db.collection('work_logs').add({
                        project_id: data.project_id,
                        project_name: data.project_name || 'Unknown',
                        hours: Number(data.hours),
                        task_name: data.task_name || '',
                        focus_score: data.focus_score || 3,
                        date: data.date ? new Date(data.date) : new Date(),
                        created_at: new Date(),
                        source: data.source || 'api'
                    });

                    // Update project spent hours
                    if (data.project_id) {
                        const projectRef = db.collection('projects').doc(data.project_id);
                        await projectRef.update({
                            spent_hours: FieldValue.increment(Number(data.hours))
                        });
                    }

                    return res.status(200).json({ success: true, id: docRef.id });
                }
                else if (type === 'habit_log') {
                    if (!data.habit_id || data.actual_minutes === undefined) {
                        return res.status(400).json({ error: 'Missing required habit_log fields' });
                    }

                    const batch = db.batch();
                    const logRef = db.collection('habit_logs').doc();
                    batch.set(logRef, {
                        habit_id: data.habit_id,
                        habit_name: data.habit_name || 'Unknown',
                        completed_at: new Date(),
                        actual_minutes: Number(data.actual_minutes),
                        source: 'api'
                    });

                    const habitRef = db.collection('habits').doc(data.habit_id);
                    batch.update(habitRef, {
                        total_actual_minutes: FieldValue.increment(Number(data.actual_minutes))
                    });

                    await batch.commit();
                    return res.status(200).json({ success: true, id: logRef.id });
                }
                return res.status(400).json({ error: 'Invalid log type' });
            }
        }

        // --- PATCH: Edit ---
        if (req.method === 'PATCH' || (req.method === 'POST' && action === 'edit')) {
            const { logId, newTaskName, newDuration, type } = req.body;

            if (!logId) return res.status(400).json({ error: 'Missing log ID' });

            const logType = type || 'work_log';

            if (logType === 'work_log') {
                const logRef = db.collection('work_logs').doc(logId);
                const logSnap = await logRef.get();

                if (!logSnap.exists) return res.status(404).json({ error: 'Log not found' });

                const logData = logSnap.data();
                const oldHours = Number(logData?.hours) || 0;
                const projectId = logData?.project_id;
                const newHours = Number(newDuration);

                if (isNaN(newHours)) return res.status(400).json({ error: 'Invalid duration' });

                await logRef.update({
                    task_name: newTaskName,
                    hours: newHours,
                    updated_at: FieldValue.serverTimestamp()
                });

                const diff = newHours - oldHours;
                if (projectId && Math.abs(diff) > 0.001) {
                    const projectRef = db.collection('projects').doc(projectId);
                    await projectRef.update({
                        spent_hours: FieldValue.increment(diff)
                    });
                }

                return res.status(200).json({ success: true, message: 'Log updated', diff });
            }
            return res.status(400).json({ error: 'Edit not implemented for this type' });
        }

        // --- DELETE ---
        if (req.method === 'DELETE') {
            const getParam = (key: string) => (req.body && req.body[key]) || (req.query && req.query[key]);
            const id = getParam('id');
            const type = getParam('type') || 'work_log';

            if (!id) return res.status(400).json({ error: 'Missing log ID' });

            if (type === 'work_log') {
                const logRef = db.collection('work_logs').doc(id as string);
                const logSnap = await logRef.get();

                if (!logSnap.exists) return res.status(404).json({ error: 'Log not found' });

                const logData = logSnap.data();
                const hours = logData?.hours || 0;
                const projectId = logData?.project_id;

                await logRef.delete();

                if (projectId && hours > 0) {
                    const projectRef = db.collection('projects').doc(projectId);
                    await projectRef.update({
                        spent_hours: FieldValue.increment(-hours)
                    });
                }
                return res.status(200).json({ success: true });
            } else if (type === 'habit_log') {
                await db.collection('habit_logs').doc(id as string).delete();
                return res.status(200).json({ success: true });
            }
            return res.status(400).json({ error: 'Invalid log type' });
        }

        return res.status(405).json({ error: `Method ${req.method} not allowed` });

    } catch (error: any) {
        console.error("API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
