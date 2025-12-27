import { motion } from "framer-motion";
import { DonutChart } from "./DonutChart";

interface ProjectCardProps {
    name: string;
    pillar: string;
    spent: number;
    budget: number;
    index: number;
}

export function ProjectCard({ name, pillar, spent, budget, index }: ProjectCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{
                opacity: 1,
                y: 0,
                transition: { delay: index * 0.1, duration: 0.5 }
            }}
            whileHover={{
                y: -5,
                scale: 1.02,
                transition: { duration: 0.2 }
            }}
            className="group relative bg-surface border border-white/5 rounded-2xl p-5 backdrop-blur-xl shadow-glass hover:border-primary/30 hover:shadow-glow transition-all cursor-pointer overflow-hidden"
        >
            {/* Dynamic Background Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 blur transition-opacity duration-500" />

            <div className="relative z-10 flex items-center justify-between">
                <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-lg text-white group-hover:text-primary transition-colors tracking-tight">{name}</h3>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-cyan-200/70 font-medium px-2 py-0.5 bg-cyan-950/30 rounded-full border border-cyan-900/50">
                            {pillar}
                        </span>
                    </div>

                    <div className="mt-2 text-sm flex items-baseline gap-1">
                        {/* Count Up Animation Placeholder logic or simple display */}
                        <span className="font-mono text-cyan-400 font-bold">{spent.toFixed(1)}</span>
                        <span className="text-slate-500 text-xs font-medium">/ {budget}h</span>
                    </div>
                </div>

                <div className="flex-shrink-0 relative">
                    <DonutChart value={spent} max={budget} size={60} strokeWidth={6} />
                </div>
            </div>
        </motion.div>
    );
}
