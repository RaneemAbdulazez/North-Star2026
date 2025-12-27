import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Square, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { useActiveSession } from '../hooks/useActiveSession';

export default function FocusMode() {
    const { activeSession, loading } = useActiveSession();
    const navigate = useNavigate();
    const [elapsed, setElapsed] = useState(0);
    const [stopping, setStopping] = useState(false);

    // Redirect if no session (after initial load)
    useEffect(() => {
        if (!loading && !activeSession) {
            navigate('/');
        }
    }, [activeSession, loading, navigate]);

    // Timer Logic
    useEffect(() => {
        if (!activeSession) return;

        // Initial set
        setElapsed(Math.floor((Date.now() - activeSession.start_time) / 1000));

        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - activeSession.start_time) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [activeSession]);

    const handleStop = async () => {
        if (stopping) return;
        setStopping(true);

        try {
            await fetch('/api/sessions/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            });
            // Navigation will happen automatically via useActiveSession -> null -> useEffect redirect
        } catch (error) {
            console.error("Failed to stop session:", error);
            alert("Connection error.");
            setStopping(false);
        }
    };

    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return { h, m, s };
    };

    if (loading || !activeSession) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500">
                <div className="animate-pulse">Loading Focus Space...</div>
            </div>
        );
    }

    const time = formatTime(elapsed);

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col relative overflow-hidden">
            {/* Ambient Background */}
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
                <div className="text-xs font-bold tracking-widest text-blue-500 uppercase">Focus Mode</div>
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
                    className="mb-12 text-center"
                >
                    <div className="text-sm font-medium text-slate-400 mb-4 tracking-wide uppercase">Current Task</div>
                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 leading-tight max-w-2xl mx-auto">
                        {activeSession.task_name || "Deep Work Session"}
                    </h1>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        Focusing
                    </div>
                </motion.div>

                {/* Timer Display */}
                <div className="mb-16 relative">
                    {/* Glowing Ring */}
                    <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />

                    <div className="flex items-baseline gap-2 font-mono font-bold text-8xl md:text-9xl text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
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
                    <div className="text-center text-slate-500 text-sm mt-4 font-medium tracking-widest">ELAPSED TIME</div>
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
