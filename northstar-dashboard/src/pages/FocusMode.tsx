import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Square, ArrowLeft, MoreHorizontal, Timer, CheckCircle2 } from 'lucide-react';
import { useActiveSession } from '../hooks/useActiveSession';

export default function FocusMode() {
    const { activeSession, loading } = useActiveSession();
    const navigate = useNavigate();

    // UI State
    const [elapsed, setElapsed] = useState(0);
    const [stopping, setStopping] = useState(false);

    // Timer Interval Logic
    useEffect(() => {
        if (!activeSession) {
            setElapsed(0);
            return;
        }

        // Calculate initial elapsed
        const now = Date.now();
        const start = activeSession.start_time;
        setElapsed(Math.max(0, Math.floor((now - start) / 1000)));

        const interval = setInterval(() => {
            const current = Date.now();
            setElapsed(Math.max(0, Math.floor((current - start) / 1000)));
        }, 1000);

        return () => clearInterval(interval);
    }, [activeSession]);

    // Handlers
    const handleStop = async () => {
        if (stopping) return;
        setStopping(true);

        try {
            await fetch('/api/sessions/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            });
            // DB update will trigger useActiveSession -> activeSession becomes null
        } catch (error) {
            console.error("Failed to stop session:", error);
            alert("Connection error.");
        } finally {
            setStopping(false);
        }
    };

    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return { h, m, s };
    };

    const time = formatTime(elapsed);

    // -------------------------------------------------------------------------
    // RENDER: Loading
    // -------------------------------------------------------------------------
    if (loading) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <div className="animate-pulse text-sm tracking-widest uppercase">Syncing Focus Space...</div>
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // RENDER: Idle State (No Active Session)
    // -------------------------------------------------------------------------
    if (!activeSession) {
        return (
            <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center relative overflow-hidden p-6">
                <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative z-10 text-center max-w-md"
                >
                    <div className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/5">
                        <Timer size={32} className="text-slate-400" />
                    </div>

                    <h1 className="text-3xl font-bold mb-3 tracking-tight">Ready to Focus?</h1>
                    <p className="text-slate-400 mb-8 leading-relaxed">
                        Start a timer from the <span className="text-white font-medium">Extension</span> or <span className="text-white font-medium">Dashboard</span> to enter the flow state.
                    </p>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-4 rounded-xl transition-all border border-slate-700 hover:border-slate-600 flex items-center justify-center gap-2 group"
                    >
                        Go to Dashboard <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform order-first" />
                    </button>
                </motion.div>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // RENDER: Active Focus Session
    // -------------------------------------------------------------------------
    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col relative overflow-hidden">
            {/* Ambient Background - Dynamic Pulse */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-indigo-600/10 blur-[100px] rounded-full" />
            </div>

            {/* Header */}
            <div className="p-6 flex justify-between items-center relative z-20">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <span className="text-xs font-bold tracking-widest text-blue-500 uppercase">Focus Mode</span>
                </div>
                <button className="p-2 text-slate-400 hover:text-white transition-colors">
                    <MoreHorizontal size={24} />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="mb-12 text-center w-full max-w-2xl"
                >
                    <div className="text-xs font-bold text-slate-500 mb-4 tracking-widest uppercase">Currently Working On</div>

                    {/* Task Name - Prominent Display */}
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight break-words">
                        {activeSession.task_name || "Deep Work"}
                    </h1>

                    {/* Tags/Badges */}
                    <div className="flex flex-wrap justify-center gap-3">
                        {activeSession.project_id && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium">
                                <BriefcaseIcon /> Project
                            </div>
                        )}
                        {activeSession.habit_id && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium">
                                <CheckCircle2 size={12} /> Habit
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Timer Display */}
                <div className="mb-20 relative">
                    <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />

                    <div className="flex items-baseline gap-2 font-mono font-bold text-8xl md:text-9xl text-white drop-shadow-[0_0_20px_rgba(59,130,246,0.5)] tabular-nums">
                        {time.h > 0 && (
                            <>
                                <span>{time.h}</span>
                                <span className="text-4xl text-slate-600">:</span>
                            </>
                        )}
                        <span>{time.m.toString().padStart(2, '0')}</span>
                        <span className="text-4xl text-slate-600 animate-pulse">:</span>
                        <span>{time.s.toString().padStart(2, '0')}</span>
                    </div>
                    <div className="text-center text-slate-500 text-xs mt-4 font-bold tracking-[0.2em]">ELAPSED TIME</div>
                </div>

                {/* Controls */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStop}
                    disabled={stopping}
                    className="group relative flex items-center justify-center w-24 h-24 rounded-full bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500/30 hover:border-red-500 transition-all duration-300"
                >
                    {stopping ? (
                        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Square size={32} className="text-red-500 group-hover:scale-110 transition-transform" fill="currentColor" />
                    )}
                </motion.button>
                <div className="mt-4 text-xs font-bold text-red-500/50 uppercase tracking-widest">Stop Session</div>

            </div>
        </div>
    );
}

// Simple Icon component
const BriefcaseIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
);
