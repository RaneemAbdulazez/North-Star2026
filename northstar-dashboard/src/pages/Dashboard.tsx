import { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { ProjectCard } from '../components/ProjectCard';
import { motion } from 'framer-motion';
import { DollarSign, Heart, BookOpen, Activity, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { DailyProgressCard } from '../components/DailyProgressCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

interface Project {
    id: string;
    name: string;
    pillar_id?: string;
    total_hours_budget: number;
    visibility?: boolean;
}

interface ProjectStats {
    [projectId: string]: number;
}

const COLORS = ['#3B82F6', '#F59E0B', '#06B6D4', '#EF4444'];

export default function Dashboard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [stats, setStats] = useState<ProjectStats>({});
    const [loading, setLoading] = useState(true);

    // North Star Metrics (Calculated on the fly)
    const [starMetrics, setStarMetrics] = useState({
        revenue: 0, // Count of projects/habits related to business/money
        health: 0,  // Related to gym/health
        english: 0  // Related to reading/english
    });

    // Charts Data
    const [pillarDist, setPillarDist] = useState<any[]>([]);
    const [weeklyMomentum, setWeeklyMomentum] = useState<any[]>([]);
    const [burnDownData, setBurnDownData] = useState<any[]>([]);
    const [totalSpent, setTotalSpent] = useState(0);
    const [burnRate, setBurnRate] = useState(0);
    const [habitConsistency, setHabitConsistency] = useState(0);
    const [revenueAlignment, setRevenueAlignment] = useState(0);

    const QUARTER_BUDGET = 425;

    useEffect(() => {
        async function fetchData() {
            try {
                // 1. Fetch Projects
                const projSnapshot = await getDocs(collection(db, "projects"));
                const projList = projSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Project))
                    .filter(p => p.visibility !== false);

                setProjects(projList);

                // 2. Fetch Logs for Hours
                const logsSnapshot = await getDocs(collection(db, "work_logs"));
                const newStats: ProjectStats = {};
                let spent = 0;
                const logs: any[] = [];

                logsSnapshot.forEach(doc => {
                    const data = doc.data();
                    logs.push(data);
                    const pid = data.project_id;
                    const hours = data.hours || 0;
                    spent += hours;
                    if (pid) newStats[pid] = (newStats[pid] || 0) + hours;
                });
                setStats(newStats);
                setTotalSpent(spent);
                setBurnRate(Number((spent / 30).toFixed(1))); // Mock 30 days

                // 3. Calculate North Star Alignment (Simple Keyword Matching)
                let revCount = 0;
                let healthCount = 0;
                let engCount = 0;
                let revHours = 0;
                let engHours = 0;

                projList.forEach(p => {
                    const text = (p.name + " " + (p.pillar_id || "")).toLowerCase();
                    if (text.match(/money|client|offer|business|revenue|growth|10k/)) revCount++;
                    if (text.match(/gym|health|run|workout|sleep|food/)) healthCount++;
                    if (text.match(/book|read|study|english|language|write/)) engCount++;
                });

                logs.forEach(log => {
                    const proj = projList.find(p => p.id === log.project_id);
                    const text = (proj?.name || "").toLowerCase();
                    if (text.match(/money|client|business|10k/)) revHours += Number(log.hours);
                    if (text.match(/english|read|book/)) engHours += Number(log.hours);
                });

                setStarMetrics({
                    revenue: Math.min(100, (revHours / 100) * 100),
                    health: 0, // Mock for now
                    english: Math.min(100, (engHours / 50) * 100)
                });
                setRevenueAlignment(Math.round((revHours / (spent || 1)) * 100));

                // --- Pillar Dist ---
                const pillarMap: Record<string, number> = {};
                logs.forEach(log => {
                    const proj = projList.find(p => p.id === log.project_id);
                    const pillar = proj?.pillar_id || "Uncategorized";
                    pillarMap[pillar] = (pillarMap[pillar] || 0) + Number(log.hours);
                });
                setPillarDist(Object.keys(pillarMap).map(k => ({ name: k, value: pillarMap[k] })));

                // --- Momentum --- (Simplified)
                setWeeklyMomentum([
                    { day: 'Mon', hours: 4 }, { day: 'Tue', hours: 5 }, { day: 'Wed', hours: 2 },
                    { day: 'Thu', hours: 6 }, { day: 'Fri', hours: 4 }, { day: 'Sat', hours: 3 }, { day: 'Sun', hours: 1 }
                ]); // Utilizing mock data here to match previous Analytics logic if raw data isn't ready

                // --- Burn Down ---
                const burnData = [];
                let runningSpent = 0;
                for (let w = 1; w <= 12; w++) {
                    const ideal = QUARTER_BUDGET - ((QUARTER_BUDGET / 12) * w);
                    runningSpent += (spent / 12); // Average spread
                    burnData.push({
                        week: `W${w}`,
                        Ideal: ideal,
                        Actual: Math.max(0, QUARTER_BUDGET - runningSpent)
                    });
                }
                setBurnDownData(burnData);


            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const remaining = QUARTER_BUDGET - totalSpent;
    const isBudgetRisk = remaining < (QUARTER_BUDGET * 0.3);

    return (
        <div className="space-y-12">

            {/* DAILY PROGRESS CARD (New Top Section) */}
            <DailyProgressCard />

            {/* NORTH STAR STRATEGY ORBIT */}
            <section className="relative">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">

                    {/* STAR 1: $10K Revenue */}
                    <div className="flex-1 w-full bg-[#0F172A]/50 border border-amber-500/20 rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                            <DollarSign size={64} className="text-amber-400" />
                        </div>
                        <div className="relative z-10 flex flex-col gap-2">
                            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                <DollarSign size={24} className="text-amber-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">$10K Revenue</h3>
                            <p className="text-xs font-mono text-amber-200/60 uppercase tracking-widest">Financial Freedom</p>

                            <div className="mt-4 flex items-center gap-2">
                                <span className="text-3xl font-bold text-white">{Math.round(starMetrics.revenue)}%</span>
                                <span className="text-sm text-slate-400">to Goal</span>
                            </div>

                            {/* Pulse Orb */}
                            <motion.div
                                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -bottom-8 -left-8 w-32 h-32 bg-amber-500/20 rounded-full blur-[40px]"
                            />
                        </div>
                    </div>

                    {/* STAR 2: Health */}
                    <div className="flex-1 w-full bg-[#0F172A]/50 border border-red-500/20 rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                            <Heart size={64} className="text-red-400" />
                        </div>
                        <div className="relative z-10 flex flex-col gap-2">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                <Heart size={24} className="text-red-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">Iron Health</h3>
                            <p className="text-xs font-mono text-red-200/60 uppercase tracking-widest">Gym & Bio-hacking</p>

                            <div className="mt-4 flex items-center gap-2">
                                <span className="text-3xl font-bold text-white">{starMetrics.health}%</span>
                                <span className="text-sm text-slate-400">Consistency</span>
                            </div>

                            {/* Pulse Orb */}
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -bottom-8 -left-8 w-32 h-32 bg-red-500/20 rounded-full blur-[40px]"
                            />
                        </div>
                    </div>

                    {/* STAR 3: English */}
                    <div className="flex-1 w-full bg-[#0F172A]/50 border border-cyan-500/20 rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                            <BookOpen size={64} className="text-cyan-400" />
                        </div>
                        <div className="relative z-10 flex flex-col gap-2">
                            <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                                <BookOpen size={24} className="text-cyan-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">Fluent English</h3>
                            <p className="text-xs font-mono text-cyan-200/60 uppercase tracking-widest">Global Communication</p>

                            <div className="mt-4 flex items-center gap-2">
                                <span className="text-3xl font-bold text-white">{Math.round(starMetrics.english)}%</span>
                                <span className="text-sm text-slate-400">Input Hours</span>
                            </div>

                            {/* Pulse Orb */}
                            <motion.div
                                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -bottom-8 -left-8 w-32 h-32 bg-cyan-500/20 rounded-full blur-[40px]"
                            />
                        </div>
                    </div>

                </div>
            </section>


            {/* EXISTING PROJECTS GRID */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        Active Engines
                    </h2>
                    <div className="flex items-center gap-2 text-gray-400 text-sm font-mono">
                        <span>Q1 2026</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {projects.map((project, index) => (
                        <ProjectCard
                            key={project.id}
                            index={index}
                            name={project.name || "Unnamed Project"}
                            pillar={project.pillar_id || "General"}
                            spent={stats[project.id] || 0}
                            budget={project.total_hours_budget || 100}
                        />
                    ))}

                    {projects.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/5">
                            <p className="text-gray-500 font-medium">No active projects found.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* BURNDOWN AREA (Re-added) */}
            <div className="bg-surface/50 border border-white/5 p-6 rounded-3xl">
                <h3 className="text-lg font-bold text-white mb-6">Quarterly Burn-Down</h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={burnDownData}>
                            <defs>
                                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                            <XAxis dataKey="week" stroke="#64748b" tick={{ fontSize: 12 }} />
                            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                            <Area type="monotone" dataKey="Actual" stroke="#3b82f6" fillOpacity={1} fill="url(#colorActual)" strokeWidth={3} />
                            <Area type="monotone" dataKey="Ideal" stroke="#64748b" strokeDasharray="5 5" fill="none" strokeWidth={2} opacity={0.5} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* METRICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={<Activity className="text-blue-400" />} label="Hours Consumed" value={`${totalSpent.toFixed(1)}h`} sub={`of ${QUARTER_BUDGET}h Budget`} />
                <MetricCard icon={<Zap className="text-amber-400" />} label="Focus Efficiency" value={`${burnRate}h`} sub="Daily Avg. Burn" />
                <MetricCard icon={<TrendingUp className="text-green-400" />} label="Habit Consistency" value={`${habitConsistency}d`} sub="Avg. Streak" />
                <MetricCard icon={<DollarSign className="text-cyan-400" />} label="Revenue Focus" value={`${revenueAlignment}%`} sub="Time on $10k Goal" />
            </div>

        </div>
    );
}

function MetricCard({ icon, label, value, sub }: any) {
    return (
        <div className="bg-surface/50 border border-white/5 p-6 rounded-2xl flex flex-col gap-1 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-800 rounded-lg">{icon}</div>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-slate-500">{sub}</div>
        </div>
    );
}
