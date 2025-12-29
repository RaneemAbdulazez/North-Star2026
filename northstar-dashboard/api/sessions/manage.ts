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

        // 3. PAUSE Session
        if (req.method === 'POST' && action === 'pause') {
            const snapshot = await db.collection('work_sessions')
                .where('status', '==', 'active')
                .limit(1)
                .get();

            if (snapshot.empty) return res.status(404).json({ error: "No active session" });
            const doc = snapshot.docs[0];

            await doc.ref.update({
                status: 'paused',
                last_pause_time: Date.now()
            });

            return res.status(200).json({ success: true, status: 'paused' });
        }

        // 4. RESUME Session
        if (req.method === 'POST' && action === 'resume') {
            const snapshot = await db.collection('work_sessions')
                .where('status', '==', 'paused')
                .limit(1)
                .get();

            if (snapshot.empty) return res.status(404).json({ error: "No paused session" });
            const doc = snapshot.docs[0];
            const data = doc.data();

            const now = Date.now();
            const pauseStart = data.last_pause_time || now;
            const breakDuration = Math.floor((now - pauseStart) / 1000);

            const breakEntry = {
                start: pauseStart,
                end: now,
                duration: breakDuration
            };

            await doc.ref.update({
                status: 'active',
                last_pause_time: FieldValue.delete(),
                breaks: FieldValue.arrayUnion(breakEntry)
            });

            return res.status(200).json({ success: true, status: 'active', breakAdded: breakEntry });
        }

        // 5. STOP Session
        if (req.method === 'POST' && action === 'stop') {
            // Find Active OR Paused session
            const activeSnapshot = await db.collection('work_sessions').where('status', '==', 'active').limit(1).get();
            const pausedSnapshot = await db.collection('work_sessions').where('status', '==', 'paused').limit(1).get();

            let doc;
            if (!activeSnapshot.empty) doc = activeSnapshot.docs[0];
            else if (!pausedSnapshot.empty) doc = pausedSnapshot.docs[0];
            else return res.status(404).json({ error: "No session found to stop" });

            const data = doc.data();
            const endTime = Date.now();

            // Calculate Wall Clock Duration
            const wallDurationSec = Math.floor((endTime - data.start_time) / 1000);

            // Calculate Breaks
            let breaks = data.breaks || [];

            // If stopped while paused, finalize the pending break
            if (data.status === 'paused' && data.last_pause_time) {
                const finalBreakDuration = Math.floor((endTime - data.last_pause_time) / 1000);
                breaks.push({
                    start: data.last_pause_time,
                    end: endTime,
                    duration: finalBreakDuration
                });
            }

            const totalBreakTimeSec = breaks.reduce((acc: number, b: any) => acc + (b.duration || 0), 0);
            const netDurationSec = Math.max(0, wallDurationSec - totalBreakTimeSec);
            const netDurationHours = netDurationSec / 3600;
            const netDurationMin = Math.floor(netDurationSec / 60);

            // Update Session Doc (Completed)
            await doc.ref.update({
                status: 'completed',
                end_time: endTime,
                duration_seconds: netDurationSec,
                total_break_seconds: totalBreakTimeSec,
                breaks: breaks
            });

            // Create Log (Work Log or Habit Log)
            if (data.project_id) {
                await db.collection('work_logs').add({
                    project_id: data.project_id,
                    project_name: data.task_name,
                    task_name: data.task_name,
                    hours: netDurationHours, // NET HOURS
                    breaks: breaks,
                    total_break_seconds: totalBreakTimeSec,
                    date: new Date().toISOString(),
                    created_at: FieldValue.serverTimestamp()
                });

                // Update Project Spent Hours (Refund/Charge based on net)
                if (netDurationHours > 0) {
                    const projectRef = db.collection('projects').doc(data.project_id);
                    await projectRef.update({
                        spent_hours: FieldValue.increment(netDurationHours)
                    });
                }

            } else if (data.habit_id) {
                await db.collection('habit_logs').add({
                    habit_id: data.habit_id,
                    habit_name: data.task_name,
                    actual_minutes: netDurationMin, // NET MINS
                    breaks: breaks,
                    date: new Date().toISOString(),
                    created_at: FieldValue.serverTimestamp()
                });

                // Update Habit Totals
                const habitRef = db.collection('habits').doc(data.habit_id);
                await habitRef.update({
                    total_actual_minutes: FieldValue.increment(netDurationMin)
                });
            }

            return res.status(200).json({ success: true, duration: netDurationSec, breaks: totalBreakTimeSec });
        }

        return res.status(400).json({ error: "Invalid action" });

    } catch (error: any) {
        console.error("Session API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
