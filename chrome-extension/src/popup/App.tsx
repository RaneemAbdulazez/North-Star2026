import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Play, Square, ExternalLink, Settings, CheckSquare, Square as UncheckedSquare, ArrowLeft } from 'lucide-react';

interface Project {
    id: string;
    name: string;
}

function App() {
    // Views: 'tracker' | 'settings'
    const [view, setView] = useState<'tracker' | 'settings'>('tracker');

    const [projects, setProjects] = useState<Project[]>([]);
    // Store IDs of visible projects
    const [visibleProjectIds, setVisibleProjectIds] = useState<string[]>([]);

    const [activeProject, setActiveProject] = useState<string>('');
    const [isRunning, setIsRunning] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsed, setElapsed] = useState(0);

    // Load Data on Mount
    useEffect(() => {
        const init = async () => {
            // 1. Fetch Projects from Firestore
            try {
                const querySnapshot = await getDocs(collection(db, "projects"));
                const projList = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
                setProjects(projList);
            } catch (e) {
                console.error("Error fetching projects:", e);
            }

            // 2. Load Local Storage (Active Session + Visibility Prefs)
            chrome.storage.local.get(['activeSession', 'visibleProjectIds'], (result) => {
                // Restore Session
                if (result.activeSession) {
                    setIsRunning(true);
                    setActiveProject(result.activeSession.projectId);
                    setStartTime(result.activeSession.startTime);
                }

                // Restore Visibility
                if (result.visibleProjectIds) {
                    setVisibleProjectIds(result.visibleProjectIds);
                } else {
                    // Default to all visible if first run? Or empty? Let's default to empty to force user interaction or logic.
                    // Actually better UX: default to ALL visible if nothing saved.
                    // But logic says: "default to all" might be better.
                    // Let's rely on empty check later. If empty, show message.
                }
            });
        };
        init();
    }, []);

    // Timer Tick
    useEffect(() => {
        let interval: any;
        if (isRunning && startTime) {
            interval = setInterval(() => {
                const now = Date.now();
                setElapsed(Math.floor((now - startTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning, startTime]);

    // Save Visibility Prefs when changed
    const toggleVisibility = (id: string) => {
        const newIds = visibleProjectIds.includes(id)
            ? visibleProjectIds.filter(pid => pid !== id)
            : [...visibleProjectIds, id];

        setVisibleProjectIds(newIds);
        chrome.storage.local.set({ visibleProjectIds: newIds });
    };

    const handleStart = () => {
        if (!activeProject) return;
        const now = Date.now();
        setStartTime(now);
        setIsRunning(true);
        chrome.storage.local.set({
            activeSession: { projectId: activeProject, startTime: now }
        });
    };

    const handleStop = async () => {
        if (!activeProject || !startTime) return;
        setIsRunning(false);

        const durationHours = elapsed / 3600;
        const project = projects.find(p => p.id === activeProject);

        try {
            await addDoc(collection(db, "work_logs"), {
                project_id: activeProject,
                project_name: project?.name || "Unknown",
                hours: durationHours,
                focus_score: 3,
                date: new Date(),
                created_at: serverTimestamp(),
                source: "chrome_extension"
            });

            chrome.storage.local.remove(['activeSession']);
            setElapsed(0);
            setStartTime(null);
            alert("Session Logged!");
        } catch (e) {
            console.error("Error logging:", e);
            alert("Failed to log session. Check API Keys.");
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Derived state for dropdown
    const filteredProjects = projects.filter(p => visibleProjectIds.includes(p.id));

    return (
        <div className="p-4 flex flex-col h-full items-center justify-between min-h-[450px]">
            <div className="w-full">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-xl font-bold text-primary">NorthStar</h1>
                        <p className="text-xs text-gray-400">Time Tracker</p>
                    </div>
                    <button
                        onClick={() => setView(view === 'tracker' ? 'settings' : 'tracker')}
                        className="p-2 rounded-full hover:bg-secondary transition-colors text-gray-400 hover:text-white"
                    >
                        {view === 'tracker' ? <Settings size={20} /> : <ArrowLeft size={20} />}
                    </button>
                </div>

                {view === 'tracker' ? (
                    // --- TRACKER VIEW ---
                    <>
                        {!isRunning ? (
                            <div className="flex flex-col gap-4">
                                {filteredProjects.length === 0 ? (
                                    <div className="bg-secondary/50 p-4 rounded text-center border border-dashed border-gray-700">
                                        <p className="text-sm text-gray-300 mb-2">No projects visible.</p>
                                        <button
                                            onClick={() => setView('settings')}
                                            className="text-xs text-primary hover:underline"
                                        >
                                            Select projects in Settings
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <label className="text-sm font-medium">Select Active Project</label>
                                        <select
                                            className="bg-secondary text-white p-2 rounded border border-gray-700 outline-none focus:border-primary"
                                            value={activeProject}
                                            onChange={(e) => setActiveProject(e.target.value)}
                                        >
                                            <option value="">-- Choose --</option>
                                            {filteredProjects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>

                                        <button
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded flex items-center justify-center gap-2 mt-4 transition-colors"
                                            onClick={handleStart}
                                            disabled={!activeProject}
                                        >
                                            <Play size={18} /> Start Focus
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-6 mt-4">
                                <div className="relative">
                                    <div className="text-5xl font-mono font-bold tracking-wider text-white">
                                        {formatTime(elapsed)}
                                    </div>
                                    <div className="absolute -right-6 top-0 animate-pulse text-red-500">●</div>
                                </div>

                                <div className="text-center">
                                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Working on</div>
                                    <div className="text-lg font-bold text-primary max-w-[250px] truncate leading-tight">
                                        {projects.find(p => p.id === activeProject)?.name}
                                    </div>
                                </div>

                                <button
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full flex items-center gap-2 shadow-lg hover:shadow-red-900/20 transition-all"
                                    onClick={handleStop}
                                >
                                    <Square size={16} fill="currentColor" /> Stop & Save
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    // --- SETTINGS VIEW ---
                    <div className="flex flex-col h-[300px]">
                        <h2 className="text-sm font-bold uppercase text-gray-500 tracking-wider mb-3">Project Visibility</h2>
                        <div className="overflow-y-auto flex-1 pr-1 space-y-2 custom-scrollbar">
                            {projects.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No projects found in database.</p>
                            ) : (
                                projects.map(p => {
                                    const isVisible = visibleProjectIds.includes(p.id);
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => toggleVisibility(p.id)}
                                            className={`flex items-center justify-between p-3 rounded cursor-pointer transition-colors border ${isVisible ? 'bg-secondary border-primary/30' : 'bg-transparent border-gray-800 hover:border-gray-600'}`}
                                        >
                                            <span className={`text-sm ${isVisible ? 'text-white font-medium' : 'text-gray-400'}`}>
                                                {p.name}
                                            </span>
                                            {isVisible ? (
                                                <CheckSquare size={18} className="text-primary" />
                                            ) : (
                                                <UncheckedSquare size={18} className="text-gray-600" />
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 text-center">
                            Only checked projects appear in the timer list.
                        </p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="w-full mt-auto pt-4 border-t border-gray-800 flex justify-center">
                <a href="https://north-star2026-nkfadnvaua2hgsbpavwoec.streamlit.app/" target="_blank" className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                    Open Dashboard <ExternalLink size={10} />
                </a>
            </div>
        </div>
    )
}

export default App
