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
    
    // Simulate auth check
    setTimeout(() => {
        if (username.toLowerCase() === 'admin' && password === 'admin') {
            onLogin({ username: 'admin', role: 'admin', name: 'Administrator' });
        } else if (username.toLowerCase() === 'user' && password === 'user') {
            onLogin({ username: 'user', role: 'user', name: 'Sales Associate' });
        } else {
            setError('Invalid credentials.');
            setLoading(false);
        }
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">
      {/* Abstract Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-blue-600/10 rounded-full blur-[120px]"></div>

      <div className="relative z-10 w-full max-w-md p-8">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="text-center mb-10">
                <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-6">
                    <span className="text-white text-3xl font-bold">L</span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">LingaPOS</h1>
                <p className="text-slate-400">Enterprise Analytics Dashboard</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="Enter username"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="Enter password"
                    />
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/25 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait"
                >
                    {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <p className="text-xs text-slate-500">
                    Demo Credentials: <span className="text-slate-300 font-mono">admin / admin</span>
                </p>
            </div>
        </div>
        <p className="text-center text-slate-500 text-xs mt-6">© 2024 LingaPOS Analytics. Version 2.0</p>
      </div>
    </div>
  );
};

export default LoginScreen;