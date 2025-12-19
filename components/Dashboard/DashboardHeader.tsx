import React from 'react';

interface HeaderProps {
  title: string;
  isSimulated: boolean;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  desiredLiveMode: boolean;
  setDesiredLiveMode: (mode: boolean) => void;
  onRefresh: () => void;
}

const IconMoon = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
const IconSun = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;

const DashboardHeader: React.FC<HeaderProps> = ({ title, isSimulated, theme, setTheme, desiredLiveMode, setDesiredLiveMode, onRefresh }) => {
  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-8 py-4 flex justify-between items-center h-20 transition-colors duration-300">
      <div>
        <h2 className="text-xl font-bold tracking-tight dark:text-white">{title}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className={`w-2 h-2 rounded-full ${isSimulated ? 'bg-amber-400' : 'bg-emerald-500'}`}></span>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">{isSimulated ? 'Simulated Data' : 'Live Stream Active'}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:ring-2 ring-rose-500/20 transition-all text-slate-600 dark:text-slate-300"
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex border border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => {setDesiredLiveMode(true); onRefresh();}} 
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${desiredLiveMode ? 'bg-rose-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            LIVE
          </button>
          <button 
            onClick={() => {setDesiredLiveMode(false); onRefresh();}} 
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${!desiredLiveMode ? 'bg-rose-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            DEMO
          </button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;