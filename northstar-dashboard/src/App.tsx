import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import DailyPath from './pages/DailyPath';
import Projects from './pages/Projects';
import Strategy from './pages/Strategy';
import Habits from './pages/Habits';
import TimeLogs from './pages/TimeLogs';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';

// ... (imports remain the same)

// ... inside Routes ...
<Route
  path="/analytics"
  element={
    <PageWrapper>
      <Analytics />
    </PageWrapper>
  }
/>

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageWrapper>
              <Dashboard />
            </PageWrapper>
          }
        />
        <Route
          path="/daily-path"
          element={
            <PageWrapper>
              <DailyPath />
            </PageWrapper>
          }
        />
        <Route
          path="/projects"
          element={
            <PageWrapper>
              <Projects />
            </PageWrapper>
          }
        />
        <Route
          path="/habits"
          element={
            <PageWrapper>
              <Habits />
            </PageWrapper>
          }
        />
        <Route
          path="/strategy"
          element={
            <PageWrapper>
              <Strategy />
            </PageWrapper>
          }
        />
        <Route
          path="/logs"
          element={
            <PageWrapper>
              <TimeLogs />
            </PageWrapper>
          }
        />
        <Route
          path="/settings"
          element={
            <PageWrapper>
              <Settings />
            </PageWrapper>
          }
        />
        <Route
          path="/analytics"
          element={
            <PageWrapper>
              <Analytics />
            </PageWrapper>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

import { Menu } from 'lucide-react';
import { useState } from 'react';
import { MobileTimerFab } from './components/MobileTimerFab';

// ... (PageWrapper and AnimatedRoutes remain same)

function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background text-white overflow-hidden font-sans selection:bg-primary/30">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative w-full pb-32 md:pb-0">
        {/* Ambient Background Gradient */}
        <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

        {/* Mobile Header / Menu Button */}
        <div className="md:hidden p-4 pb-0 flex items-center gap-3 relative z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 bg-slate-800/50 rounded-lg text-white hover:bg-slate-700 transition-colors"
          >
            <Menu size={24} />
          </button>
          <span className="text-sm font-bold text-slate-300 tracking-widest uppercase">NorthStar</span>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto relative z-10">
          {children}
        </div>
      </main>

      {/* Mobile Timer Floating Button - Moved outside main to avoid overflow clipping */}
      <MobileTimerFab />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout>
        <AnimatedRoutes />
      </Layout>
    </Router>
  );
}

export default App;
