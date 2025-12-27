import { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { ProjectCard } from '../components/ProjectCard';
import { motion } from 'framer-motion';
import { DollarSign, Heart, BookOpen } from 'lucide-react';

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
                logsSnapshot.forEach(doc => {
                    const data = doc.data();
                    const pid = data.project_id;
                    const hours = data.hours || 0;
                    if (pid) newStats[pid] = (newStats[pid] || 0) + hours;
                });
                setStats(newStats);

                // 3. Calculate North Star Alignment (Simple Keyword Matching)
                let revCount = 0;
                let healthCount = 0;
                let engCount = 0;

                projList.forEach(p => {
                    const text = (p.name + " " + (p.pillar_id || "")).toLowerCase();
                    if (text.match(/money|client|offer|business|revenue|growth|10k/)) revCount++;
                    if (text.match(/gym|health|run|workout|sleep|food/)) healthCount++;
                    if (text.match(/book|read|study|english|language|write/)) engCount++;
                });

                // (Optional: Could also fetch Habits here to add to counts, keeping it simple for now)

                setStarMetrics({ revenue: revCount, health: healthCount, english: engCount });

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

    return (
        <div className="space-y-12">

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
                                <span className="text-3xl font-bold text-white">{starMetrics.revenue}</span>
                                <span className="text-sm text-slate-400">Active Engines</span>
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
                                <span className="text-3xl font-bold text-white">{starMetrics.health}</span>
                                <span className="text-sm text-slate-400">Active Habits</span>
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
                                <span className="text-3xl font-bold text-white">{starMetrics.english}</span>
                                <span className="text-sm text-slate-400">Study Sessions</span>
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
        </div>
    );
}
