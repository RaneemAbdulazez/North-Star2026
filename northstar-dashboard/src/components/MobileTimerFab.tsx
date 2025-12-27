import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Square } from 'lucide-react';
import { useActiveSession } from '../hooks/useActiveSession';

export function MobileTimerFab() {
    const { activeSession, loading } = useActiveSession();
    const [elapsed, setElapsed] = useState(0);
    const [stopping, setStopping] = useState(false);

    useEffect(() => {
        if (!activeSession) {
            setElapsed(0);
            return;
        }

        // Calculate initial elapsed to prevent 00:00 jump
        const now = Date.now();
        const start = activeSession.start_time;
        setElapsed(Math.floor((now - start) / 1000));

        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [activeSession]);

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

    // DEBUG: Force a mock session if none exists to prove UI visibility
    // Remove this after verifying UI
    const debugSession = !activeSession ? {
        task_name: "DEBUG: No Active Session Found",
        start_time: Date.now() - 10000
    } : activeSession;

    // Use debugSession for rendering
    const displaySession = activeSession || debugSession;

    if (loading) return null;
    // Always render for now to debug



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
                <div className="flex items-center gap-3 bg-slate-900/95 backdrop-blur-xl border border-blue-500/30 p-2 pl-4 pr-2 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center animate-pulse-slow">
                            <Timer size={16} className="text-blue-400" />
                        </div>
                    </div>
                    <div className="mr-2">
                        <div className="text-[9px] uppercase tracking-wider text-blue-300 font-bold leading-none mb-0.5">
                            {activeSession.task_name?.split(' ').slice(0, 2).join(' ')}...
                        </div>
                        <div className="text-sm font-mono font-bold text-white leading-none">
                            {formatTime(elapsed)}
                        </div>
                    </div>

                    <button
                        onClick={handleStop}
                        disabled={stopping}
                        className="w-10 h-10 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-500 transition-colors"
                    >
                        {stopping ? <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Square size={14} fill="currentColor" />}
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

