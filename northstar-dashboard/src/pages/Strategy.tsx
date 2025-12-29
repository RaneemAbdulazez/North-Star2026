import { motion, AnimatePresence } from 'framer-motion';
import { Target, TrendingUp, Shield, Zap, Heart, Brain, X, ChevronRight, ChevronLeft, Clock, CheckCircle2, AlertCircle, Trash2, Pencil } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { ManualEntryModal } from '../components/ManualEntryModal';
import { EditLogModal } from '../components/EditLogModal';
import { db } from '../config/firebase';
import { collection, getDocs, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
// import { DonutChart } from '../components/DonutChart';

interface Pillar {
    id: string;
    name: string;
    description?: string;
}

interface Project {
    id: string;
    name: string;
    pillar_id?: string;
    total_hours_budget: number;
    status?: 'Active' | 'Completed';
    spent_hours?: number; // Calculated field
}

interface PillarStats {
    spent: number;
    budget: number;
    progress: number;
}


// API Helpers
const API_BASE = "https://north-star2026.vercel.app/api/time-logs";

const createLog = async (data: any) => {
    const res = await fetch(`${API_BASE}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'work_log', data })
    });
    if (!res.ok) throw new Error("Failed to create log");
    return res.json();
};

const deleteLog = async (id: string) => {
    const res = await fetch(`${API_BASE}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type: 'work_log' })
    });
    if (!res.ok) throw new Error("Failed to delete log");
    return res.json();
};

export default function Strategy() {
    const [pillars, setPillars] = useState<Pillar[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [pillarStats, setPillarStats] = useState<Record<string, PillarStats>>({});
    const [projectSpentMap, setProjectSpentMap] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    // Navigation State
    const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            // 1. Fetch Pillars
            const pillarsSnap = await getDocs(collection(db, "pillars"));
            const pillarsData = pillarsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pillar));
            setPillars(pillarsData);

            // 2. Fetch Projects
            const projectsSnap = await getDocs(collection(db, "projects"));
            const projectsData = projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
            setProjects(projectsData);

            // 3. Fetch Logs for Spent Hours (Aggregate)
            const logsSnap = await getDocs(collection(db, "work_logs"));
            const pSpent: Record<string, number> = {};

            logsSnap.forEach(doc => {
                const data = doc.data();
                const pid = data.project_id;
                const hours = Number(data.hours) || 0;
                if (pid) {
                    pSpent[pid] = (pSpent[pid] || 0) + hours;
                }
            });
            setProjectSpentMap(pSpent);

            // 4. Calculate Pillar Stats
            const stats: Record<string, PillarStats> = {};

            pillarsData.forEach(pillar => {
                const relevantProjects = projectsData.filter(p => p.pillar_id === pillar.name || p.pillar_id === pillar.id);

                let totalSpent = 0;
                let totalBudget = 0;

                relevantProjects.forEach(p => {
                    totalSpent += (pSpent[p.id] || 0);
                    totalBudget += (p.total_hours_budget || 0);
                });

                const progress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

                stats[pillar.id] = {
                    spent: totalSpent,
                    budget: totalBudget,
                    progress: Math.min(progress, 100)
                };
            });

            setPillarStats(stats);

        } catch (error) {
            console.error("Error loading strategy data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getIcon = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes('health') || lower.includes('body')) return <Heart className="text-red-400" />;
        if (lower.includes('wealth') || lower.includes('finance')) return <TrendingUp className="text-green-400" />;
        if (lower.includes('wisdom') || lower.includes('mind')) return <Brain className="text-purple-400" />;
        if (lower.includes('work') || lower.includes('career')) return <Zap className="text-yellow-400" />;
        return <Shield className="text-blue-400" />;
    };

    const getSelectedPillarProjects = () => {
        if (!selectedPillar) return [];
        return projects.filter(p => p.pillar_id === selectedPillar.name || p.pillar_id === selectedPillar.id);
    };

    // --- Sub-Component: Project Mini-Dashboard ---
    const ProjectMiniDashboard = ({ project, onBack }: { project: Project, onBack: () => void }) => {
        const [logs, setLogs] = useState<any[]>([]);
        const [loadingLogs, setLoadingLogs] = useState(true);
        const [editingLog, setEditingLog] = useState<any | null>(null);
        const [isEditOpen, setIsEditOpen] = useState(false);

        // ... existing stats calculation ...
        const spent = projectSpentMap[project.id] || 0;
        const budget = project.total_hours_budget || 100;
        const remaining = Math.max(0, budget - spent);
        const progress = Math.min(100, (spent / budget) * 100);

        // ... existing handleDelete ...
        const handleDelete = async (logId: string) => {
            // ... existing code ...
            if (!confirm("Are you sure you want to delete this log? hours will be refunded.")) return;
            try {
                await deleteLog(logId);
                fetchData();
            } catch (e) { console.error(e); }
        };

        const handleEditClick = (log: any) => {
            setEditingLog({
                id: log.id,
                name: log.task_name || log.project_name || "Focus Session",
                duration: Number(log.hours)
            });
            setIsEditOpen(true);
        };

        const handleUpdateLog = async (id: string, newName: string, newDuration: number) => {
            const res = await fetch(`${API_BASE}/edit`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    logId: id,
                    newTaskName: newName,
                    newDuration: newDuration,
                    type: 'work_log'
                })
            });

            if (!res.ok) throw new Error("Failed to update log");

            // Refresh logs and global stats
            // We rely on the snapshot for logs, but we must manually re-fetch global stats to update sidebar/gauges immediately
            fetchData();
            // Note: The snapshot listener will automatically update the local 'logs' list if the backend write succeeds
        };

        // ... existing useEffect for snapshot ...
        useEffect(() => {
            const q = query(
                collection(db, "work_logs"),
                where("project_id", "==", project.id),
                orderBy("date", "desc"),
                limit(10)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const newLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setLogs(newLogs);
                setLoadingLogs(false);
            }, (error) => {
                console.error("Error fetching logs:", error);
                setLoadingLogs(false);
            });

            return () => unsubscribe();
        }, [project.id]);

        const formatDate = (dateStr: string) => {
            try {
                return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } catch (e) {
                return 'Invalid Date';
            }
        };

        return (
            <div className="flex flex-col h-full relative">
                {/* Nav & Header & Stats ... (Same as before, abbreviated here for clarity but keeping structure) */}
                <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors group w-fit">
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to {selectedPillar?.name}
                </button>

                {/* Header & Gauge Code ... */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight">{project.name}</h2>
                        <p className="text-slate-500 font-mono text-xs uppercase tracking-widest pl-1">Project Dashboard</p>
                    </div>
                    {/* Gauge ... */}
                    <div className="relative w-20 h-20">
                        {/* ... Scaled down gauge svg ... */}
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path className="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                            <path className={progress > 100 ? "text-red-500" : "text-blue-500"} strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-white">
                            {Math.round(progress)}%
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="text-xs text-slate-500 mb-1">Spent</div>
                        <div className="text-xl font-bold text-white">{spent.toFixed(1)}h</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="text-xs text-slate-500 mb-1">Remaining</div>
                        <div className="text-xl font-bold text-white">{remaining.toFixed(1)}h</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="text-xs text-slate-500 mb-1">Budget</div>
                        <div className="text-xl font-bold text-blue-400">{budget}h</div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Clock size={14} /> Recent Focus Logs
                    </h3>
                    <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                        {loadingLogs ? (
                            <div className="flex items-center gap-2 text-slate-500 text-sm p-4">
                                <span className="animate-spin">⏳</span> Loading history...
                            </div>
                        ) : logs.length > 0 ? (
                            logs.map((log: any) => (
                                <div key={log.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5 hover:border-blue-500/20 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-800 rounded-lg text-slate-400 font-mono text-xs">
                                            {formatDate(log.date)}
                                        </div>
                                        <div>
                                            <div className="text-sm text-white font-medium">
                                                {log.task_name || log.project_name || "Focus Session"}
                                            </div>
                                            {log.notes && <div className="text-xs text-slate-500 max-w-[200px] truncate">{log.notes}</div>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="font-mono text-blue-400 text-sm font-bold flex items-center gap-1">
                                            {Number(log.hours).toFixed(1)}h
                                        </div>
                                        <button
                                            onClick={() => handleEditClick(log)}
                                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                            title="Edit Log"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(log.id)}
                                            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            title="Delete Log"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center border border-dashed border-white/10 rounded-xl">
                                <p className="text-slate-500 text-sm mb-2">No focus sessions recorded yet.</p>
                                <p className="text-xs text-slate-600">Start a timer in Focus Mode or with the Extension!</p>
                            </div>
                        )}
                    </div>
                </div>

                <EditLogModal
                    isOpen={isEditOpen}
                    onClose={() => setIsEditOpen(false)}
                    onSave={handleUpdateLog}
                    log={editingLog}
                />
            </div>
        );
    };


    return (
        <div className="max-w-6xl mx-auto relative pb-20">
            <header className="mb-8">
                <div className="flex items-center gap-3 text-sm text-slate-400 mb-2 font-mono">
                    <span className="text-blue-500">Home</span>
                    <span>/</span>
                    <span>Strategy</span>
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <Target size={24} className="text-blue-400" />
                    </div>
                    Strategy & Goals
                </h1>
                <p className="text-slate-400 mt-2 ml-14 max-w-2xl">
                    Define your long-term pillars and the strategic objectives that support them.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [1, 2, 3].map((n) => (
                        <div key={n} className="h-48 rounded-3xl bg-surface animate-pulse border border-white/5" />
                    ))
                ) : pillars.length > 0 ? (
                    pillars.map((pillar, index) => {
                        const stats = pillarStats[pillar.id] || { progress: 0, spent: 0, budget: 0 };
                        return (
                            <motion.div
                                key={pillar.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => setSelectedPillar(pillar)}
                                className="bg-surface backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:border-blue-500/30 transition-all group relative overflow-hidden cursor-pointer shadow-glass hover:shadow-glow"
                            >
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                                    {getIcon(pillar.name)}
                                </div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 rounded-2xl bg-slate-900/50 border border-white/5 shadow-inner group-hover:bg-blue-500/10 transition-colors">
                                        {getIcon(pillar.name)}
                                    </div>
                                    <h3 className="text-lg font-bold text-white">{pillar.name}</h3>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                                            <span>Progress</span>
                                            <span className="font-mono text-blue-400">{Math.round(stats.progress)}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${stats.progress}%` }}
                                                transition={{ duration: 1, delay: 0.2 }}
                                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                                            <span>{stats.spent.toFixed(1)}h spent</span>
                                            <span>{stats.budget}h budget</span>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors">
                                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                                            {pillar.description || "No description set for this pillar."}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })
                ) : (
                    <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-white/10 rounded-3xl">
                        No pillars found. Add them in the database.
                    </div>
                )}
            </div>

            {/* NESTED MODAL SYSTEM */}
            <AnimatePresence>
                {selectedPillar && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => { setSelectedPillar(null); setSelectedProject(null); }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        />
                        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
                            <motion.div
                                layoutId={`card-${selectedPillar.id}`}
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="bg-[#020617] w-full max-w-2xl h-[600px] overflow-hidden rounded-3xl border border-blue-500/20 shadow-2xl pointer-events-auto flex flex-col relative"
                            >
                                <AnimatePresence mode="wait">
                                    {selectedProject ? (
                                        // VIEW 2: PROJECT MINI-DASHBOARD
                                        <motion.div
                                            key="project-detail"
                                            initial={{ x: 50, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            exit={{ x: 50, opacity: 0 }}
                                            className="h-full p-8"
                                        >
                                            <ProjectMiniDashboard
                                                project={selectedProject}
                                                onBack={() => setSelectedProject(null)}
                                            />
                                        </motion.div>
                                    ) : (
                                        // VIEW 1: PILLAR DETAILS LIST
                                        <motion.div
                                            key="pillar-list"
                                            initial={{ x: -50, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            exit={{ x: -50, opacity: 0 }}
                                            className="h-full flex flex-col"
                                        >
                                            {/* Header */}
                                            <div className="p-6 border-b border-white/10 flex items-start justify-between bg-gradient-to-r from-blue-900/20 to-transparent">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10">
                                                        {getIcon(selectedPillar.name)}
                                                    </div>
                                                    <div>
                                                        <h2 className="text-2xl font-bold text-white">{selectedPillar.name}</h2>
                                                        <p className="text-sm text-blue-400 font-mono">Pillar Details</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedPillar(null)}
                                                    className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>

                                            {/* Body */}
                                            <div className="p-6 overflow-y-auto flex-1">
                                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Active Projects</h3>
                                                <div className="space-y-3">
                                                    {getSelectedPillarProjects().length > 0 ? (
                                                        getSelectedPillarProjects().map(project => {
                                                            const spent = projectSpentMap[project.id] || 0;
                                                            const progress = (spent / (project.total_hours_budget || 1)) * 100;

                                                            return (
                                                                <div
                                                                    key={project.id}
                                                                    onClick={() => setSelectedProject(project)}
                                                                    className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between hover:border-blue-500/30 hover:bg-white/10 transition-all cursor-pointer group"
                                                                >
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <h4 className="text-white font-medium group-hover:text-blue-400 transition-colors">{project.name}</h4>
                                                                            {project.status === 'Completed' && <CheckCircle2 size={12} className="text-green-500" />}
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden">
                                                                                <div
                                                                                    className="h-full bg-blue-500 rounded-full"
                                                                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                                                                />
                                                                            </div>
                                                                            <span className="text-xs text-slate-500 font-mono">
                                                                                {spent.toFixed(1)} / {project.total_hours_budget}h
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <ChevronRight size={16} className="text-slate-600 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2 border border-dashed border-white/10 rounded-xl">
                                                            <AlertCircle size={24} />
                                                            <p className="text-sm italic">No projects linked to this pillar yet.</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-8 p-4 rounded-xl bg-blue-900/10 border border-blue-500/10">
                                                    <h4 className="text-blue-300 font-medium mb-2 text-sm flex items-center gap-2">
                                                        <Brain size={14} /> Strategic Vision
                                                    </h4>
                                                    <p className="text-slate-300 text-sm leading-relaxed">
                                                        {selectedPillar.description || "Define the long-term vision for this pillar in the database to see it here."}
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
            {/* Manual Entry Modal */}
            <ManualEntryModal
                isOpen={isManualEntryOpen}
                onClose={() => setIsManualEntryOpen(false)}
                onSave={async (data) => {
                    await createLog(data);
                    fetchData(); // Refresh stats
                }}
                initialProject={selectedProject || undefined}
                allProjects={projects}
            />
        </div>
    );
}
