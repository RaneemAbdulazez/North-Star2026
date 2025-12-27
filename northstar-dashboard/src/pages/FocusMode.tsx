import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Square, ArrowLeft, MoreHorizontal, Play, Briefcase } from 'lucide-react';
import { useActiveSession } from '../hooks/useActiveSession';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

interface TrackerItem {
    id: string;
    name: string;
    type: 'project' | 'habit';
}

export default function FocusMode() {
    const { activeSession, loading: sessionLoading } = useActiveSession();
    const navigate = useNavigate();

    // Timer State
    const [elapsed, setElapsed] = useState(0);
    const [stopping, setStopping] = useState(false);

    // Form State
    const [items, setItems] = useState<TrackerItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [selectedId, setSelectedId] = useState('');
    const [taskName, setTaskName] = useState('');
    const [starting, setStarting] = useState(false);

    // 1. Fetch Projects/Habits on Mount
    useEffect(() => {
        const fetchItems = async () => {
            try {
                const [pSnap, hSnap] = await Promise.all([
                    getDocs(query(collection(db, "projects"))),
                    getDocs(collection(db, "habits"))
                ]);

                const pList = pSnap.docs
                    .map(doc => ({ id: doc.id, name: doc.data().name, type: 'project' as const }))
                    .filter(p => !p.name.includes("Archive")); // Filter archived if needed

                const hList = hSnap.docs
                    .map(doc => ({ id: doc.id, name: doc.data().name, type: 'habit' as const }));

                setItems([...pList, ...hList]);
            } catch (error) {
                console.error("Failed to fetch items:", error);
            } finally {
                setLoadingItems(false);
            }
        };

        fetchItems();
    }, []);

    // 2. Timer Logic
    useEffect(() => {
        if (!activeSession) {
            setElapsed(0);
            return;
        }

        const now = Date.now();
        const start = activeSession.start_time;
        setElapsed(Math.max(0, Math.floor((now - start) / 1000)));

        const interval = setInterval(() => {
            const current = Date.now();
            setElapsed(Math.max(0, Math.floor((current - start) / 1000)));
        }, 1000);

        return () => clearInterval(interval);
    }, [activeSession]);

    // 3. Handlers
    const handleStart = async () => {
        if (!selectedId || !taskName.trim() || starting) return;
        setStarting(true);

        const item = items.find(i => i.id === selectedId);
        if (!item) return;

        try {
            const res = await fetch('/api/sessions/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    payload: {
                        itemId: item.id,
                        itemType: item.type,
                        itemName: taskName, // Using user typed task name
                        startTime: Date.now()
                    }
                })
            });

            if (!res.ok) throw new Error("Failed to start");
            // Success: activeSession hook will pick it up and trigger UI switch
        } catch (error) {
            console.error(error);
            alert("Failed to start session");
            setStarting(false);
        }
    };

    const handleStop = async () => {
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
            alert("Connection error.");
        } finally {
            setStopping(false);
            setStarting(false); // Reset start loading state if needed
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
    // RENDER
    // -------------------------------------------------------------------------

    if (sessionLoading || loadingItems) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <div className="animate-pulse text-sm tracking-widest uppercase">Initializing Scope...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col relative overflow-hidden transition-colors duration-1000">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className={`absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full transition-all duration-1000 ${activeSession ? 'animate-pulse-slow' : 'opacity-50'}`} />
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
                    {activeSession && (
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                    )}
                    <span className="text-xs font-bold tracking-widest text-blue-500 uppercase">Focus Mode</span>
                </div>
                <button className="p-2 text-slate-400 hover:text-white transition-colors">
                    <MoreHorizontal size={24} />
                </button>
            </div>

            {/* Main Interface */}
            <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 w-full max-w-lg mx-auto">
                <AnimatePresence mode="wait">

                    {/* IDLE STATE: Selection Form */}
                    {!activeSession ? (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="w-full flex flex-col gap-6"
                        >
                            <div className="text-center mb-4">
                                <h1 className="text-3xl font-bold mb-2">Ready to Enter Flow?</h1>
                                <p className="text-slate-400 text-sm">Select a target and define your task.</p>
                            </div>

                            <div className="space-y-4">
                                {/* Project Selector */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Target</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500 focus:bg-slate-900 transition-all appearance-none"
                                            value={selectedId}
                                            onChange={(e) => setSelectedId(e.target.value)}
                                        >
                                            <option value="">Select Project or Habit...</option>
                                            <optgroup label="Projects">
                                                {items.filter(i => i.type === 'project').map(i => (
                                                    <option key={i.id} value={i.id}>{i.name}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Habits">
                                                {items.filter(i => i.type === 'habit').map(i => (
                                                    <option key={i.id} value={i.id}>{i.name}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>

                                {/* Task Input */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Specific Task</label>
                                    <input
                                        type="text"
                                        placeholder="What exactly are you doing?"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-blue-500 focus:bg-slate-900 transition-all placeholder:text-slate-600"
                                        value={taskName}
                                        onChange={(e) => setTaskName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleStart}
                                disabled={!selectedId || !taskName.trim() || starting}
                                className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95 group"
                            >
                                {starting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Play size={20} fill="currentColor" /> Start Session
                                    </>
                                )}
                            </button>
                        </motion.div>
                    ) : (

                        /* ACTIVE STATE: Timer */
                        <motion.div
                            key="active"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            className="flex flex-col items-center w-full"
                        >
                            <div className="mb-12 text-center w-full">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium mb-6">
                                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                    Focusing
                                </div>

                                <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 leading-tight break-words">
                                    {activeSession.task_name || "Deep Work"}
                                </h1>

                                {/* Project Name Lookup */}
                                <div className="text-slate-400 font-medium flex items-center justify-center gap-2">
                                    <Briefcase size={14} />
                                    {items.find(i => i.id === (activeSession.project_id || activeSession.habit_id))?.name || "Unknown Context"}
                                </div>
                            </div>

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
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
