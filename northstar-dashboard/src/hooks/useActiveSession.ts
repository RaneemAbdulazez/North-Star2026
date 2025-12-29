import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export interface ActiveSession {
    id: string;
    task_name: string;
    start_time: number;
    project_id?: string;
    habit_id?: string;
    status: 'active' | 'paused';
    last_pause_time?: number;
    breaks?: { start: number; end: number; duration: number }[];
}

export function useActiveSession() {
    const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Query for active OR paused sessions
        const q = query(
            collection(db, "work_sessions"),
            where("status", "in", ["active", "paused"])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                setActiveSession({ id: doc.id, ...doc.data() } as ActiveSession);
            } else {
                setActiveSession(null);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error listening to active session:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { activeSession, loading };
}
