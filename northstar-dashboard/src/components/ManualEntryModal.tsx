import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Save, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ManualEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialProject?: { id: string, name: string };
    allProjects: { id: string, name: string }[];
}

export function ManualEntryModal({ isOpen, onClose, onSave, initialProject, allProjects }: ManualEntryModalProps) {
    const [projectId, setProjectId] = useState(initialProject?.id || '');
    const [taskName, setTaskName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [durationStr, setDurationStr] = useState(''); // User input for hours
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setProjectId(initialProject?.id || '');
            setTaskName('');
            setDurationStr('');
            setDate(new Date().toISOString().split('T')[0]);
        }
    }, [isOpen, initialProject]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectId || !durationStr) return;

        setLoading(true);
        try {
            await onSave({
                project_id: projectId,
                project_name: allProjects.find(p => p.id === projectId)?.name || 'Unknown',
                hours: parseFloat(durationStr),
                task_name: taskName, // Pass this through even if API doesn't strictly validate it yet, good for future
                date: new Date(date).toISOString(),
                source: 'manual_entry'
            });
            onClose();
        } catch (error) {
            console.error("Failed to save log:", error);
            // Optionally add toast error here
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-[61] pointer-events-none p-4"
                    >
                        <div className="bg-[#020617] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl pointer-events-auto flex flex-col relative overflow-hidden">
                            {/* Header */}
                            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                                <h3 className="text-white font-bold flex items-center gap-2">
                                    <Clock size={16} className="text-blue-400" />
                                    Add Manual Log
                                </h3>
                                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Project</label>
                                    <select
                                        value={projectId}
                                        onChange={(e) => setProjectId(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                                        required
                                    >
                                        <option value="" disabled>Select a project...</option>
                                        {allProjects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Task Description</label>
                                    <input
                                        type="text"
                                        value={taskName}
                                        onChange={(e) => setTaskName(e.target.value)}
                                        placeholder="What did you work on?"
                                        className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Date</label>
                                        <div className="relative">
                                            <Calendar size={14} className="absolute left-3 top-3 text-slate-500" />
                                            <input
                                                type="date"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                                className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 pl-9 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Hours</label>
                                        <div className="relative">
                                            <Clock size={14} className="absolute left-3 top-3 text-slate-500" />
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0.1"
                                                value={durationStr}
                                                onChange={(e) => setDurationStr(e.target.value)}
                                                placeholder="e.g. 1.5"
                                                className="w-full bg-slate-900 border border-white/10 rounded-lg p-2.5 pl-9 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !projectId || !durationStr}
                                    className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                                    Save Entry
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
