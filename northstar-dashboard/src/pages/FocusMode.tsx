import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Square, ArrowLeft, MoreHorizontal, Play, Briefcase, Pause, PlayCircle } from 'lucide-react';
import { useActiveSession } from '../hooks/useActiveSession';
import { collection, getDocs, query } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

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
    // 2. Timer Logic
    useEffect(() => {
        if (!activeSession) {
            setElapsed(0);
            return;
        }

        const calculateElapsed = () => {
            const now = Date.now();
            const start = activeSession.start_time;
            const breaks = activeSession.breaks || [];
            const totalBreakTime = breaks.reduce((acc, b) => acc + (b.duration || 0), 0);

            if (activeSession.status === 'paused' && activeSession.last_pause_time) {
                // If paused, elapsed is fixed at the moment of pause minus previous breaks
                // But wait, the breaks array usually stores COMPLETED breaks.
                // The current pause is NOT in the breaks array yet.
                // So elapsed = (last_pause - start) - total_past_breaks
                const rawElapsed = Math.floor((activeSession.last_pause_time - start) / 1000);
                setElapsed(Math.max(0, rawElapsed - totalBreakTime));
            } else {
                // Active
                const rawElapsed = Math.floor((now - start) / 1000);
                setElapsed(Math.max(0, rawElapsed - totalBreakTime));
            }
        };

        calculateElapsed();

        // Only tick if active
        if (activeSession.status === 'active') {
            const interval = setInterval(calculateElapsed, 1000);
            return () => clearInterval(interval);
        }
    }, [activeSession]);

    // 3. Handlers
    const handleStart = async () => {
        // Prevent double clicks
        if (starting) return;

        // 1. Validation
        if (!selectedId) {
            alert("Please select a Project or Habit.");
            return;
        }
        if (!taskName.trim()) {
            alert("Please enter a specific task name.");
            return;
        }

        setStarting(true);
        const item = items.find(i => i.id === selectedId);

        // Retry Logic Helper
        const attemptStart = async (retryCount = 0): Promise<void> => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s Timeout

            try {
                // Get Token (Ensure fresh auth state)
                const token = await auth.currentUser?.getIdToken();

                // Prepare Payload with UTC ISO String
                const payload = {
                    action: 'start',
                    payload: {
                        itemId: item?.id,
                        itemType: item?.type,
                        itemName: taskName,
                        startTime: new Date().toISOString() // ISO String as requested
                    }
                };

                const res = await fetch('https://north-star2026.vercel.app/api/sessions/manage', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!res.ok) {
                    const errorText = await res.text();
                    // Try to parse JSON error if possible
                    let errorMessage = errorText;
                    try {
                        const errorJson = JSON.parse(errorText);
                        if (errorJson.error) errorMessage = errorJson.error;
                    } catch (e) { /* ignore */ }

                    throw new Error(`Server Error: ${res.status} - ${errorMessage}`);
                }

                // Success
                setStarting(false);

            } catch (error: any) {
                clearTimeout(timeoutId);
                console.error(`Attempt ${retryCount + 1} failed:`, error);

                // Handle Abort/Timeout specifically
                if (error.name === 'AbortError') {
                    error.message = "Request Timed Out (10s)";
                }

                // Retry up to 1 time
                if (retryCount < 1) {
                    // Exponential backoff or just wait 1s
                    await new Promise(r => setTimeout(r, 1000));
                    return attemptStart(retryCount + 1);
                }

                // Final Failure
                alert(`Failed to start session. \nReason: ${error.message || "Network Error"}`);
                setStarting(false);
            }
        };

        await attemptStart();
    };

    const handleStop = async () => {
        if (stopping) return;
        setStopping(true);

        try {
            await fetch('https://north-star2026.vercel.app/api/sessions/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' }) // API now handles calculating net duration
            });
        } catch (error) {
            console.error("Failed to stop session:", error);
            alert("Connection error.");
        } finally {
            setStopping(false);
            setStarting(false);
        }
    };

    const handlePause = async () => {
        try {
            await fetch('https://north-star2026.vercel.app/api/sessions/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'pause' })
            });
            // Ideally optimistically update local state or re-fetch
            // For now, reliance on useActiveSession listener might lag slightly but is safer
        } catch (error) {
            console.error(error);
        }
    };

    const handleResume = async () => {
        try {
            await fetch('https://north-star2026.vercel.app/api/sessions/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resume' })
            });
        } catch (error) {
            console.error(error);
        }
    };


    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return { h, m, s };
    };

    const time = formatTime(elapsed);
    const isPaused = activeSession?.status === 'paused';

    // -------------------------------------------------------------------------
    // RENDER
    // -------------------------------------------------------------------------

    // ... (Loading state same as before) ...
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
                <div className={`absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full transition-all duration-1000 ${activeSession && !isPaused ? 'animate-pulse-slow' : 'opacity-30'}`} />
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
                    {activeSession && !isPaused && (
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                    )}
                    {isPaused && (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
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
                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium mb-6 ${isPaused ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-300'}`}>
                                    <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-blue-400 animate-pulse'}`} />
                                    {isPaused ? 'Paused' : 'Focusing'}
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
                                <div className={`absolute inset-0 blur-3xl rounded-full transition-all duration-500 ${isPaused ? 'bg-amber-500/5' : 'bg-blue-500/10'}`} />

                                <div className={`flex items-baseline gap-2 font-mono font-bold text-8xl md:text-9xl drop-shadow-[0_0_20px_rgba(59,130,246,0.5)] tabular-nums transition-colors duration-500 ${isPaused ? 'text-amber-100' : 'text-white'}`}>
                                    {time.h > 0 && (
                                        <>
                                            <span>{time.h}</span>
                                            <span className="text-4xl text-slate-600">:</span>
                                        </>
                                    )}
                                    <span>{time.m.toString().padStart(2, '0')}</span>
                                    <span className={`text-4xl text-slate-600 ${!isPaused && 'animate-pulse'}`}>:</span>
                                    <span>{time.s.toString().padStart(2, '0')}</span>
                                </div>
                                <div className="text-center text-slate-500 text-xs mt-4 font-bold tracking-[0.2em]">{isPaused ? 'SESSION PAUSED' : 'ELAPSED TIME'}</div>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-6">
                                {/* PAUSE / RESUME BUTTON */}
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={isPaused ? handleResume : handlePause}
                                    className={`group relative flex items-center justify-center w-20 h-20 rounded-full border-2 transition-all duration-300 ${isPaused ? 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 hover:border-blue-500' : 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500'}`}
                                >
                                    {isPaused ? (
                                        <PlayCircle size={32} className="text-blue-500 ml-1" fill="currentColor" />
                                    ) : (
                                        <Pause size={32} className="text-amber-500" fill="currentColor" />
                                    )}
                                </motion.button>

                                {/* STOP BUTTON */}
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
                            </div>


                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Pause Overlay (Optional visual flair) */}
            <AnimatePresence>
                {isPaused && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 pointer-events-none z-0 bg-black/40 backdrop-blur-[2px]"
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
