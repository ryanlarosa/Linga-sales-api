import React from 'react';
import { User } from '../../types';

interface SidebarProps {
  user: User;
  view: string;
  setView: (view: any) => void;
  onLogout: () => void;
}

const IconChart = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
const IconRecap = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" /></svg>;
const IconSettings = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

const Sidebar: React.FC<SidebarProps> = ({ user, view, setView, onLogout }) => {
  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden md:flex flex-col flex-shrink-0 z-20 transition-colors duration-300">
      <div className="h-20 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
        <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-rose-600/30">
          <span className="text-white font-bold text-lg">L</span>
        </div>
        <h1 className="text-lg font-bold tracking-wide dark:text-white">LingaPOS</h1>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center text-white font-bold text-sm shadow ring-2 ring-white dark:ring-slate-800 transition-all">
            {user.name?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate dark:text-white">{user.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-2">
        <button 
          onClick={() => setView('OVERVIEW')} 
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${view === 'OVERVIEW' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          <IconChart /><span className="font-medium text-sm">Overview</span>
        </button>
        <button 
          onClick={() => setView('REPORTS')} 
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${view === 'REPORTS' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          <IconRecap /><span className="font-medium text-sm">Analytics & Recap</span>
        </button>
        {user.role === 'superuser' && (
          <>
            <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Management</div>
            <button 
              onClick={() => setView('SETTINGS')} 
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${view === 'SETTINGS' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <IconSettings /><span className="font-medium text-sm">Configurations</span>
            </button>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <button 
          onClick={onLogout} 
          className="flex items-center gap-3 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-500 transition-colors text-sm font-medium w-full px-2 py-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;