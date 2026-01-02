import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { Play, Square, ExternalLink, Activity, ArrowRight, BookOpen, Pause, Coffee } from 'lucide-react';

interface TrackerItem {
    id: string;
    name: string;
    type: 'project' | 'habit';
}

function App() {
    const [items, setItems] = useState<TrackerItem[]>([]);

    // Idle State
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [taskInput, setTaskInput] = useState('');

    // Active State
    const [isRunning, setIsRunning] = useState(false);
    const [activeItemId, setActiveItemId] = useState<string>('');
    const [activeItemType, setActiveItemType] = useState<'project' | 'habit' | null>(null);
    const [activeTaskName, setActiveTaskName] = useState('');
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsed, setElapsed] = useState(0);

    // Break Tracking
    const [status, setStatus] = useState<'active' | 'paused'>('active');
    const [lastPauseTime, setLastPauseTime] = useState<number | null>(null);
    const [totalBreakSeconds, setTotalBreakSeconds] = useState(0);
    const [breakElapsed, setBreakElapsed] = useState(0);

    const [totalSpent, setTotalSpent] = useState(0);
    const TOTAL_BUDGET = 576;

    // API URL
    const API_URL = 'https://north-star2026.vercel.app/api/sessions/manage';

    useEffect(() => {
        const init = async () => {
            // 1. Fetch Items (Projects/Habits)
            try {
                const [pSnap, hSnap, lSnap] = await Promise.all([
                    getDocs(collection(db, "projects")),
                    getDocs(collection(db, "habits")),
                    getDocs(query(collection(db, "work_logs"), where("date", ">=", "2026-01-01")))
                ]);

                const pList = pSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, type: 'project' as const })).filter(p => !p.name.includes("Archive"));
                const hList = hSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, type: 'habit' as const }));
                setItems([...pList, ...hList]);

                // Budget Calc
                const totalHours = lSnap.docs.reduce((acc, doc) => acc + (Number(doc.data().hours) || 0), 0);
                const habitTotalMin = hSnap.docs.reduce((acc, doc) => acc + (Number(doc.data().total_actual_minutes) || 0), 0);
                setTotalSpent(totalHours + (habitTotalMin / 60));

            } catch (e) {
                console.error("Init Error", e);
            }
        };
        init();

        // 2. REAL-TIME LISTENER for Active Session using Firestore
        // This ensures the extension stays in sync with Mobile/Web instantly
        const q = query(collection(db, "work_sessions"), where("status", "in", ["active", "paused"]));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const data = doc.data();

                setIsRunning(true);
                setStartTime(data.start_time);
                setActiveTaskName(data.task_name || "Focus Session");
                setStatus(data.status); // active | paused
                setLastPauseTime(data.last_pause_time || null);

                // Calculate Total Past Breaks
                const breaks = data.breaks || [];
                const totalBS = breaks.reduce((acc: number, b: any) => acc + (b.duration || 0), 0);
                setTotalBreakSeconds(totalBS);

                // Context
                if (data.project_id) {
                    setActiveItemId(data.project_id);
                    setActiveItemType('project');
                } else if (data.habit_id) {
                    setActiveItemId(data.habit_id);
                    setActiveItemType('habit');
                }

                // Sync to chrome local storage for background checks if needed
                chrome.storage.local.set({
                    activeSession: { ...data, id: doc.id },
                    startTime: data.start_time
                });

            } else {
                setIsRunning(false);
                setStartTime(null);
                setActiveTaskName('');
                setStatus('active');
                chrome.storage.local.remove(['activeSession', 'startTime']);
            }
        });

        return () => unsubscribe();
    }, []);

    // Timer Interval
    useEffect(() => {
        let interval: any;
        if (isRunning && startTime) {

            const tick = () => {
                const now = Date.now();

                if (status === 'paused' && lastPauseTime) {
                    // 1. Elapsed Focus Time is frozen at the pause moment
                    // elapsed = (lastPauseTime - startTime) - past_breaks
                    const rawElapsed = (lastPauseTime - startTime) / 1000;
                    setElapsed(Math.max(0, Math.floor(rawElapsed - totalBreakSeconds)));

                    // 2. Break Timer is running
                    // breakElapsed = now - lastPauseTime
                    setBreakElapsed(Math.floor((now - lastPauseTime) / 1000));
                } else {
                    // Active Status
                    // elapsed = (now - startTime) - past_breaks
                    const rawElapsed = (now - startTime) / 1000;
                    setElapsed(Math.max(0, Math.floor(rawElapsed - totalBreakSeconds)));
                    setBreakElapsed(0);
                }
            };

            tick();
            interval = setInterval(tick, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning, startTime, status, lastPauseTime, totalBreakSeconds]);

    // Handlers
    const handleStart = async () => {
        if (!selectedItemId || !taskInput.trim()) return;
        const item = items.find(i => i.id === selectedItemId);
        if (!item) return;

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    payload: {
                        itemId: item.id,
                        itemType: item.type,
                        itemName: taskInput,
                        startTime: Date.now()
                    }
                })
            });
            if (!res.ok) throw new Error("Start Failed");
        } catch (e) {
            alert("Connection Failed");
        }
    };

    const handlePause = async () => {
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'pause' })
            });
            // State update handled by listener
        } catch (e) { console.error(e); }
    };

    const handleResume = async () => {
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resume' })
            });
        } catch (e) { console.error(e); }
    };

    const handleStop = async () => {
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            });
            const data = await res.json();
            if (data.success) {
                setTotalSpent(prev => prev + (elapsed / 3600));
            }
        } catch (e) { console.error(e); }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const budgetProgress = Math.min((totalSpent / TOTAL_BUDGET) * 100, 100);

    return (
        <div className="w-full h-full bg-[#020617] text-white font-sans flex flex-col">
            {/* Header: Budget Tracker */}
            <div className="p-4 border-b border-white/5 bg-slate-900/50">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-blue-400 font-bold tracking-wider uppercase flex items-center gap-2">
                        <Activity size={12} /> 576H Budget
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                        {totalSpent.toFixed(1)} / {TOTAL_BUDGET}h
                    </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 shadow-glow" style={{ width: `${budgetProgress}%` }} />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 flex flex-col justify-center items-center relative overflow-hidden">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 blur-[80px] rounded-full pointer-events-none transition-all duration-1000 ${!isRunning ? 'bg-blue-600/10 opacity-20' :
                    status === 'paused' ? 'bg-amber-600/20 opacity-100' :
                        'bg-blue-600/10 opacity-100'}`}
                />

                {!isRunning ? (
                    <div className="w-full z-10 space-y-4">
                        <div className="text-center mb-2">
                            <h2 className="text-xl font-bold text-white mb-1">Focus Mode</h2>
                            <p className="text-xs text-slate-500">Track a Project or Habit</p>
                        </div>
                        {/* Project Selector */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-slate-500 font-bold ml-1">Target Activity</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500 appearance-none transition-all"
                                    value={selectedItemId}
                                    onChange={(e) => setSelectedItemId(e.target.value)}
                                >
                                    <option value="">Select...</option>
                                    <optgroup label="🚀 Projects">
                                        {items.filter(i => i.type === 'project').map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="✅ Habits">
                                        {items.filter(i => i.type === 'habit').map(h => (
                                            <option key={h.id} value={h.id}>{h.name}</option>
                                        ))}
                                    </optgroup>
                                </select>
                                <div className="absolute right-3 top-3.5 pointer-events-none text-slate-500">
                                    <ArrowRight size={14} className="rotate-90" />
                                </div>
                            </div>
                        </div>

                        {/* Task Input (New) */}
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-slate-500 font-bold ml-1">Specific Task</label>
                            <input
                                type="text"
                                placeholder="What are you working on?"
                                className="w-full bg-slate-800/50 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500 transition-all"
                                value={taskInput}
                                onChange={(e) => setTaskInput(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={handleStart}
                            disabled={!selectedItemId || !taskInput.trim()}
                            className="w-full mt-4 group bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                        >
                            <Play size={18} fill="currentColor" /> Start Timer
                        </button>
                    </div>
                ) : (
                    <div className="w-full z-10 flex flex-col items-center">
                        {/* Status Label */}
                        <div className={`mb-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border flex items-center gap-2 ${status === 'paused' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status === 'paused' ? 'bg-amber-400' : 'bg-blue-400 animate-pulse'}`}></span>
                            {status === 'paused' ? 'Paused' : 'Focusing'}
                        </div>

                        {/* Main Timer */}
                        <div className="mb-2 relative">
                            <div className={`text-6xl font-mono font-bold tracking-tighter transition-colors ${status === 'paused' ? 'text-amber-100' : 'text-white'}`}>
                                {formatTime(elapsed)}
                            </div>
                        </div>

                        {/* Break Timer Display */}
                        {status === 'paused' && (
                            <div className="mb-6 flex items-center gap-2 text-amber-400 font-mono text-xs bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 animate-pulse">
                                <Coffee size={12} /> Break Time: {formatTime(breakElapsed)}
                            </div>
                        )}

                        <div className="text-center mb-8 px-4">
                            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest mb-2">
                                {activeItemType === 'habit' ? <BookOpen size={10} /> : <Activity size={10} />}
                                {items.find(i => i.id === activeItemId)?.name || 'Unknown Context'}
                            </div>
                            <h3 className="text-lg font-bold text-blue-200 leading-tight">
                                {activeTaskName}
                            </h3>
                        </div>

                        {/* CONTROLS */}
                        <div className="flex w-full gap-3">
                            {/* PAUSE / RESUME */}
                            <button
                                onClick={status === 'paused' ? handleResume : handlePause}
                                className={`flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${status === 'paused'
                                    ? 'bg-amber-500 hover:bg-amber-400 text-black border border-amber-400'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10'
                                    }`}
                            >
                                {status === 'paused' ? (
                                    <> <Play size={16} fill="currentColor" /> Resume </>
                                ) : (
                                    <> <Pause size={16} fill="currentColor" /> Pause </>
                                )}
                            </button>

                            {/* STOP */}
                            <button
                                onClick={handleStop}
                                className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                                <Square size={16} fill="currentColor" /> Stop
                            </button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/5 w-full flex justify-center">
                            <a
                                href="https://north-star2026.vercel.app/focus"
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors border border-blue-500/30 px-4 py-2 rounded-lg bg-blue-500/5"
                            >
                                <ExternalLink size={12} /> Open Focus Mode
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-950 flex justify-center border-t border-white/5">
                <a
                    href="https://north-star2026.vercel.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-[10px] text-slate-600 hover:text-blue-400 transition-colors"
                >
                    Dashboard <ExternalLink size={10} />
                </a>
            </div>
        </div>
    );
}

export default App;
