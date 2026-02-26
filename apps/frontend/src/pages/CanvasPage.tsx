import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import CodingCanvas from '../components/canvas/CodingCanvas';
import { SunIcon, MoonIcon, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';

export default function CanvasPage() {
  const { authenticated, name, logout } = useAuthStore();
  const { darkMode, toggleDarkMode } = useUIStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authenticated) {
      navigate('/');
    }
  }, [authenticated, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!authenticated) return null;

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      <a href="#canvas-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-brand-600 focus:text-white focus:rounded">
        Skip to canvas
      </a>
      {/* Minimal header */}
      <header className="flex-shrink-0 h-12 border-b border-gray-200/80 dark:border-gray-700/80 flex items-center justify-between px-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white text-sm tracking-tight">Canvas</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[10px] font-bold text-white shadow-sm" aria-hidden="true">
              {name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300 hidden sm:inline">{name}</span>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <ArrowRightStartOnRectangleIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Full-screen canvas workspace */}
      <main id="canvas-main" className="flex-1 overflow-hidden" aria-label="Canvas workspace">
        <CodingCanvas />
      </main>
    </div>
  );
}
