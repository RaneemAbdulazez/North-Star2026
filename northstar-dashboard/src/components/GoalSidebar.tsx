import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ChevronRight, ChevronDown, Plus, Layout, Target, GripVertical } from 'lucide-react';
import type { Project, Goal, Task } from '../types';

interface GoalSidebarProps {
    projects: Project[];
    goals: Goal[];
    tasks: Task[];
    onAddGoal: (projectId: string) => void;
    onAddTask: (goalId: string, projectId: string) => void;
}

export default function GoalSidebar({ projects, goals, tasks, onAddGoal, onAddTask }: GoalSidebarProps) {
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
    const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

    const toggleProject = (id: string) => {
        const next = new Set(expandedProjects);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedProjects(next);
    };

    const toggleGoal = (id: string) => {
        const next = new Set(expandedGoals);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedGoals(next);
    };

    const GoalProgress = ({ goalId }: { goalId: string }) => {
        const goalTasks = tasks?.filter(t => t.goalId === goalId) || [];
        const total = goalTasks.length;
        const done = goalTasks.filter(t => t.status === 'done').length;
        const percent = total === 0 ? 0 : (done / total) * 100;

        return (
            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${percent}%` }}
                />
            </div>
        );
    };

    if (!projects) return <div className="text-slate-500 p-4">Loading Projects...</div>;

    return (
        <div className="w-80 flex-shrink-0 flex flex-col bg-surface border-r border-white/5 h-full overflow-y-auto custom-scrollbar">
            <div className="p-4 border-b border-white/5 bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md flex items-center justify-between">
                <div>
                    <h2 className="font-bold text-white flex items-center gap-2">
                        <Layout size={16} className="text-blue-400" />
                        Weekly Focus
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Projects & Goals</p>
                </div>
            </div>

            <div className="p-2 space-y-2">
                {projects.map(project => {
                    const projectGoals = goals?.filter(g => g.projectId === project.id) || [];
                    const isExpanded = expandedProjects.has(project.id);

                    return (
                        <div key={project.id} className="rounded-lg bg-slate-900/30 border border-white/5 overflow-hidden">
                            {/* Level 1: Project Header */}
                            <div
                                className="flex items-center justify-between p-3 hover:bg-white/5 cursor-pointer transition-colors"
                                onClick={() => toggleProject(project.id)}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" style={{ backgroundColor: project.color }} />
                                    <span className="font-bold text-sm text-slate-200">{project.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        className="p-1 hover:bg-white/10 rounded text-slate-400"
                                        onClick={(e) => { e.stopPropagation(); onAddGoal(project.id); }}
                                    >
                                        <Plus size={14} />
                                    </button>
                                    {isExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                                </div>
                            </div>

                            {/* Level 2: Goals */}
                            {isExpanded && (
                                <div className="pl-3 pr-2 pb-2 space-y-1 bg-black/20 border-t border-white/5">
                                    {projectGoals.map(goal => {
                                        const goalTasks = tasks?.filter(t => t.goalId === goal.id) || [];
                                        const isGoalExpanded = expandedGoals.has(goal.id);

                                        return (
                                            <div key={goal.id} className="mt-1">
                                                <div
                                                    className="flex items-start gap-2 p-2 rounded hover:bg-white/5 cursor-pointer group"
                                                    onClick={() => toggleGoal(goal.id)}
                                                >
                                                    <Target size={14} className="text-slate-500 mt-1 group-hover:text-slate-300" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium text-slate-300">{goal.title}</div>
                                                        <div className="flex items-center justify-between mt-1">
                                                            <span className="text-[10px] text-slate-500">{goal.estimated_hours}h est</span>
                                                            <GoalProgress goalId={goal.id} />
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-500/20 rounded text-blue-400 transition-opacity"
                                                        onClick={(e) => { e.stopPropagation(); onAddTask(goal.id, project.id); }}
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>

                                                {/* Level 3: Tasks */}
                                                {isGoalExpanded && (
                                                    <div className="pl-2 mt-1 space-y-1 border-l-2 border-white/5 ml-2">
                                                        {goalTasks.map(task => (
                                                            <DraggableSidebarTask key={task.id} task={task} projectColor={project.color} />
                                                        ))}
                                                        {goalTasks.length === 0 && (
                                                            <div className="text-[10px] text-slate-600 italic px-2 py-1">No tasks yet</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {projectGoals.length === 0 && (
                                        <div className="text-xs text-slate-600 italic p-2 text-center">No goals set</div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function DraggableSidebarTask({ task, projectColor }: { task: Task, projectColor: string }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `sidebar-${task.id}`,
        data: { type: 'task', task, projectColor, origin: 'sidebar' }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0 : 1,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={{ ...style, touchAction: 'none' }}
            {...listeners}
            {...attributes}
            className={`group flex items-center gap-2 p-2 rounded bg-surface border border-white/5 hover:border-white/20 cursor-grab active:cursor-grabbing ${task.status === 'done' ? 'opacity-50' : ''}`}
        >
            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: projectColor }} />
            <div className="min-w-0 flex-1">
                <div className={`text-xs text-slate-300 truncate leading-tight ${task.status === 'done' ? 'line-through text-slate-500' : ''}`}>{task.title}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{task.estimated_minutes}m</div>
            </div>
            <GripVertical size={12} className="text-slate-600 opacity-0 group-hover:opacity-100" />
        </div>
    );
}
