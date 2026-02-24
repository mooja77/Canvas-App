import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Toaster } from 'react-hot-toast';
import { useUIStore } from './stores/uiStore';
import './index.css';

// Initialize dark mode from persisted state
const darkMode = useUIStore.getState().darkMode;
if (darkMode) {
  document.documentElement.classList.add('dark');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        className: 'dark:bg-gray-800 dark:text-white',
        style: { borderRadius: '10px', padding: '12px 16px' },
      }}
    />
  </React.StrictMode>
);
