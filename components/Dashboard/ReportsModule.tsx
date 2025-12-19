
import React, { useState, useMemo, useRef } from 'react';
import { FetchedData } from '../../types';
import { exportAnalysisToExcel } from '../../services/excelService';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ReportsProps {
  data: FetchedData | null;
  fromDate: string;
  toDate: string;
  selectedStoreName: string;
}

type AnalysisDimension = 'CATEGORY' | 'DEPARTMENT' | 'HOUR' | 'FLOOR';
const COLORS = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#1e293b', '#020617', '#111827'];

const parseCurrency = (val: string | undefined | number): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[$,\s]/g, '');
    return parseFloat(clean) || 0;
};

const formatAED = (num: number) => {
  return num.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' AED';
};

const ReportsModule: React.FC<ReportsProps> = ({ data, fromDate, toDate, selectedStoreName }) => {
  const [tab, setTab] = useState<'RECAP' | 'ANALYSIS' | 'MENU' | 'STAFF' | 'VOIDS' | 'DISCOUNTS'>('RECAP');
  const [analysisDim, setAnalysisDim] = useState<AnalysisDimension>('CATEGORY');
  const [operationalTarget, setOperationalTarget] = useState<number>(0);
  const [exporting, setExporting] = useState(false);
  const recapRef = useRef<HTMLDivElement>(null);

  // --- DERIVED DATA ---
  const dsrStats = useMemo(() => {
    if (!data || !data.sales || data.sales.length === 0) return null;
    let gross = 0; let net = 0; let tax = 0; let discTotal = 0; let guestCount = 0;
    
    const segments: Record<string, { revenue: number, covers: number, checks: number }> = { 
      Breakfast: { revenue: 0, covers: 0, checks: 0 }, 
      Lunch: { revenue: 0, covers: 0, checks: 0 }, 
      Dinner: { revenue: 0, covers: 0, checks: 0 }, 
      Other: { revenue: 0, covers: 0, checks: 0 } 
    };

    data.sales.forEach(s => {
      const netVal = parseCurrency(s.netSalesStr);
      net += netVal;
      gross += parseCurrency(s.grossAmountStr);
      tax += parseCurrency(s.totalTaxAmountStr);
      guestCount += s.guestCount;

      const dateObj = new Date(s.saleOpenTime);
      const h = isNaN(dateObj.getTime()) ? parseInt(s.saleOpenTime.split(':')[0]) : dateObj.getHours();
      
      let seg = 'Other';
      if (h >= 6 && h < 11) seg = 'Breakfast';
      else if (h >= 11 && h < 16) seg = 'Lunch';
      else if (h >= 16 && h < 24) seg = 'Dinner';

      segments[seg].revenue += netVal;
      segments[seg].covers += s.guestCount;
      segments[seg].checks += 1;
    });

    data.saleDetails.forEach(d => {
      if (d.check !== 'Total') discTotal += parseCurrency(d.discountAmtStr);
    });

    const categories = { Food: 0, NonAlc: 0, Alc: 0, Retail: 0 };
    data.detailedMenu.forEach(m => {
        const val = parseCurrency(m.totalGrossAmountStr);
        const dept = (m.departmentName || '').toLowerCase();
        if (dept.includes('food')) categories.Food += val;
        else if (dept.includes('bev') || dept.includes('drink')) {
            if (dept.includes('wine') || dept.includes('alc')) categories.Alc += val;
            else categories.NonAlc += val;
        } else {
            categories.Retail += val;
        }
    });

    const avgGuest = guestCount > 0 ? (net / guestCount) : 0;

    return { 
      gross, net, tax, discTotal, guestCount, avgGuest,
      segments, categories,
      checks: data.sales.length
    };
  }, [data]);

  const menuPerformance = useMemo(() => {
    if(!data) return [];
    const map = new Map<string, { name: string, value: number, count: number }>();
    data.detailedMenu.forEach(m => {
        const curr = map.get(m.menuName) || { name: m.menuName, value: 0, count: 0 };
        curr.value += parseCurrency(m.totalGrossAmountStr);
        curr.count += m.quantity;
        map.set(m.menuName, curr);
    });
    return Array.from(map.values()).sort((a,b) => b.value - a.value);
  }, [data]);

  const variance = dsrStats ? dsrStats.net - operationalTarget : 0;
  const variancePct = operationalTarget > 0 ? (variance / operationalTarget) * 100 : 0;

  const flexibleData = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { name: string, value: number, count: number }>();
    if (analysisDim === 'FLOOR') {
      data.sales.forEach(sale => {
        const floor = data.floors.find(f => f.id === sale.floorId)?.floorName || "Other";
        const curr = map.get(floor) || { name: floor, value: 0, count: 0 };
        curr.value += parseCurrency(sale.netSalesStr); curr.count += 1;
        map.set(floor, curr);
      });
    } else {
      data.detailedMenu.forEach(item => {
        let key = item.categoryName || "Uncategorized";
        if (analysisDim === 'DEPARTMENT') key = item.departmentName || "No Dept";
        if (analysisDim === 'HOUR') key = `${parseInt(item.orderHour)}:00`;
        const curr = map.get(key) || { name: key, value: 0, count: 0 };
        curr.value += parseCurrency(item.grossAmountStr); curr.count += (item.quantity || 0);
        map.set(key, curr);
      });
    }
    return Array.from(map.values()).sort((a,b) => b.value - a.value);
  }, [data, analysisDim]);

  const handleExportPDF = async () => {
    if (!recapRef.current) return;
    setExporting(true);
    try {
      const isDark = document.documentElement.classList.contains('dark');
      const canvas = await html2canvas(recapRef.current, {
        backgroundColor: isDark ? '#020617' : '#f8fafc',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`DSR_Recap_${selectedStoreName}_${fromDate}.pdf`);
    } catch (err) {
      console.error("PDF Export Failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportTab = () => {
    if(!data) return;
    if (tab === 'ANALYSIS') exportAnalysisToExcel(flexibleData, analysisDim, selectedStoreName);
    if (tab === 'MENU') exportAnalysisToExcel(menuPerformance, "MenuItem", selectedStoreName);
  };

  return (
    <div className="px-8 space-y-6 max-w-[1600px] mx-auto animate-fadeIn flex flex-col h-[calc(100vh-140px)] transition-colors duration-300">
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto custom-scrollbar transition-colors">
        {[
          { id: 'RECAP', label: 'DSR Recap' },
          { id: 'ANALYSIS', label: 'Pivot Table' },
          { id: 'MENU', label: 'Item Performance' },
          { id: 'STAFF', label: 'Staff Metrics' },
          { id: 'VOIDS', label: 'Void Log' },
          { id: 'DISCOUNTS', label: 'Discount Ledger' }
        ].map(t => (
          <button 
            key={t.id} 
            onClick={() => setTab(t.id as any)} 
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? 'border-slate-900 dark:border-rose-500 text-slate-900 dark:text-rose-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!data && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-20">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mb-4"></div>
          <p className="italic font-medium">Synchronizing Cloud Data...</p>
        </div>
      )}

      {data && (
        <div className="flex-1 overflow-auto custom-scrollbar pb-10">
          {tab === 'RECAP' && dsrStats && (
            <div className="flex flex-col gap-8 animate-fadeIn pb-12" ref={recapRef}>
                
                {/* 1. TOP CARDS - Reordered: Gross, Tax, Discount, Checks, Net (Last) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Gross Revenue</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{formatAED(dsrStats.gross)}</h3>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all text-neutral-600">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Total Tax</p>
                        <h3 className="text-2xl font-black text-slate-600 dark:text-slate-300">{formatAED(dsrStats.tax)}</h3>
                    </div>
                    {/* Discount Card - Neutral Color */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Discount</p>
                        <h3 className="text-2xl font-black text-slate-700 dark:text-slate-200">{formatAED(dsrStats.discTotal)}</h3>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Checks / Covers</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{dsrStats.checks} / {dsrStats.guestCount}</h3>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight">Avg {formatAED(dsrStats.avgGuest)} / Guest</p>
                    </div>
                    {/* Net Sales - Last and Prominent */}
                    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 transform transition-transform">
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Net Sales</p>
                        <h3 className="text-2xl font-black">{formatAED(dsrStats.net)}</h3>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* VENUE LEVEL SPLIT */}
                  <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm h-fit">
                    <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-3">Net Revenue Split - Venue Level</h4>
                    <table className="w-full text-[11px]">
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            <tr className="bg-slate-50 dark:bg-slate-950/40 font-black">
                                <td className="px-4 py-4">Actual (Today)</td>
                                <td className="px-4 py-4 text-right text-base text-slate-900 dark:text-white">{formatAED(dsrStats.net)}</td>
                                <td className="px-4 py-4 text-right text-base">
                                  <div className="flex flex-col text-[10px] text-slate-500 text-right">
                                    <span className="font-bold">{dsrStats.checks} Checks</span>
                                    <span className="font-bold">{dsrStats.guestCount} Covers</span>
                                  </div>
                                </td>
                            </tr>
                            <tr className="font-bold">
                                <td className="px-4 py-4 text-slate-400 uppercase tracking-tighter">Operational Target</td>
                                <td className="px-4 py-4 text-right">
                                    <input 
                                        type="number" 
                                        value={operationalTarget || ''} 
                                        onChange={(e) => setOperationalTarget(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-32 bg-slate-50 dark:bg-slate-800 border-b-2 border-slate-200 dark:border-slate-700 text-right focus:border-slate-900 dark:focus:border-rose-500 outline-none px-2 py-1 font-mono text-xs transition-colors"
                                    />
                                </td>
                                <td className="px-4 py-4 text-right font-medium text-slate-400">Target Line</td>
                            </tr>
                            <tr className={`font-black bg-slate-50/20 dark:bg-slate-900/50`}>
                                <td className="px-4 py-4 uppercase tracking-widest text-[9px]">Target Variance</td>
                                <td className="px-4 py-4 text-right text-slate-900 dark:text-white font-mono">{formatAED(variance)}</td>
                                <td className="px-4 py-4 text-right text-slate-500">{variancePct.toFixed(1)}%</td>
                            </tr>
                        </tbody>
                    </table>
                  </div>

                  <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                        <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-3">Revenue Contribution by Segment</h4>
                        <table className="w-full text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-3 text-left">Segment</th>
                                    <th className="text-right px-4">Net Revenue</th>
                                    <th className="text-right px-4 uppercase tracking-tighter">Checks</th>
                                    <th className="text-right px-4 uppercase tracking-tighter">Covers</th>
                                    <th className="text-right px-4">Avg Spend</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {['Breakfast', 'Lunch', 'Dinner', 'Other'].map(key => (
                                    <tr key={key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3.5 font-bold">{key}</td>
                                        <td className="px-4 py-3.5 text-right font-mono text-slate-900 dark:text-slate-100">{(dsrStats.segments as any)[key].revenue.toLocaleString()} AED</td>
                                        <td className="px-4 py-3.5 text-right font-bold text-slate-600 dark:text-slate-400">{(dsrStats.segments as any)[key].checks}</td>
                                        <td className="px-4 py-3.5 text-right font-bold text-slate-600 dark:text-slate-400">{(dsrStats.segments as any)[key].covers}</td>
                                        <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-slate-100">
                                          {(dsrStats.segments as any)[key].covers > 0 ? formatAED((dsrStats.segments as any)[key].revenue / (dsrStats.segments as any)[key].covers) : '0 AED'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                  </div>
                </div>

                {/* 3. SETTLEMENT & DISCOUNT SUMMARIES */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                        <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-3">Settlement Summary</h4>
                        <table className="w-full text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-3 text-left">Tender Type</th>
                                    <th className="px-4 py-3 text-right">Count</th>
                                    <th className="px-4 py-3 text-right">Settled Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(data.paymentSummary || []).map((p, i) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3 font-bold">{p.name}</td>
                                        <td className="px-4 py-3 text-right text-slate-400 font-bold">{p.count}</td>
                                        <td className="px-4 py-3 text-right font-black font-mono">{formatAED(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 font-black">
                                <tr>
                                    <td className="px-4 py-4 text-[10px] uppercase tracking-wider">Total Settlements</td>
                                    <td className="px-4 py-4"></td>
                                    <td className="px-4 py-4 text-right text-base text-slate-900 dark:text-white">
                                      {formatAED(((data.paymentSummary || []).reduce((acc: number, p) => acc + (p.amount || 0), 0) || dsrStats.gross) as number)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                        <h4 className="text-[10px] font-black uppercase text-white bg-[#001f3f] px-4 py-3">Discount Analysis</h4>
                        <table className="w-full text-[11px]">
                            <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-3 text-left">Campaign</th>
                                    <th className="px-4 py-3 text-right">Qty</th>
                                    <th className="px-4 py-3 text-right">Reduction (AED)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {Array.from(data.saleDetails.filter(d => d.check !== 'Total').reduce((acc, curr) => {
                                    const existing = acc.get(curr.discountName) || { count: 0, amount: 0 };
                                    existing.count += curr.quantity || 1;
                                    existing.amount += parseCurrency(curr.discountAmtStr);
                                    acc.set(curr.discountName, existing);
                                    return acc;
                                }, new Map<string, {count: number, amount: number}>()).entries()).map(([name, val], i) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3 font-bold">{name}</td>
                                        <td className="px-4 py-3 text-right text-slate-400 font-bold">{val.count}</td>
                                        <td className="px-4 py-3 text-right font-black font-mono text-slate-700 dark:text-slate-300">{formatAED(val.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 font-black">
                                <tr>
                                    <td className="px-4 py-4 text-[10px] uppercase tracking-wider">Total Reductions</td>
                                    <td className="px-4 py-4"></td>
                                    <td className="px-4 py-4 text-right text-base text-slate-800 dark:text-slate-100">{formatAED(dsrStats.discTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* EXPORT ACTION BOTTOM - High Quality PDF */}
                <div className="flex justify-center pt-10 no-print">
                     <button 
                        onClick={handleExportPDF} 
                        disabled={exporting}
                        className="flex items-center px-12 py-5 bg-slate-900 text-white text-xs font-black rounded-full shadow-2xl hover:bg-slate-800 hover:scale-[1.02] transition-all uppercase tracking-[0.2em] active:scale-95 disabled:opacity-50"
                     >
                        {exporting ? (
                          <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-3"></div> Finalizing PDF Report...</>
                        ) : (
                          <><svg className="w-4 h-4 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Export Executive PDF Report</>
                        )}
                    </button>
                </div>

              </div>
          )}

          {tab === 'ANALYSIS' && (
            <div className="flex flex-col flex-1 gap-6 animate-fadeIn">
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex bg-slate-50 dark:bg-slate-950 rounded-xl p-1 border border-slate-200 dark:border-slate-800">
                        {['CATEGORY', 'DEPARTMENT', 'HOUR', 'FLOOR'].map((d: any) => (
                        <button key={d} onClick={() => setAnalysisDim(d)} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${analysisDim === d ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>{d}</button>
                        ))}
                    </div>
                    <button onClick={handleExportTab} className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xl">Pivot Export (Excel)</button>
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
          )}

          {tab === 'MENU' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-fadeIn">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/40">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Product Velocity Metrics</h3>
                    <button onClick={handleExportTab} className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg">Export Sheet (Excel)</button>
                </div>
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 font-black uppercase text-slate-500 border-b border-slate-100 dark:border-slate-800">
                        <tr><th className="px-6 py-5">Product Name</th><th className="text-right px-6 py-5">Units Sold</th><th className="text-right px-6 py-5">Net Sales (AED)</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {menuPerformance.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{item.name}</td>
                                <td className="px-6 py-4 text-right font-bold text-slate-400">{item.count}</td>
                                <td className="px-6 py-4 text-right font-black font-mono text-slate-900 dark:text-white">{formatAED(item.value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsModule;
