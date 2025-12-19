
import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatAED } from './ReportUtils';

const COLORS = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#1e293b', '#020617', '#111827'];

interface PivotAnalysisProps {
  flexibleData: any[];
  analysisDim: string;
  setAnalysisDim: (dim: any) => void;
  onExportExcel: () => void;
}

const PivotAnalysis: React.FC<PivotAnalysisProps> = ({ flexibleData, analysisDim, setAnalysisDim, onExportExcel }) => {
  return (
    <div className="flex flex-col flex-1 gap-6 animate-fadeIn">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex bg-slate-50 dark:bg-slate-950 rounded-xl p-1 border border-slate-200 dark:border-slate-800">
          {['CATEGORY', 'DEPARTMENT', 'HOUR', 'FLOOR'].map((d: any) => (
            <button key={d} onClick={() => setAnalysisDim(d)} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${analysisDim === d ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{d}</button>
          ))}
        </div>
        <button onClick={onExportExcel} className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xl">Pivot Export (Excel)</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <ResponsiveContainer width="100%" height={320}>
            {['HOUR', 'FLOOR'].includes(analysisDim) ? (
              <BarChart data={flexibleData}><XAxis dataKey="name" tick={{fontSize: 9, fill: '#64748b'}} axisLine={false} tickLine={false} /><YAxis tick={{fontSize: 9, fill: '#64748b'}} axisLine={false} tickLine={false} /><Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} formatter={(v: any) => formatAED(Number(v))} /><Bar dataKey="value" fill="#0f172a" radius={[6, 6, 0, 0]} /></BarChart>
            ) : (
              <PieChart><Pie data={flexibleData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4}>{flexibleData.map((_, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} formatter={(v: any) => formatAED(Number(v))} /><Legend iconType="circle" wrapperStyle={{fontSize: '10px', paddingTop: '20px'}} /></PieChart>
            )}
          </ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col">
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 font-black text-[10px] uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">Pivot Distribution</div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-black uppercase sticky top-0">
                <tr><th className="px-6 py-4">Dimension</th><th className="px-6 py-4 text-right">Qty</th><th className="px-6 py-4 text-right">Revenue (AED)</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {flexibleData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{row.name}</td>
                    <td className="px-6 py-4 text-right text-slate-500 font-bold">{row.count}</td>
                    <td className="px-6 py-4 text-right font-black font-mono text-slate-900 dark:text-white">{formatAED(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PivotAnalysis;
