import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

const allowCors = (fn: any) => async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT,OPTIONS');
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
        // --- GET: List Tasks ---
        if (req.method === 'GET') {
            const { goalId } = req.query;

            if (goalId) {
                // Fetch sub-tasks for a specific goal
                const tasksRef = db.collection('users').doc(userId)
                    .collection('goals').doc(goalId as string).collection('tasks');

                const snapshot = await tasksRef.orderBy('created_at', 'asc').get();
                const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                return res.status(200).json({ tasks });
            }

            // Legacy / Top-level tasks (Backlog)
            const tasksRef = db.collection('tasks');
            const snapshot = await tasksRef.where('status', '!=', 'done').get();
            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            return res.status(200).json({ tasks });
        }

        // --- POST: Create Task ---
        if (req.method === 'POST') {
            const { title, estimated_minutes, goalId, scheduled_date } = req.body;

            if (!title) return res.status(400).json({ error: "Missing title" });

            const newTask = {
                title,
                estimated_minutes: Number(estimated_minutes) || 30,
                status: 'todo',
                scheduled_date: scheduled_date || null,
                created_at: FieldValue.serverTimestamp()
            };

            let docRef;
            if (goalId) {
                // Write to sub-collection
                docRef = await db.collection('users').doc(userId)
                    .collection('goals').doc(goalId).collection('tasks').add(newTask);
            } else {
                // Legacy / Top-level
                docRef = await db.collection('tasks').add(newTask);
            }

            return res.status(201).json({ id: docRef.id, ...newTask, goalId });
        }

        // --- PATCH: Update Task ---
        if (req.method === 'PATCH') {
            const { taskId, goalId, date, estimated_minutes, status, isDone } = req.body;

            if (!taskId) return res.status(400).json({ error: "Missing taskId" });

            let taskRef;
            // Polymorphic update: try to find where the task is if goalId is not provided?
            // For now, client MUST provide goalId if it's a nested task.
            if (goalId) {
                taskRef = db.collection('users').doc(userId)
                    .collection('goals').doc(goalId).collection('tasks').doc(taskId);
            } else {
                taskRef = db.collection('tasks').doc(taskId);
            }

            const updates: any = {
                updated_at: FieldValue.serverTimestamp()
            };

            if (date !== undefined) updates.scheduled_date = date;
            if (estimated_minutes !== undefined) updates.estimated_minutes = Number(estimated_minutes);
            if (status !== undefined) updates.status = status;
            if (isDone !== undefined) updates.status = isDone ? 'done' : 'todo';

            await taskRef.update(updates);

            // --- Log Sync Logic ---
            // Create a time_logs entry if the task is being scheduled
            if (date && (req.body.time || updates.scheduled_time)) {
                const timeStr = req.body.time || "09:00:00";
                const startDateTime = new Date(`${date}T${timeStr}`);
                const durationMinutes = Number(estimated_minutes) || 60; // Default
                const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
                const hours = durationMinutes / 60;

                const logEntry = {
                    task_id: taskId,
                    goal_id: goalId || null,
                    project_id: req.body.projectId || null, // Expect projectId in body
                    task_name: req.body.title || 'United Task', // Might need to fetch if not strictly passed, but for now ok
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    date: startDateTime.toISOString(),
                    hours: hours,
                    source: "Weekly Planner",
                    status: "Scheduled",
                    created_at: FieldValue.serverTimestamp()
                };

                await db.collection('work_logs').add(logEntry);

                // Also update project spent hours? 
                // "Track so it can be deducted from the 425h Quarterly Budget"
                // Usually "Spent" means done. "Scheduled" means planned.
                // Assuming we deduct purely based on logs.
                if (req.body.projectId) {
                    const projectRef = db.collection('projects').doc(req.body.projectId);
                    // We might want to track 'scheduled_hours' separate from 'spent_hours' or just generic usage.
                    // For now, I'll log it. Deducting from budget usually happens when summing logs.
                    // If the dashboard sums 'work_logs', then adding this entry IS deducting it.
                }
            }

            return res.status(200).json({ success: true, taskId, updates });
        }

        return res.status(405).json({ error: "Method Not Allowed" });

    } catch (error: any) {
        console.error("Tasks API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}

export default allowCors(handler);
