import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer } from 'lucide-react';
// import { db } from '../config/firebase';
// import { collection, query, where, onSnapshot } from 'firebase/firestore';

export function MobileTimerFab() {
    // Mocking active session for UI verification since extension might not sync "active" state to DB yet.
    // In real implementation, this would subscribe to firestore `work_sessions` where status == 'active'
    const [activeSession, setActiveSession] = useState<{ task: string; startTime: number } | null>(null);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        // TODO: Replace with real Firestore subscription
        // const q = query(collection(db, "work_sessions"), where("status", "==", "active"));
        // const unsub = onSnapshot(q, (snap) => {
        //     if (!snap.empty) {
        //         const data = snap.docs[0].data();
        //         setActiveSession({ task: data.task_name, startTime: data.start_time });
        //     } else {
        //         setActiveSession(null);
        //     }
        // });
        // return () => unsub();

        // Manual test override for User to see the UI
        setActiveSession({ task: "Deep Work", startTime: Date.now() - 1000 * 60 * 25 });
    }, []);

    useEffect(() => {
        if (!activeSession) return;
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - activeSession.startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [activeSession]);

    if (!activeSession) return null;

    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-6 right-6 z-50 md:hidden"
            >
                <div className="flex items-center gap-3 bg-slate-900/90 backdrop-blur-xl border border-blue-500/30 p-4 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full border-2 border-blue-500 flex items-center justify-center animate-pulse-slow">
                            <Timer size={20} className="text-blue-400" />
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-blue-300 font-bold">Active Session</div>
                        <div className="text-sm font-mono font-bold text-white">{formatTime(elapsed)}</div>
                    </div>
                    {/* Optional Stop Button? */}
                    {/* <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <StopCircle size={20} className="text-red-400" />
                    </button> */}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
