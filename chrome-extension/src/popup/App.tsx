import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Play, Square, ExternalLink, Activity, ArrowRight, BookOpen } from 'lucide-react';

interface TrackerItem {
    id: string;
    name: string;
    type: 'project' | 'habit';
}

function App() {
    const [items, setItems] = useState<TrackerItem[]>([]);
    const [activeItemId, setActiveItemId] = useState<string>('');
    const [activeItemType, setActiveItemType] = useState<'project' | 'habit' | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [totalSpent, setTotalSpent] = useState(0);
    const TOTAL_BUDGET = 240;

    // API URL - Ideally from env or config, hardcoding for stability in extension context
    const API_URL = 'https://north-star2026.vercel.app/api/sessions/manage';

    useEffect(() => {
        const init = async () => {
            // 1. Fetch Items
            try {
                const [pSnap, hSnap, lSnap] = await Promise.all([
                    getDocs(collection(db, "projects")),
                    getDocs(collection(db, "habits")),
                    getDocs(collection(db, "work_logs"))
                ]);

                const pList = pSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, type: 'project' as const })).filter(p => !p.name.includes("Archive"));
                const hList = hSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name, type: 'habit' as const }));
                setItems([...pList, ...hList]);

                // Budget Calc
                const totalHours = lSnap.docs.reduce((acc, doc) => acc + (Number(doc.data().hours) || 0), 0);
                const habitTotalMin = hSnap.docs.reduce((acc, doc) => acc + (Number(doc.data().total_actual_minutes) || 0), 0);
                setTotalSpent(totalHours + (habitTotalMin / 60));

                // 2. CHECK ACTIVE SESSION from API
                const res = await fetch(`${API_URL}?action=get`);
                const sessionData = await res.json();

                if (sessionData.active && sessionData.session) {
                    const s = sessionData.session;
                    setIsRunning(true);
                    setStartTime(s.start_time);
                    if (s.project_id) {
                        setActiveItemId(s.project_id);
                        setActiveItemType('project');
                    } else if (s.habit_id) {
                        setActiveItemId(s.habit_id);
                        setActiveItemType('habit');
                    }
                }

            } catch (e) {
                console.error("Init Error", e);
            }
        };
        init();
    }, []);

    // Timer Interval
    useEffect(() => {
        let interval: any;
        if (isRunning && startTime) {
            // Immediate update
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
            interval = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning, startTime]);

    const handleStart = async () => {
        if (!activeItemId) return;
        const item = items.find(i => i.id === activeItemId);
        if (!item) return;

        const now = Date.now();
        // Optimistic UI update
        setStartTime(now);
        setIsRunning(true);
        setActiveItemType(item.type);

        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    payload: {
                        itemId: activeItemId,
                        itemType: item.type,
                        itemName: item.name,
                        startTime: now
                    }
                })
            });
        } catch (e) {
            console.error("Failed to start session:", e);
            setIsRunning(false); // revert
            alert("Connection error. Could not start timer.");
        }
    };

    const handleStop = async () => {
        if (!isRunning) return;

        // Optimistic UI
        setIsRunning(false);
        const finalElapsed = elapsed;

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' })
            });
            const data = await res.json();

            if (data.success) {
                setTotalSpent(prev => prev + (finalElapsed / 3600));
                setStartTime(null);
                setElapsed(0);
            } else {
                throw new Error(data.error);
            }

        } catch (e: any) {
            console.error("Failed to stop session:", e);
            alert(`Failed to stop/save session: ${e.message}`);
            // Force state reset anyway to avoid UI lock
            setIsRunning(false);
        }
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
                        <Activity size={12} /> 240H Budget
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                        {totalSpent.toFixed(1)} / {TOTAL_BUDGET}h
                    </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 shadow-glow"
                        style={{ width: `${budgetProgress}%` }}
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 flex flex-col justify-center items-center relative overflow-hidden">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none transition-opacity duration-1000 ${isRunning ? 'opacity-100' : 'opacity-20'}`} />

                {!isRunning ? (
                    <div className="w-full z-10 space-y-6">
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-white mb-1">Focus Mode</h2>
                            <p className="text-xs text-slate-500">Track a Project or Habit</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] uppercase text-slate-500 font-bold ml-1">Target Activity</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500 appearance-none"
                                    value={activeItemId}
                                    onChange={(e) => setActiveItemId(e.target.value)}
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

                        <button
                            onClick={handleStart}
                            disabled={!activeItemId}
                            className="w-full group bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
                        >
                            <Play size={18} fill="currentColor" /> Start Timer
                        </button>
                    </div>
                ) : (
                    <div className="w-full z-10 flex flex-col items-center">
                        <div className="mb-8 relative">
                            <div className="text-6xl font-mono font-bold text-white tracking-tighter">
                                {formatTime(elapsed)}
                            </div>
                            <div className="absolute -right-4 top-2 w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                        </div>

                        <div className="text-center mb-8">
                            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                                {activeItemType === 'habit' ? <BookOpen size={10} /> : <Activity size={10} />}
                                {activeItemType === 'habit' ? 'Habit' : 'Project'}
                            </div>
                            <h3 className="text-lg font-bold text-blue-200 mt-1">
                                {items.find(i => i.id === activeItemId)?.name}
                            </h3>
                        </div>

                        <button
                            onClick={handleStop}
                            className="group bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-500 font-bold py-3 px-8 rounded-full flex items-center gap-2 transition-all hover:scale-105"
                        >
                            <Square size={16} fill="currentColor" /> Stop & Save
                        </button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-950 flex justify-center border-t border-white/5">
                <a
                    href="https://north-star2026-q54mxx1iv-raneemabdulazezs-projects.vercel.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-[10px] text-slate-600 hover:text-blue-400 transition-colors"
                >
                    Dashboard <ExternalLink size={10} />
                </a>
                <span className="text-slate-800 mx-2">|</span>
                <button
                    onClick={() => chrome.runtime.sendMessage({ action: 'test_notification' })}
                    className="text-[10px] text-slate-600 hover:text-blue-400 transition-colors"
                >
                    Test Alert
                </button>
            </div>
        </div>
    );
}

export default App;
