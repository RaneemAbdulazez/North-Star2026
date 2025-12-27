import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../src/lib/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

// Helper to handle CORS
const handleCors = (res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Secure this in prod
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    handleCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const db = getDb();
        const { action, payload } = req.body || req.query; // Support body for POST, query for GET

        // 1. GET Active Session
        if (req.method === 'GET' || action === 'get') {
            const snapshot = await db.collection('work_sessions')
                .where('status', '==', 'active')
                .limit(1) // Assuming single user single session for now
                .get();

            if (snapshot.empty) {
                return res.status(200).json({ active: false });
            }

            const doc = snapshot.docs[0];
            return res.status(200).json({
                active: true,
                session: { id: doc.id, ...doc.data() }
            });
        }

        // 2. START Session
        if (req.method === 'POST' && action === 'start') {
            const { itemId, itemType, itemName, startTime = Date.now() } = payload;

            if (!itemId) return res.status(400).json({ error: "Missing itemId" });

            // Close any existing active sessions first to enforce single session
            const existing = await db.collection('work_sessions')
                .where('status', '==', 'active')
                .get();

            const batch = db.batch();
            existing.docs.forEach(doc => {
                batch.update(doc.ref, { status: 'interrupted', end_time: Date.now() });
            });
            await batch.commit();

            // Create new
            const newSession = {
                status: 'active',
                start_time: startTime,
                project_id: itemType === 'project' ? itemId : null,
                habit_id: itemType === 'habit' ? itemId : null,
                task_name: itemName || "Unknown Task",
                created_at: FieldValue.serverTimestamp()
            };

            const ref = await db.collection('work_sessions').add(newSession);
            return res.status(200).json({ success: true, sessionId: ref.id });
        }

        // 3. STOP Session
        if (req.method === 'POST' && action === 'stop') {
            const snapshot = await db.collection('work_sessions')
                .where('status', '==', 'active')
                .limit(1)
                .get();

            if (snapshot.empty) {
                return res.status(404).json({ error: "No active session found" });
            }

            const doc = snapshot.docs[0];
            const data = doc.data();
            const endTime = Date.now();
            const durationSec = Math.floor((endTime - data.start_time) / 1000);
            const durationMin = Math.floor(durationSec / 60);
            const durationHours = durationSec / 3600;

            // Update Session Doc
            await doc.ref.update({
                status: 'completed',
                end_time: endTime,
                duration_seconds: durationSec
            });

            // Create Log (Work Log or Habit Log)
            if (data.project_id) {
                await db.collection('work_logs').add({
                    project_id: data.project_id,
                    project_name: data.task_name, // Keeping for backward compatibility or if project_name meant task description
                    task_name: data.task_name, // Explicit new field
                    hours: durationHours,
                    date: new Date().toISOString(),
                    created_at: FieldValue.serverTimestamp()
                });
            } else if (data.habit_id) {
                await db.collection('habit_logs').add({
                    habit_id: data.habit_id,
                    habit_name: data.task_name,
                    actual_minutes: durationMin,
                    date: new Date().toISOString(),
                    created_at: FieldValue.serverTimestamp()
                });

                // Update Habit Totals
                const habitRef = db.collection('habits').doc(data.habit_id);
                await habitRef.update({
                    total_actual_minutes: FieldValue.increment(durationMin)
                });
            }

            return res.status(200).json({ success: true, duration: durationSec });
        }

        return res.status(400).json({ error: "Invalid action" });

    } catch (error: any) {
        console.error("Session API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
