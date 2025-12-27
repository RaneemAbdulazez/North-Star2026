import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Square } from 'lucide-react';
import { useActiveSession } from '../hooks/useActiveSession';

export function MobileTimerFab() {
    const { activeSession, loading } = useActiveSession();
    const [elapsed, setElapsed] = useState(0);
    const [stopping, setStopping] = useState(false);

    // DEBUG: Force a mock session if none exists to prove UI visibility
    // Remove this after verifying UI
    const debugSession = !activeSession ? {
        task_name: "DEBUG: No Active Session Found",
        start_time: Date.now() - 10000
    } : activeSession;

    // Use displaySession for everything (Logic + Display)
    const session = activeSession || debugSession;

    useEffect(() => {
        if (!session) {
            setElapsed(0);
            return;
        }

        // Calculate initial elapsed to prevent 00:00 jump
        const now = Date.now();
        const start = session.start_time;
        setElapsed(Math.floor((now - start) / 1000));

        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [session]);

    const handleStop = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent drawer opening if we click stop
        if (stopping) return;
        setStopping(true);

        try {
            await fetch('/api/sessions/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            });
        } catch (error) {
            console.error("Failed to stop session:", error);
            alert("Failed to stop session. Check connection.");
        } finally {
            setStopping(false);
        }
    };

    if (loading) return null;

    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Use session (debug or real) for rendering check
    if (!session) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-6 right-6 z-50 md:hidden"
            >
                <div className="flex items-center gap-4 bg-[#0F172A]/90 backdrop-blur-xl border border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] p-2 pl-2 pr-4 rounded-full min-w-[280px] md:min-w-0">
                    <div className="relative shrink-0">
                        <div className="absolute inset-0 bg-blue-500 blur-lg opacity-40 rounded-full animate-pulse-slow"></div>
                        <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-blue-400 flex items-center justify-center relative z-10">
                            <Timer size={20} className="text-blue-400" />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-blue-300 font-bold mb-0.5 truncate">
                            {session.task_name || "Focus Session"}
                        </div>
                        <div className="text-xl font-mono font-bold text-white leading-none shadow-black drop-shadow-md">
                            {formatTime(elapsed)}
                        </div>
                    </div>

                    <button
                        onClick={handleStop}
                        disabled={stopping}
                        className="w-10 h-10 shrink-0 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-500 transition-all active:scale-95"
                    >
                        {stopping ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Square size={16} fill="currentColor" />}
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
