import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
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

    useEffect(() => {
        const init = async () => {
            try {
                // 1. Fetch Projects
                const pSnap = await getDocs(collection(db, "projects"));
                const pList = pSnap.docs
                    .map(doc => ({ id: doc.id, name: doc.data().name, type: 'project' as const }))
                    .filter(p => !p.name.includes("Archive"));

                // 2. Fetch Habits
                const hSnap = await getDocs(collection(db, "habits"));
                const hList = hSnap.docs
                    .map(doc => ({ id: doc.id, name: doc.data().name, type: 'habit' as const }))
                    .filter(h => h.name); // basic filter

                setItems([...pList, ...hList]);

                // 3. Calc Total Spent (Budget)
                // Naive: Just summing work_logs for now + maybe habit logs if desired?
                // For simplicity, User said "240-hour budget display". 
                // Let's grab work_logs sum.
                const lSnap = await getDocs(collection(db, "work_logs"));
                const totalHours = lSnap.docs.reduce((acc, doc) => acc + (Number(doc.data().hours) || 0), 0);

                // Add Habit hours to budget? 
                // User said: "Integrating the total_actual_minutes from habits into the overall 240-hour quarterly budget"
                // So we should fetch habits and sum their total_actual_minutes too?
                // Or assuming habits log to "work_logs" too?
                // The prompt says "Update `habit_logs` (add doc) + increment `total_actual_minutes`".
                // So we must sum `total_actual_minutes` from ALL habits.
                const habitTotalMin = hSnap.docs.reduce((acc, doc) => acc + (Number(doc.data().total_actual_minutes) || 0), 0);

                setTotalSpent(totalHours + (habitTotalMin / 60));

            } catch (e) {
                console.error("Init Error", e);
            }

            // Restore State
            chrome.storage.local.get(['activeSession'], (res) => {
                if (res.activeSession) {
                    setIsRunning(true);
                    setActiveItemId(res.activeSession.itemId);
                    setActiveItemType(res.activeSession.itemType || 'project'); // fallback
                    setStartTime(res.activeSession.startTime);
                }
            });
        };
        init();
    }, []);

    // Timer Interval
    useEffect(() => {
        let interval: any;
        if (isRunning && startTime) {
            interval = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning, startTime]);

    const handleStart = () => {
        if (!activeItemId) return;
        const item = items.find(i => i.id === activeItemId);
        if (!item) return;

        const now = Date.now();
        setStartTime(now);
        setIsRunning(true);
        setActiveItemType(item.type);

        chrome.storage.local.set({
            activeSession: { itemId: activeItemId, itemType: item.type, startTime: now }
        });
    };

    const handleStop = async () => {
        if (!activeItemId || !startTime || !activeItemType) return;

        setIsRunning(false);
        const durationHours = elapsed / 3600;
        const durationMinutes = Math.floor(elapsed / 60);
        const item = items.find(i => i.id === activeItemId);

        try {
            if (activeItemType === 'project') {
                // Log to Work Logs
                await addDoc(collection(db, "work_logs"), {
                    project_id: activeItemId,
                    project_name: item?.name || "Unknown",
                    hours: durationHours,
                    focus_score: 3,
                    date: new Date(),
                    created_at: serverTimestamp(),
                    source: "chrome_extension_manual"
                });
                // Optional: Update project spent_hours if you maintain it
            } else {
                // Log to Habit Logs
                await addDoc(collection(db, "habit_logs"), {
                    habit_id: activeItemId,
                    habit_name: item?.name || "Unknown",
                    completed_at: serverTimestamp(),
                    actual_minutes: durationMinutes,
                    source: "chrome_extension"
                });

                // Update Habit Totals (Critical for User's 240H Budget)
                const habitRef = doc(db, "habits", activeItemId);
                await updateDoc(habitRef, {
                    total_actual_minutes: increment(durationMinutes)
                });
            }

            // Cleanup & Feedback
            chrome.storage.local.remove(['activeSession']);
            setElapsed(0);
            setStartTime(null);
            setTotalSpent(prev => prev + durationHours);

        } catch (e) {
            console.error("Save failed", e);
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
                    href="https://north-star2026-nkfadnvaua2hgsbpavwoec.streamlit.app/"
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
