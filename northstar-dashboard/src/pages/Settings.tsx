import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Monitor, Database, Trash2, Download, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

interface UserSettings {
    darkMode: boolean;
    animations: boolean;
    dailyReminders: boolean;
    weeklyReport: boolean;
}

export default function Settings() {
    const [settings, setSettings] = useState<UserSettings>({
        darkMode: true,
        animations: true,
        dailyReminders: false,
        weeklyReport: true
    });
    // const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [installPrompt, setInstallPrompt] = useState<any>(null);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        installPrompt.userChoice.then((choiceResult: any) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            setInstallPrompt(null);
        });
    };

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const docRef = doc(db, "user_settings", "preferences");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(docSnap.data() as UserSettings);
                }
            } catch (e) {
                console.error("Failed to load settings", e);
            } finally {
                // setLoading(false);
            }
        };
        loadSettings();
    }, []);

    const toggleSetting = async (key: keyof UserSettings) => {
        const newVal = !settings[key];
        const newSettings = { ...settings, [key]: newVal };
        setSettings(newSettings); // Optimistic update

        try {
            await setDoc(doc(db, "user_settings", "preferences"), newSettings, { merge: true });

            // Feature Logic Triggers
            if (key === 'dailyReminders' && newVal === true) {
                if (Notification.permission !== "granted") {
                    Notification.requestPermission();
                }
                // In a real app, you'd register a service worker here
            }

        } catch (e) {
            console.error("Failed to save setting", e);
            setSettings(settings); // Revert
        }
    };

    const handleExportJSON = async () => {
        setExporting(true);
        try {
            const data: any = {};
            const collections = ["projects", "work_logs", "daily_plans", "habits", "pillars"];

            for (const colName of collections) {
                const snap = await getDocs(collection(db, colName));
                data[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `northstar_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Export failed", e);
            alert("Export failed. Check console.");
        } finally {
            setExporting(false);
        }
    };

    const handleExportCSV = async () => {
        setExporting(true);
        try {
            // 1. Fetch Data
            const logsSnap = await getDocs(collection(db, "work_logs"));
            const projectsSnap = await getDocs(collection(db, "projects"));

            const logs = logsSnap.docs.map(d => d.data());
            const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

            // 2. Aggregate
            // Headers: Project Name, Pillar, Total Hours, Status
            const csvRows = [];
            csvRows.push(["Project Name", "Pillar", "Total Hours Logged", "Budget", "Status", "Quarter"]);

            for (const p of projects) {
                const pLogs = logs.filter((l: any) => l.project_id === p.id);
                const totalHours = pLogs.reduce((acc: number, l: any) => acc + (Number(l.hours) || 0), 0);

                csvRows.push([
                    `"${p.name}"`,
                    `"${p.pillar_id || ''}"`,
                    totalHours.toFixed(2),
                    p.total_hours_budget || 0,
                    p.status || 'Active',
                    p.quarter || ''
                ]);
            }

            // 3. Download
            const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `northstar_analytics_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (e) {
            console.error("CSV Export failed", e);
            alert("Export failed.");
        } finally {
            setExporting(false);
        }
    };

    const handleClearCache = () => {
        if (confirm("Are you sure? This will reset local application state and reload the page. Data in database will remain safe.")) {
            setClearing(true);
            localStorage.clear();
            sessionStorage.clear();
            setTimeout(() => window.location.reload(), 1000);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <header className="mb-8">
                <div className="flex items-center gap-3 text-sm text-slate-400 mb-2 font-mono">
                    <span className="text-blue-500">Home</span>
                    <span>/</span>
                    <span>Settings</span>
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <div className="p-2 bg-slate-500/10 rounded-lg border border-slate-500/20">
                        <SettingsIcon size={24} className="text-slate-300" />
                    </div>
                    Control Panel
                </h1>
            </header>

            <div className="space-y-6">

                {/* System Config */}
                <Section title="System Configuration" icon={<Monitor size={18} />}>
                    <div className="space-y-4">
                        <ToggleItem
                            label="Dark Mode"
                            description="Use the Deep Blue theme (Default)"
                            active={settings.darkMode}
                            onClick={() => toggleSetting('darkMode')}
                        />
                        <ToggleItem
                            label="Animations"
                            description="Enable complex framer motion effects"
                            active={settings.animations}
                            onClick={() => toggleSetting('animations')}
                        />
                    </div>
                </Section>

                {/* App Installation */}
                <Section title="Install App" icon={<Monitor size={18} />}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-white font-medium text-sm">Install NorthStar</h4>
                            <p className="text-xs text-slate-500">Add to your home screen for the best experience.</p>
                        </div>
                        <button
                            onClick={handleInstall}
                            disabled={!installPrompt}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download size={14} /> {installPrompt ? "Install App" : "Installed"}
                        </button>
                    </div>
                </Section>

                {/* Notifications */}
                <Section title="Notifications" icon={<Bell size={18} />}>
                    <div className="space-y-4">
                        <ToggleItem
                            label="Daily Reminders"
                            description="Remind me to plan my day at 9:00 PM"
                            active={settings.dailyReminders}
                            onClick={() => toggleSetting('dailyReminders')}
                        />
                        <ToggleItem
                            label="Weekly Report"
                            description="Email me a summary every Sunday"
                            active={settings.weeklyReport}
                            onClick={() => toggleSetting('weeklyReport')}
                        />
                    </div>
                </Section>

                {/* Data Management */}
                <Section title="Data Management" icon={<Database size={18} />}>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-xl border border-white/5 transition-colors hover:bg-slate-900/50">
                            <div>
                                <h4 className="text-white font-medium text-sm flex items-center gap-2"><Download size={14} className="text-blue-400" /> Export Data (JSON)</h4>
                                <p className="text-xs text-slate-500">Download full backup of logs, projects, and plans.</p>
                            </div>
                            <button
                                onClick={handleExportJSON}
                                disabled={exporting}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} JSON
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-xl border border-white/5 transition-colors hover:bg-slate-900/50">
                            <div>
                                <h4 className="text-white font-medium text-sm flex items-center gap-2"><FileText size={14} className="text-green-400" /> Export Analytics (CSV)</h4>
                                <p className="text-xs text-slate-500">Summary of hours, budget status, and pillars.</p>
                            </div>
                            <button
                                onClick={handleExportCSV}
                                disabled={exporting}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} CSV
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-red-900/10 rounded-xl border border-red-500/10 mt-4 group hover:border-red-500/30 transition-all">
                            <div>
                                <h4 className="text-red-400 font-medium text-sm flex items-center gap-2"><AlertTriangle size={14} /> Clear Cache</h4>
                                <p className="text-xs text-red-500/70">Reset local application state (Safe). Data remains in DB.</p>
                            </div>
                            <button
                                onClick={handleClearCache}
                                disabled={clearing}
                                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Clear
                            </button>
                        </div>
                    </div>
                </Section>
            </div>
        </div>
    );
}

function Section({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-surface backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-glass relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-10 bg-blue-500/5 blur-[60px] rounded-full pointer-events-none" />
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5 relative z-10">
                <span className="text-slate-400">{icon}</span>
                <h3 className="text-lg font-bold text-white">{title}</h3>
            </div>
            <div className="relative z-10">
                {children}
            </div>
        </motion.div>
    );
}

function ToggleItem({ label, description, active, onClick }: { label: string, description: string, active: boolean, onClick: () => void }) {
    return (
        <div className="flex items-center justify-between group cursor-pointer" onClick={onClick}>
            <div>
                <h4 className={`text-sm font-medium transition-colors ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{label}</h4>
                <p className="text-xs text-slate-500">{description}</p>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-all duration-300 ${active ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-slate-800 border border-white/5'}`}>
                <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm ${active ? 'translate-x-5' : 'translate-x-0'}`}
                />
            </div>
        </div>
    );
}
