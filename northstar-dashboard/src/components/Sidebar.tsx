import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wand2, Briefcase, BarChart3, ChevronRight, Target, History, Settings, Activity, Zap, Calendar, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveSession } from '../hooks/useActiveSession';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
    return (
        <>
            {/* Mobile Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Container */}
            <motion.aside
                className={cn(
                    "border-r border-white/5 bg-[#020617]/95 backdrop-blur-2xl flex flex-col h-full z-50",
                    "fixed inset-y-0 left-0 w-72 md:relative md:translate-x-0 transition-transform duration-300 ease-in-out",
                    !isOpen && "-translate-x-full md:translate-x-0"
                )}
            >
                <div className="p-8 pb-4 relative">
                    {/* Close Button (Mobile Only) */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white md:hidden"
                    >
                        <ChevronRight size={20} className="rotate-180" />
                    </button>

                    <div className="flex items-center gap-3 mb-6">
                        <div className="relative">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-glow">
                                <span className="font-bold text-white">N</span>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#020617] rounded-full"></div>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-white leading-none">NorthStar</h1>
                            <p className="text-[10px] text-blue-400 font-medium mt-1 tracking-widest uppercase">Workspace</p>
                        </div>
                    </div>
                </div>

                <nav className="flex flex-col gap-1 px-4 flex-1 overflow-y-auto custom-scrollbar">
                    <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={onClose} />

                    {/* Focus Mode Link with Live Indicator */}
                    <ActiveSessionNavItem onClick={onClose} />

                    <NavItem to="/daily-path" icon={<Wand2 size={20} />} label="Daily Path" onClick={onClose} />
                    <NavItem to="/planner" icon={<Calendar size={20} />} label="Weekly Planner" onClick={onClose} />

                    <NavItem to="/journal" icon={<BookOpen size={20} />} label="Journal" onClick={onClose} />

                    <div className="my-4 px-2">
                        <div className="h-px bg-gradient-to-r from-transparent via-blue-900/50 to-transparent" />
                    </div>

                    <NavItem to="/projects" icon={<Briefcase size={20} />} label="Projects" onClick={onClose} />
                    <NavItem to="/habits" icon={<Activity size={20} />} label="Habits" onClick={onClose} />
                    <NavItem to="/strategy" icon={<Target size={20} />} label="Strategy" onClick={onClose} />
                    <NavItem to="/logs" icon={<History size={20} />} label="Time Logs" onClick={onClose} />
                    <NavItem to="/analytics" icon={<BarChart3 size={20} />} label="Analytics" onClick={onClose} />

                    <div className="mt-auto mb-4">
                        <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" onClick={onClose} />
                    </div>
                </nav>

                <div className="p-4 m-4 rounded-2xl bg-gradient-to-br from-blue-900/20 to-transparent border border-blue-500/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-blue-200 ring-2 ring-blue-500/20">
                            R
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">Raneem</div>
                            <div className="text-xs text-slate-400 truncate">Founder Mode</div>
                        </div>
                    </div>
                </div>
            </motion.aside>
        </>
    );
}

function NavItem({ to, icon, label, onClick }: { to: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
    return (
        <NavLink
            to={to}
            onClick={onClick}
            className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 group relative overflow-hidden",
                isActive
                    ? "text-white bg-blue-600/10 border border-blue-500/20"
                    : "text-slate-400 hover:text-blue-200 hover:bg-white/5"
            )}
        >
            {({ isActive }) => (
                <>
                    {isActive && (
                        <motion.div
                            layoutId="activeNav"
                            className="absolute inset-0 bg-blue-500/5"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        />
                    )}

                    <motion.span
                        whileHover={{ y: -2 }}
                        className={cn("relative z-10 transition-colors duration-300", isActive ? "text-blue-400" : "group-hover:text-blue-300")}
                    >
                        {icon}
                    </motion.span>
                    <span className="relative z-10 font-medium">{label}</span>

                    {isActive && (
                        <motion.div
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="ml-auto"
                        >
                            <ChevronRight size={14} className="text-blue-500" />
                        </motion.div>
                    )}
                </>
            )}
        </NavLink>
    );
}

function ActiveSessionNavItem({ onClick }: { onClick?: () => void }) {
    const { activeSession } = useActiveSession();

    return (
        <NavLink
            to="/focus"
            onClick={onClick}
            className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 group relative overflow-hidden",
                isActive
                    ? "text-white bg-blue-600/10 border border-blue-500/20"
                    : "text-slate-400 hover:text-blue-200 hover:bg-white/5"
            )}
        >
            {({ isActive }) => (
                <>
                    {isActive && (
                        <motion.div
                            layoutId="activeNav"
                            className="absolute inset-0 bg-blue-500/5"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        />
                    )}

                    <motion.span
                        whileHover={{ y: -2 }}
                        className={cn("relative z-10 transition-colors duration-300", isActive ? "text-blue-400" : "group-hover:text-blue-300")}
                    >
                        <Zap size={20} className={activeSession ? "fill-blue-500 text-blue-500 animate-pulse" : ""} />
                    </motion.span>

                    <span className="relative z-10 font-medium flex items-center gap-2">
                        Focus Mode
                        {activeSession && (
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                        )}
                    </span>

                    {isActive && (
                        <motion.div
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="ml-auto"
                        >
                            <ChevronRight size={14} className="text-blue-500" />
                        </motion.div>
                    )}
                </>
            )}
        </NavLink>
    );
}
