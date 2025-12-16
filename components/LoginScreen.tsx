import React, { useState } from 'react';
import { User } from '../types';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    setTimeout(() => {
        if (username.toLowerCase() === 'admin' && password === 'admin') {
            onLogin({ username: 'admin', role: 'admin', name: 'Administrator' });
        } else if (username.toLowerCase() === 'user' && password === 'user') {
            onLogin({ username: 'user', role: 'user', name: 'Sales Associate' });
        } else {
            setError('Invalid credentials. Try admin / admin');
            setLoading(false);
        }
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/30 rounded-full blur-[128px] animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[128px]"></div>

      <div className="relative z-10 w-full max-w-md p-6">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl ring-1 ring-white/10">
            <div className="text-center mb-10">
                <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6 transform rotate-3 hover:rotate-6 transition-transform">
                    <span className="text-white text-3xl font-bold">L</span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">LingaPOS</h1>
                <p className="text-slate-400 text-sm">Enterprise Analytics Gateway</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
                <div className="group">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 group-focus-within:text-indigo-400 transition-colors">Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all shadow-inner"
                        placeholder="Enter your username"
                    />
                </div>
                <div className="group">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 group-focus-within:text-indigo-400 transition-colors">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all shadow-inner"
                        placeholder="Enter your password"
                    />
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3 rounded-lg flex items-center gap-2 animate-bounce-in">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/25 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait mt-2"
                >
                    {loading ? (
                        <div className="flex items-center justify-center gap-2">
                             <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                             <span>Connecting...</span>
                        </div>
                    ) : 'Access Dashboard'}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <p className="text-xs text-slate-600">
                    Restricted Access. Authorized Personnel Only.
                </p>
            </div>
        </div>
        <p className="text-center text-slate-600 text-[10px] mt-8 uppercase tracking-widest opacity-50">LingaPOS Analytics v2.4.0</p>
      </div>
    </div>
  );
};

export default LoginScreen;