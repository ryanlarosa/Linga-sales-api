import React, { useState } from 'react';
import { User } from '../types';
import { loginUser } from '../services/firestoreService';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
        const user = await loginUser(username, password);
        if (user) {
            onLogin(user);
        } else {
            setError('Invalid credentials.');
        }
    } catch (err) {
        setError('Connection failed. Please check your internet.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 relative overflow-hidden font-sans transition-colors duration-300">
      {/* Soft Brand Ambient Effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-rose-500/10 rounded-full blur-[128px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-rose-600/5 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md px-6">
        
        {/* Card */}
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-10 shadow-2xl shadow-rose-900/5">
            
            {/* Logo Section */}
            <div className="text-center mb-10">
                <div className="relative inline-block group cursor-default">
                    <div className="absolute -inset-2 bg-gradient-to-r from-rose-500 to-rose-700 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative w-16 h-16 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center justify-center shadow-lg mb-6 mx-auto transform transition-transform group-hover:-rotate-3">
                        <span className="text-rose-600 text-3xl font-extrabold">L</span>
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">LingaPOS <span className="text-rose-600">Analytics</span></h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-widest">Enterprise Reporting Hub</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-4">
                    <div className="group">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 group-focus-within:text-rose-600 transition-colors">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 transition-all shadow-sm hover:bg-slate-100 dark:hover:bg-slate-950/80"
                            placeholder="Your account ID"
                        />
                    </div>
                    <div className="group">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 group-focus-within:text-rose-600 transition-colors">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 transition-all shadow-sm hover:bg-slate-100 dark:hover:bg-slate-950/80"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {/* Error Messages */}
                {error && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-600 text-[11px] p-3 rounded-xl flex items-start gap-2 animate-fadeIn font-medium">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span className="leading-tight">{error}</span>
                    </div>
                )}

                {/* Login Button */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-rose-600/20 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center relative overflow-hidden"
                >
                    {loading ? (
                        <div className="flex items-center justify-center gap-2">
                             <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                             <span>Verifying...</span>
                        </div>
                    ) : (
                        <span className="flex items-center gap-2">
                            Secure Access <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </span>
                    )}
                </button>
            </form>
        </div>
        
        <p className="text-center text-slate-400 text-[10px] mt-8 uppercase tracking-widest opacity-70 font-bold">
            Cloud Intelligence • LingaPOS Enterprise
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;