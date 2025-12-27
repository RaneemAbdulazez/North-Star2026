import { motion } from "framer-motion";

interface DonutChartProps {
    value: number;
    max: number;
    size?: number;
    strokeWidth?: number;
}

export function DonutChart({ value, max, size = 60, strokeWidth = 6 }: DonutChartProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(value / max, 1);
    const strokeDashoffset = circumference - progress * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="transform -rotate-90"
            >
                <defs>
                    <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22d3ee" /> {/* Cyan */}
                        <stop offset="100%" stopColor="#3b82f6" /> {/* Royal Blue */}
                    </linearGradient>
                </defs>

                {/* Background Circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#1e293b" // Slate-800
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Animated Circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="url(#blueGradient)"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                />
            </svg>
            {/* Percentage Text */}
            <div className="absolute text-[10px] font-bold text-gray-200">
                {Math.round((value / max) * 100)}%
            </div>
        </div>
    );
}
