import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Plus, Flame, CheckCircle2, XCircle, Trash2, Brain, Loader2, Calendar, Pencil, Timer, ArrowRight, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';
import { validateHabitWithGemini } from '../services/guardianService';

interface Habit {
    id: string;
    name: string;
    frequency: 'Daily' | 'Weekly';
    current_streak: number;
    best_streak: number;
    last_completed_date: string | null;
    expected_time_minutes: number;
    total_actual_minutes: number;
    status?: 'active' | 'archived';
}

export default function Habits() {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Edit Mode State
    const [editingId, setEditingId] = useState<string | null>(null);

    // Guardian State
    const [showGuardian, setShowGuardian] = useState(false);
    const [guardianState, setGuardianState] = useState<'IDLE' | 'EVALUATING' | 'RESULT_PASS' | 'RESULT_FAIL'>('IDLE');
    const [guardianFeedback, setGuardianFeedback] = useState("");

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        frequency: "Daily" as 'Daily' | 'Weekly',
        expected_time_minutes: 15
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const q = query(collection(db, "habits"), orderBy("created_at", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Habit));
            setHabits(items);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setFormData({ name: "", frequency: "Daily", expected_time_minutes: 15 });
        setEditingId(null);
        setShowForm(false);
        setShowGuardian(false);
        setGuardianState('IDLE');
    };

    const handleInitialSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        // SKIP Guardian if Editing
        if (editingId) {
            handleFinalCreate();
            return;
        }

        setShowGuardian(true);
        setGuardianState('EVALUATING');

        const result = await validateHabitWithGemini(formData.name, formData.frequency);

        setGuardianFeedback(result.reason);
        if (result.status === 'PASS') {
            setGuardianState('RESULT_PASS');
        } else {
            setGuardianState('RESULT_FAIL');
        }
    };

    const handleFinalCreate = async () => {
        setSubmitting(true);
        try {
            if (editingId) {
                // UPDATE
                const habitRef = doc(db, "habits", editingId);
                await updateDoc(habitRef, {
                    name: formData.name,
                    frequency: formData.frequency,
                    expected_time_minutes: formData.expected_time_minutes
                });
            } else {
                // CREATE
                await addDoc(collection(db, "habits"), {
                    ...formData,
                    current_streak: 0,
                    best_streak: 0,
                    last_completed_date: null,
                    total_actual_minutes: 0,
                    status: 'active',
                    created_at: serverTimestamp()
                });
            }
            resetForm();
        } catch (error) {
            console.error("Error creating habit:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (habit: Habit) => {
        setFormData({
            name: habit.name,
            frequency: habit.frequency,
            expected_time_minutes: habit.expected_time_minutes || 15
        });
        setEditingId(habit.id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deleteHabit = async (id: string) => {
        if (confirm("Are you sure you want to stop tracking this habit? (This actions is permanent)")) {
            await deleteDoc(doc(db, "habits", id));
        }
    };

    const toggleHabit = async (habit: Habit) => {
        const today = new Date().toISOString().split('T')[0];
        const isCompletedToday = habit.last_completed_date === today;
        const habitRef = doc(db, "habits", habit.id);

        if (isCompletedToday) {
            // Undo (Naive streak implementation)
            await updateDoc(habitRef, {
                last_completed_date: null,
                current_streak: Math.max(0, habit.current_streak - 1),
                // Subtract minutes? For now, we don't subtract actual minutes on undo to avoid complexity without logs
            });
        } else {
            // Complete
            let newStreak = habit.current_streak;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (habit.last_completed_date === yesterdayStr) {
                newStreak += 1;
            } else if (habit.last_completed_date === today) {
                // Already done
            } else {
                newStreak = 1;
            }

            // Assume completion takes the "expected time" for now (Simple MVP logic)
            // In future, Timer will provide precise 'actual' minutes
            const minutesToAdd = habit.expected_time_minutes || 15;

            await updateDoc(habitRef, {
                last_completed_date: today,
                current_streak: newStreak,
                best_streak: Math.max(habit.best_streak, newStreak),
                total_actual_minutes: (habit.total_actual_minutes || 0) + minutesToAdd
            });

            // Log entry
            await addDoc(collection(db, "habit_logs"), {
                habit_id: habit.id,
                date: today,
                minutes: minutesToAdd,
                timestamp: serverTimestamp()
            });
        }
    };

    const isCompletedToday = (habit: Habit) => {
        const today = new Date().toISOString().split('T')[0];
        return habit.last_completed_date === today;
    };

    return (
        <div className="max-w-4xl mx-auto relative pb-20">
            <header className="mb-8 flex items-end justify-between">
                <div>
                    <div className="flex items-center gap-3 text-sm text-slate-400 mb-2 font-mono">
                        <span className="text-indigo-500">Home</span>
                        <span>/</span>
                        <span>Habits</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                            <Activity size={24} className="text-indigo-400" />
                        </div>
                        Habit Tracker
                    </h1>
                </div>
                <button
                    onClick={() => {
                        if (showForm) resetForm();
                        else setShowForm(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-glow hover:shadow-indigo-500/25"
                >
                    {showForm ? <ArrowRight size={18} /> : <Plus size={18} />}
                    <span>{showForm ? "Cancel" : "Add Habit"}</span>
                </button>
            </header>

            {/* ADD/EDIT FORM */}
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="overflow-hidden"
                    >
                        <form onSubmit={handleInitialSubmit} className={`bg-surface backdrop-blur-xl border ${editingId ? 'border-amber-500/30' : 'border-indigo-500/30'} rounded-3xl p-6 shadow-glass relative`}>

                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                {editingId ? <Pencil size={16} className="text-amber-400" /> : <Plus size={16} className="text-indigo-400" />}
                                {editingId ? 'Edit Habit' : 'New Habit'}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Habit Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Read 10 Pages"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Frequency</label>
                                    <select
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 appearance-none"
                                        value={formData.frequency}
                                        onChange={e => setFormData({ ...formData, frequency: e.target.value as any })}
                                    >
                                        <option value="Daily">Daily</option>
                                        <option value="Weekly">Weekly</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Expected Time (Min)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50"
                                        value={formData.expected_time_minutes}
                                        onChange={e => setFormData({ ...formData, expected_time_minutes: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button type="submit" disabled={submitting} className={`bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 ${submitting ? 'opacity-50' : ''}`}>
                                    {submitting ? <Loader2 className="animate-spin" size={18} /> : editingId ? <Check size={18} /> : <Brain size={18} />}
                                    {editingId ? 'Save Changes' : 'Guardian Check'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* GUARDIAN MODAL */}
            <AnimatePresence>
                {showGuardian && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={resetForm}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className={`relative bg-slate-900 border w-full max-w-md p-6 rounded-2xl shadow-2xl z-10 flex flex-col items-center text-center
                                ${guardianState === 'RESULT_FAIL' ? 'border-red-500/50 shadow-red-900/20' : 'border-indigo-500/50 shadow-indigo-900/20'}
                             `}
                        >
                            {/* Guardian Content Same as Before... */}
                            {guardianState === 'EVALUATING' && (
                                <>
                                    <Brain className="w-12 h-12 text-indigo-400 animate-pulse mb-4" />
                                    <h3 className="text-xl font-bold text-white">Analyzing Habit...</h3>
                                    <p className="text-slate-400 mt-2 text-sm">Checking against productivity protocols.</p>
                                </>
                            )}
                            {guardianState === 'RESULT_FAIL' && (
                                <>
                                    <XCircle className="w-16 h-16 text-red-500 mb-4" />
                                    <h3 className="text-xl font-bold text-white">Habit Rejected</h3>
                                    <p className="text-red-200 mt-2 text-sm bg-red-500/10 p-3 rounded-lg w-full">{guardianFeedback}</p>
                                    <button onClick={resetForm} className="mt-6 bg-slate-800 hover:bg-slate-700 text-white py-2 px-6 rounded-lg transition-colors w-full">Close</button>
                                </>
                            )}
                            {guardianState === 'RESULT_PASS' && (
                                <>
                                    <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                                    <h3 className="text-xl font-bold text-white">Habit Approved</h3>
                                    <p className="text-green-200 mt-2 text-sm bg-green-500/10 p-3 rounded-lg w-full">{guardianFeedback}</p>
                                    <button onClick={handleFinalCreate} className="mt-6 bg-green-600 hover:bg-green-500 text-white py-2 px-6 rounded-lg transition-colors w-full font-bold">Start Tracking</button>
                                </>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* HABIT LIST */}
            <div className="grid grid-cols-1 gap-3">
                {loading ? (
                    <div className="p-8 text-center text-slate-500"><Loader2 className="animate-spin inline mr-2" /> Loading Habits...</div>
                ) : habits.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 border border-dashed border-white/10 rounded-3xl">
                        No habits tracked yet. Add one to start your streak.
                    </div>
                ) : (
                    habits.map(habit => (
                        <motion.div
                            key={habit.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`group p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between transition-all relative overflow-hidden gap-4
                                ${isCompletedToday(habit)
                                    ? 'bg-green-500/5 border-green-500/20'
                                    : 'bg-surface border-white/5 hover:border-white/10'}
                            `}
                        >
                            {isCompletedToday(habit) && (
                                <motion.div layoutId="completed-glow" className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
                            )}

                            <div className="flex items-center gap-4 z-10 w-full md:w-auto">
                                <button
                                    onClick={() => toggleHabit(habit)}
                                    className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
                                        ${isCompletedToday(habit)
                                            ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.5)]'
                                            : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}
                                    `}
                                >
                                    <CheckCircle2 size={24} className={isCompletedToday(habit) ? "scale-110" : ""} />
                                </button>

                                <div>
                                    <h3 className={`font-bold text-lg transition-colors ${isCompletedToday(habit) ? 'text-green-400' : 'text-white'}`}>
                                        {habit.name}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} /> {habit.frequency}
                                        </span>
                                        <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-indigo-300">
                                            <Timer size={12} /> {habit.expected_time_minutes || 15}m
                                        </span>
                                        {habit.best_streak > 0 && <span>Best: {habit.best_streak}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end gap-6 z-10 w-full md:w-auto pl-16 md:pl-0">
                                <div className="text-center">
                                    <div className={`flex items-center gap-1 font-bold text-xl ${habit.current_streak > 0 ? 'text-orange-400' : 'text-slate-600'}`}>
                                        <Flame size={20} className={`${habit.current_streak > 0 ? 'animate-pulse' : ''}`} fill={habit.current_streak > 0 ? "currentColor" : "none"} />
                                        {habit.current_streak}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Streak</div>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEdit(habit); }}
                                        className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteHabit(habit.id); }}
                                        className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
