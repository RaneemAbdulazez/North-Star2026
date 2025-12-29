import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, Save, Clock, Type } from 'lucide-react';
import { useState, useEffect } from 'react';

interface EditLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, newName: string, newDuration: number) => Promise<void>;
    log: {
        id: string;
        name: string;
        duration: number; // in hours
    } | null;
}

export const EditLogModal = ({ isOpen, onClose, onSave, log }: EditLogModalProps) => {
    const [name, setName] = useState('');
    const [duration, setDuration] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (log) {
            setName(log.name);
            setDuration(log.duration);
        }
    }, [log]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!log) return;

        setLoading(true);
        try {
            await onSave(log.id, name, duration);
            onClose();
        } catch (error) {
            console.error("Failed to update log:", error);
            alert("Failed to update log. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                    />
                    <div className="fixed inset-0 flex items-center justify-center z-[70] pointer-events-none p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[#020617] w-full max-w-md border border-white/10 rounded-3xl p-6 shadow-2xl pointer-events-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">Edit Log</h3>
                                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                                    <XCircle size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                        <Type size={14} /> Task Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                        <Clock size={14} /> Duration (Hours)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        required
                                        value={duration}
                                        onChange={e => setDuration(parseFloat(e.target.value))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 transition-colors font-bold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? <span className="animate-spin">⏳</span> : <Save size={18} />}
                                        Update
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};
