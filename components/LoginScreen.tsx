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
        // Attempt login. If Firestore fails, it falls back to mocks automatically.
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 relative overflow-hidden font-sans">
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[128px] animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md px-6">
        
        {/* Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl ring-1 ring-white/5">
            
            {/* Logo Section */}
            <div className="text-center mb-8">
                <div className="relative inline-block group cursor-default">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative w-16 h-16 bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center shadow-xl mb-6 mx-auto transform transition-transform group-hover:-rotate-3">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400 text-3xl font-extrabold">L</span>
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">LingaPOS <span className="text-indigo-500">Analytics</span></h1>
                <p className="text-slate-400 text-sm">Enterprise Data Gateway</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-4">
                    <div className="group">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1 group-focus-within:text-indigo-400 transition-colors">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all shadow-inner hover:bg-slate-950/80"
                            placeholder="Enter your username"
                        />
                    </div>
                    <div className="group">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1 group-focus-within:text-indigo-400 transition-colors">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all shadow-inner hover:bg-slate-950/80"
                            placeholder="•••••"
                        />
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs p-3 rounded-xl flex items-start gap-2 animate-fadeIn">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span className="leading-tight">{error}</span>
                    </div>
                )}

                {/* Login Button */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/25 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center relative overflow-hidden"
                >
                    {loading ? (
                        <div className="flex items-center justify-center gap-2">
                             <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                             <span>Connecting...</span>
                        </div>
                    ) : (
                        <span className="flex items-center gap-2">
                            Secure Login <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </span>
                    )}
                </button>
            </form>
        </div>
        
        <p className="text-center text-slate-600 text-[10px] mt-8 uppercase tracking-widest opacity-50">
            Secure Connection • Encrypted End-to-End
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;