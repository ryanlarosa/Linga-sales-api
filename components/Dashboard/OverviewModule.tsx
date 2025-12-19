import React, { useMemo } from 'react';
import { FetchedData } from '../../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface OverviewProps {
  data: FetchedData | null;
  theme: 'light' | 'dark';
  loading: boolean;
}

const parseCurrency = (val: string | undefined): number => {
    if (!val) return 0;
    return parseFloat(val.replace(/,/g, '').replace('$', '')) || 0;
};

const formatAED = (num: number) => {
  return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' AED';
};

const OverviewModule: React.FC<OverviewProps> = ({ data, theme, loading }) => {
  const { totalSales, totalGuests, avgTicket, chartData } = useMemo(() => {
    if (!data || !data.sales) return { totalSales: 0, totalGuests: 0, avgTicket: 0, chartData: [] };
    let netSum = 0; let guestSum = 0;
    const hourMap = new Map<string, number>();
    data.sales.forEach(sale => {
      const amt = parseCurrency(sale.netSalesStr);
      netSum += amt;
      guestSum += sale.guestCount || 0;
      if (sale.saleOpenTime) {
        const hour = new Date(sale.saleOpenTime).getHours();
        hourMap.set(String(hour), (hourMap.get(String(hour)) || 0) + amt);
      }
    });
    const avg = data.sales.length > 0 ? (netSum / data.sales.length) : 0;
    const cData = Array.from({length: 24}, (_, i) => ({ time: `${i}:00`, netSales: hourMap.get(String(i)) || 0 }));
    return { totalSales: netSum, totalGuests: guestSum, avgTicket: avg, chartData: cData };
  }, [data]);

  if (loading && !data) return <div className="px-8 mt-8 italic text-slate-400">Aggregating real-time metrics...</div>;

  return (
    <div className="px-8 mt-8 space-y-8 max-w-[1600px] mx-auto animate-fadeIn transition-colors duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 relative group overflow-hidden transition-colors">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Net Revenue</p>
          <h3 className="text-3xl font-extrabold dark:text-white">{formatAED(totalSales)}</h3>
          <div className="mt-4 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-rose-600 w-[65%]" /></div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 relative group overflow-hidden transition-colors">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Guests / Covers</p>
          <h3 className="text-3xl font-extrabold dark:text-white">{totalGuests}</h3>
          <div className="mt-4 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-rose-500 w-[45%]" /></div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 relative group overflow-hidden transition-colors">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Mean Ticket Value</p>
          <h3 className="text-3xl font-extrabold dark:text-white">{formatAED(avgTicket)}</h3>
          <div className="mt-4 h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-rose-700 w-[80%]" /></div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 h-[400px] flex flex-col transition-colors">
        <h3 className="text-xs font-bold text-slate-400 mb-6 uppercase tracking-wider">Hourly Sales Trajectory</h3>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRose" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e11d48" stopOpacity={0.2}/><stop offset="95%" stopColor="#e11d48" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} tickFormatter={(v) => `${v}`} />
              <Tooltip 
                contentStyle={{backgroundColor: theme==='dark'?'#0f172a':'#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', color: theme==='dark'?'#fff':'#000'}} 
                formatter={(val: number) => formatAED(val)}
              />
              <Area type="monotone" dataKey="netSales" stroke="#e11d48" strokeWidth={3} fillOpacity={1} fill="url(#colorRose)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default OverviewModule;