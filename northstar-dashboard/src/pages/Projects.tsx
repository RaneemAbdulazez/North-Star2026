import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Plus, Trash2, Folder, ArrowRight, Loader2, Check, Brain, Pencil } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, updateDoc } from 'firebase/firestore';
import confetti from 'canvas-confetti';
import { validateProjectWithGemini } from '../services/guardianService';

interface Project {
    id: string;
    name: string;
    pillar_id: string;
    total_hours_budget: number;
    quarter: string;
    priority: "High" | "Medium" | "Low";
    status?: 'Active' | 'Completed' | 'Archived';
    completed_at?: any;
    spent_hours?: number;
}

interface Pillar {
    id: string;
    name: string;
}

export default function Projects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [pillars, setPillars] = useState<Pillar[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false); // Toggle explanation

    // Edit Mode State
    const [editingId, setEditingId] = useState<string | null>(null);

    // Guardian State
    const [showGuardian, setShowGuardian] = useState(false);
    const [guardianState, setGuardianState] = useState<'IDLE' | 'EVALUATING' | 'RESULT_PASS' | 'RESULT_FAIL'>('IDLE');
    const [guardianAnswers, setGuardianAnswers] = useState(["", "", ""]);
    const [guardianFeedback, setGuardianFeedback] = useState("");

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        pillar_id: '',
        total_hours_budget: 100,
        quarter: 'Q1 2026',
        priority: 'Medium' as "High" | "Medium" | "Low"
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchPillars = async () => {
            try {
                const snap = await getDocs(collection(db, "pillars"));
                setPillars(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pillar)));
                if (snap.docs.length > 0) {
                    setFormData(prev => ({ ...prev, pillar_id: snap.docs[0].data().name }));
                }
            } catch (e) {
                console.error("Error loading pillars", e);
            }
        };
        fetchPillars();

        const q = query(collection(db, "projects"), orderBy("created_at", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
            setProjects(projs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setFormData({
            name: '',
            pillar_id: pillars[0]?.name || '',
            total_hours_budget: 100,
            quarter: 'Q1 2026',
            priority: 'Medium'
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleInitialSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.pillar_id) return;

        // SKIP Guardian if Editing
        if (editingId) {
            handleFinalCreate();
            return;
        }

        // Open Guardian for New Projects
        setShowGuardian(true);
        setGuardianState('IDLE');
        setGuardianAnswers(["", "", ""]);
        setGuardianFeedback("");
    };

    const handleGuardianSubmit = async () => {
        setGuardianState('EVALUATING');
        const pillarNames = pillars.map(p => p.name);
        // Assuming AI service handles 3 args now
        const result = await validateProjectWithGemini(formData.name, guardianAnswers, pillarNames);

        setGuardianFeedback(result.reason);
        if (result.status === 'PASS') {
            setGuardianState('RESULT_PASS');
        } else {
            setGuardianState('RESULT_FAIL');
        }
    };

    const handleFinalCreate = async () => {
        setShowGuardian(false);
        setSubmitting(true);

        try {
            if (editingId) {
                // UPDATE Existing
                const projectRef = doc(db, "projects", editingId);
                await updateDoc(projectRef, {
                    ...formData,
                    // Don't overwrite status/created_at unless needed
                });
            } else {
                // CREATE New
                await addDoc(collection(db, "projects"), {
                    ...formData,
                    created_at: serverTimestamp(),
                    spent_hours: 0,
                    status: 'Active'
                });
            }
            resetForm();
        } catch (error) {
            console.error("Error saving project:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (project: Project) => {
        setFormData({
            name: project.name,
            pillar_id: project.pillar_id,
            total_hours_budget: project.total_hours_budget,
            quarter: project.quarter,
            priority: project.priority
        });
        setEditingId(project.id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this project?")) {
            await deleteDoc(doc(db, "projects", id));
        }
    };

    const handleMarkComplete = async (project: Project) => {
        if (confirm("Mark this project as COMPLETED? This will archive it from active views.")) {
            // CONFETTI!
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#3b82f6', '#f59e0b', '#10b981']
            });

            const projectRef = doc(db, "projects", project.id);
            await updateDoc(projectRef, {
                status: 'Completed',
                completed_at: serverTimestamp()
            });
            setShowForm(false); // If open
        }
    };

    // const getPriorityColor = (p: string) => { ... }

    const updateAnswer = (index: number, val: string) => {
        const newAns = [...guardianAnswers];
        newAns[index] = val;
        setGuardianAnswers(newAns);
    };

    // Filter Logic
    const activeProjects = projects.filter(p => !p.status || p.status === 'Active');
    const completedProjects = projects.filter(p => p.status === 'Completed');

    return (
        <div className="max-w-6xl mx-auto relative pb-20">
            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 text-sm text-slate-400 mb-2 font-mono">
                        <span className="text-blue-500">Home</span>
                        <span>/</span>
                        <span>Projects</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <Briefcase size={24} className="text-blue-400" />
                        </div>
                        Project Management
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className={`text-sm font-bold px-4 py-2 rounded-xl border transition-all ${showCompleted ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'text-slate-500 border-transparent hover:text-white'}`}
                    >
                        {showCompleted ? 'Hide Completed' : 'Show Completed'}
                    </button>
                    <button
                        onClick={() => {
                            if (showForm && editingId) {
                                // Cancel Edit
                                resetForm();
                            } else {
                                // Toggle Form
                                setShowForm(!showForm);
                                setEditingId(null);
                                setFormData(prev => ({ ...prev, name: '', total_hours_budget: 100 }));
                            }
                        }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-glow hover:shadow-blue-500/25"
                    >
                        {showForm ? <ArrowRight size={18} /> : <Plus size={18} />}
                        {showForm ? "Cancel" : "Add Project"}
                    </button>
                </div>
            </header>

            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="overflow-hidden mb-8"
                    >
                        <form onSubmit={handleInitialSubmit} className={`bg-surface backdrop-blur-xl border ${editingId ? 'border-amber-500/30' : 'border-blue-500/30'} rounded-3xl p-8 shadow-glass relative`}>
                            <div className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent ${editingId ? 'via-amber-500' : 'via-blue-500'} to-transparent opacity-50`} />

                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                {editingId ? <Pencil size={16} className="text-amber-400" /> : <Plus size={16} className="text-blue-400" />}
                                {editingId ? 'Edit Project' : 'New Project'}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Project Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Website Redesign"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-slate-600"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pillar</label>
                                    <select
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors appearance-none"
                                        value={formData.pillar_id}
                                        onChange={e => setFormData({ ...formData, pillar_id: e.target.value })}
                                    >
                                        {pillars.map(p => (
                                            <option key={p.id} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Budget (Hours)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                                        value={formData.total_hours_budget}
                                        onChange={e => setFormData({ ...formData, total_hours_budget: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Quarter</label>
                                    <select
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors appearance-none"
                                        value={formData.quarter}
                                        onChange={e => setFormData({ ...formData, quarter: e.target.value })}
                                    >
                                        <option value="Q1 2026">Q1 2026 (Jan-Mar)</option>
                                        <option value="Q2 2026">Q2 2026 (Apr-Jun)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Priority</label>
                                    <select
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors appearance-none"
                                        value={formData.priority}
                                        onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                                    >
                                        <option value="High">High Priority</option>
                                        <option value="Medium">Medium Priority</option>
                                        <option value="Low">Low Priority</option>
                                    </select>
                                </div>
                            </div>

                            {/* Action Footer */}
                            <div className="flex justify-between items-center">
                                {editingId ? (
                                    <button
                                        type="button"
                                        onClick={() => handleMarkComplete(projects.find(p => p.id === editingId)!)}
                                        className="text-green-400 hover:text-green-300 hover:bg-green-500/10 px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-bold text-sm"
                                    >
                                        <Check size={16} /> Mark as Completed
                                    </button>
                                ) : <div />} {/* Spacer */}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`
                                        ${editingId ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}
                                        text-white font-bold py-3 px-8 rounded-xl transition-all shadow-glow flex items-center gap-2
                                    `}
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={20} /> : editingId ? 'Save Changes' : 'Review & Create'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* GUARDIAN MODAL (Same as before) -- Only for New Projects */}
            <AnimatePresence>
                {showGuardian && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
                            onClick={() => setShowGuardian(false)}
                        />
                        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4 w-full">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                                className={`
                                    bg-[#020617] w-full max-w-lg border rounded-3xl p-8 shadow-2xl pointer-events-auto relative overflow-hidden transition-colors duration-500
                                    ${guardianState === 'RESULT_PASS' ? 'border-green-500/30' :
                                        guardianState === 'RESULT_FAIL' ? 'border-red-500/30' : 'border-indigo-500/30'}
                                `}
                            >
                                {/* Guardian Content (Simplified for brevity as it's duped logic) */}
                                <div className="text-center mb-6">
                                    <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-4 shadow-glow transition-all ${guardianState === 'EVALUATING' ? 'animate-pulse bg-indigo-500/20 border-indigo-500' : 'bg-slate-900 border-indigo-500/50'}`}>
                                        <Brain size={32} className="text-white" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">{guardianState === 'EVALUATING' ? 'analyzing...' : 'Guardian Access'}</h2>
                                    <p className="text-slate-400 text-sm">{guardianFeedback || "Justify your intent."}</p>
                                </div>

                                {guardianState === 'IDLE' && (
                                    <div className="space-y-3 mb-6">
                                        <textarea className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-indigo-500" placeholder="Why this project? (Alignment)" value={guardianAnswers[0]} onChange={e => updateAnswer(0, e.target.value)} />
                                        <textarea className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-indigo-500" placeholder="Capacity check?" value={guardianAnswers[1]} onChange={e => updateAnswer(1, e.target.value)} />
                                        <textarea className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-indigo-500" placeholder="Urgency?" value={guardianAnswers[2]} onChange={e => updateAnswer(2, e.target.value)} />
                                        <button onClick={handleGuardianSubmit} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl mt-2">Submit</button>
                                    </div>
                                )}

                                {guardianState === 'RESULT_PASS' && (
                                    <button onClick={handleFinalCreate} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl">Unlock & Create</button>
                                )}
                                {guardianState === 'RESULT_FAIL' && (
                                    <button onClick={() => setGuardianState('IDLE')} className="w-full bg-slate-700 text-white font-bold py-3 rounded-xl">Try Again</button>
                                )}
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            <div className="space-y-8">
                {/* ACTIVE PROJECTS */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 uppercase tracking-widest font-bold px-4">
                        <span>Active Projects ({activeProjects.length})</span>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin" size={24} /> Loading...
                        </div>
                    ) : activeProjects.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 border border-dashed border-white/10 rounded-3xl">
                            No active projects.
                        </div>
                    ) : (
                        activeProjects.map((project, i) => (
                            <ProjectItem key={project.id} project={project} index={i} onDelete={handleDelete} onEdit={handleEdit} />
                        ))
                    )}
                </div>

                {/* COMPLETED PROJECTS */}
                {showCompleted && completedProjects.length > 0 && (
                    <div className="space-y-4 pt-8 border-t border-white/5">
                        <div className="flex items-center justify-between text-xs text-green-500/50 uppercase tracking-widest font-bold px-4">
                            <span className="flex items-center gap-2"><Check size={12} /> Completed ({completedProjects.length})</span>
                        </div>
                        {completedProjects.map((project, i) => (
                            <ProjectItem key={project.id} project={project} index={i} onDelete={handleDelete} onEdit={handleEdit} isCompleted />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ProjectItem({ project, index, onDelete, onEdit, isCompleted }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: isCompleted ? 0.6 : 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`
                group rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all
                ${isCompleted ? 'bg-surface/30 border border-green-900/20 grayscale-[0.5]' : 'bg-surface hover:bg-white/5 border border-white/5 hover:border-blue-500/30'}
            `}
        >
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${isCompleted ? 'bg-green-900/20 text-green-500' : 'bg-slate-900 text-blue-400'}`}>
                    {isCompleted ? <Check size={20} /> : <Folder size={20} />}
                </div>
                <div>
                    <h3 className={`text-lg font-bold transition-colors ${isCompleted ? 'text-slate-400 line-through' : 'text-white group-hover:text-blue-400'}`}>
                        {project.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm">
                        <span className="text-slate-400">{project.pillar_id}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                        <span className="text-slate-500 font-mono text-xs">{project.total_hours_budget}h Budget</span>
                        {isCompleted && <span className="text-green-500 text-xs font-bold uppercase ml-2">Completed</span>}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto opacity-0 group-hover:opacity-100 transition-opacity">
                {!isCompleted && (
                    <button
                        onClick={() => onEdit(project)}
                        className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                        title="Edit Project"
                    >
                        <Pencil size={18} />
                    </button>
                )}
                <button
                    onClick={() => onDelete(project.id)}
                    className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete Project"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </motion.div>
    );
}
