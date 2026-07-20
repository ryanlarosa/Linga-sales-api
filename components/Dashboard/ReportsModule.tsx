import React, { useState, useMemo } from "react";
import { FetchedData } from "../../types";
import { 
  TrendingUp, Award, Calendar, Landmark, FileCheck, ClipboardList, PenTool, Copy, Check
} from 'lucide-react';

import { parseCurrency, formatAED } from "./Reports/ReportUtils";

interface ReportsProps {
  data: FetchedData | null;
  fromDate: string;
  toDate: string;
  selectedStoreName: string;
}

const ReportsModule: React.FC<ReportsProps> = ({
  data,
  fromDate,
  selectedStoreName,
}) => {
  const [modName, setModName] = useState("");
  const [chefName, setChefName] = useState("");
  const [reservations, setReservations] = useState(0);
  const [noShows, setNoShows] = useState(0);
  const [walkIns, setWalkIns] = useState(0);
  
  // Notes / Comments States
  const [specialEvents, setSpecialEvents] = useState("");
  const [vips, setVips] = useState("");
  const [complaints, setComplaints] = useState("");
  const [dayComments, setDayComments] = useState("");
  const [tomorrowBookings, setTomorrowBookings] = useState("");
  const [copied, setCopied] = useState(false);

  // --- STATS DERIVATION ---
  const stats = useMemo(() => {
    if (!data || !data.sales || data.sales.length === 0) return null;

    let grossSales = 0;
    let netSales = 0;
    let totalDiscount = 0;
    let totalCovers = 0;

    // Payment Type Map
    const payments: Record<string, { amount: number; count: number }> = {
      CASH: { amount: 0, count: 0 },
      VISA: { amount: 0, count: 0 },
      "MASTER CARD": { amount: 0, count: 0 },
      AMEX: { amount: 0, count: 0 },
      CLUB: { amount: 0, count: 0 },
      DELIVEROO: { amount: 0, count: 0 },
      PEEKABOX: { amount: 0, count: 0 },
      COMPLIMENTARY: { amount: 0, count: 0 },
      "MARKETING COMPLIMENTARY": { amount: 0, count: 0 },
    };

    data.sales.forEach((s) => {
      grossSales += parseCurrency(s.grossReceiptStr);
      netSales += parseCurrency(s.netSalesStr);
      totalCovers += s.guestCount || 0;
    });

    data.saleDetails.forEach((d) => {
      if (d.check !== "Total") {
        totalDiscount += parseCurrency(d.discountAmtStr);
      }
    });

    if (data.paymentSummary) {
      data.paymentSummary.forEach((p) => {
        const type = p.name ? p.name.toUpperCase() : "";
        let matched = false;
        Object.keys(payments).forEach((key) => {
          if (type.includes(key)) {
            payments[key].amount += p.amount || 0;
            payments[key].count += p.count || 0;
            matched = true;
          }
        });
        if (!matched && p.amount > 0) {
          if (type.includes("CARD")) {
            payments["MASTER CARD"].amount += p.amount || 0;
          } else {
            payments["CASH"].amount += p.amount || 0;
          }
        }
      });
    }

    const totalPayments = Object.values(payments).reduce((acc, p) => acc + p.amount, 0);

    // Revenue breakdown (Net Amount)
    const departments: Record<string, number> = {
      Food: 0,
      Beverage: 0,
      "Rise & Dawn": 0,
      "Encounter + Retail": 0,
    };

    data.detailedMenu.forEach((m) => {
      const gross = parseCurrency(m.totalGrossAmountStr);
      const discount = m.totalDiscountAmountStr ? parseCurrency(m.totalDiscountAmountStr) : 0;
      const net = gross - discount;

      const category = m.categoryName || "";
      const deptName = m.departmentName || "";
      
      if (deptName.toUpperCase().includes("FOOD") || category.toUpperCase().includes("FOOD")) {
        departments["Food"] += net;
      } else if (deptName.toUpperCase().includes("BEVERAGE") || category.toUpperCase().includes("BEVERAGE") || category.toUpperCase().includes("DRINK")) {
        departments["Beverage"] += net;
      } else if (deptName.toUpperCase().includes("RETAIL") || category.toUpperCase().includes("RETAIL")) {
        departments["Encounter + Retail"] += net;
      } else {
        departments["Encounter + Retail"] += net;
      }
    });

    const itemsMap = new Map<string, { name: string; gross: number }>();
    data.detailedMenu.forEach((m) => {
      const curr = itemsMap.get(m.menuName) || { name: m.menuName, gross: 0 };
      curr.gross += parseCurrency(m.totalGrossAmountStr);
      itemsMap.set(m.menuName, curr);
    });
    const topItems = Array.from(itemsMap.values())
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 5);

    const saleIdToTicketNo = new Map<string, string>();
    data.sales.forEach((s) => {
      saleIdToTicketNo.set(s.id, s.ticketNo);
    });

    const checkVoids = new Map<string, number>();
    const checkComps = new Map<string, number>();

    data.detailedMenu.forEach((m) => {
      const ticketNo = saleIdToTicketNo.get(m.saleId);
      if (!ticketNo) return;
      
      const isVoid = m.isVoid === "Y" || m.isVoid === "true";
      const val = parseCurrency(m.totalGrossAmountStr);
      
      if (isVoid) {
        checkVoids.set(ticketNo, (checkVoids.get(ticketNo) || 0) + val);
      }
      
      const discVal = m.totalDiscountAmountStr ? parseCurrency(m.totalDiscountAmountStr) : 0;
      if (discVal > 0 && Math.abs(discVal - val) < 0.05) {
        checkComps.set(ticketNo, (checkComps.get(ticketNo) || 0) + discVal);
      }
    });

    // Group discounts by discount name/remark
    const discountGroups = new Map<string, { remarks: string; count: number; voidAmt: number; compAmt: number; discountAmt: number }>();

    data.saleDetails
      .filter((d) => d.check !== "Total")
      .forEach((d) => {
        const name = d.discountName || "General Discount";
        const checkNo = d.check || "N/A";
        const voidAmt = checkVoids.get(checkNo) || 0;
        const compAmt = checkComps.get(checkNo) || 0;
        const discountAmt = parseCurrency(d.discountAmtStr);
        
        const curr = discountGroups.get(name) || {
          remarks: name,
          count: 0,
          voidAmt: 0,
          compAmt: 0,
          discountAmt: 0
        };
        
        curr.voidAmt += voidAmt;
        curr.compAmt += compAmt;
        curr.discountAmt += compAmt > 0 ? 0 : discountAmt;
        curr.count += 1;
        discountGroups.set(name, curr);
      });

    const discountLedger = Array.from(discountGroups.values());

    return {
      grossSales,
      netSales,
      totalDiscount,
      totalCovers,
      averageCheck: totalCovers > 0 ? netSales / totalCovers : 0,
      departments,
      payments,
      totalPayments,
      topItems,
      discountLedger
    };
  }, [data]);

  const handleCopyToClipboard = () => {
    if (!stats) return;
    
    let text = `${selectedStoreName} - EOD RECAP (${fromDate})\n\n`;
    text += `MOD: ${modName || "N/A"} | Chef: ${chefName || "N/A"}\n`;
    text += `Total Covers: ${stats.totalCovers}\n`;
    text += `Reservations: ${reservations} | Walk-Ins: ${walkIns}\n`;
    text += `Day Grand Sales: ${formatAED(stats.grossSales)}\n`;
    text += `NET Daily Revenue: ${formatAED(stats.netSales)}\n`;
    text += `Average Check per Guest: ${formatAED(stats.averageCheck)}\n\n`;
    
    text += `REVENUE MIX (NET):\n`;
    Object.entries(stats.departments).forEach(([name, val]) => {
      if (val > 0) {
        text += `- ${name}: ${formatAED(val)}\n`;
      }
    });
    if (stats.totalDiscount > 0) {
      text += `- Discount Ref: ${formatAED(stats.totalDiscount)}\n`;
    }
    text += `- Total NET Revenue: ${formatAED(stats.netSales)}\n\n`;
    
    text += `PAYMENTS TALLY:\n`;
    Object.entries(stats.payments).forEach(([name, val]) => {
      if (val.amount > 0) {
        text += `- ${name}: ${formatAED(val.amount)}\n`;
      }
    });
    text += `- TOTAL PAYMENTS: ${formatAED(stats.totalPayments || stats.grossSales)}\n\n`;
    
    text += `TOP SELLING ITEMS:\n`;
    stats.topItems.forEach((item, idx) => {
      text += `${idx + 1}. ${item.name} (${formatAED(item.gross)})\n`;
    });
    text += `\n`;
    
    if (specialEvents) {
      text += `SPECIAL EVENTS / VIPS:\n${specialEvents}\n\n`;
    }
    if (complaints) {
      text += `GUEST COMPLAINTS & RECOVERY:\n${complaints}\n\n`;
    }
    if (dayComments) {
      text += `OVERALL DAY COMMENTS:\n${dayComments}\n\n`;
    }
    if (tomorrowBookings) {
      text += `TOMORROW'S BOOKINGS:\n${tomorrowBookings}\n`;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  if (!data || !stats) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-400 py-20">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-rose-600 rounded-full animate-spin mb-4"></div>
        <p className="italic font-medium">Synchronizing Cloud Data...</p>
      </div>
    );
  }

  return (
    <div className="px-8 space-y-6 max-w-[1600px] mx-auto animate-fadeIn pb-12">
      {/* Upper Title Bar */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-black dark:text-white uppercase tracking-wider">Daily Operations & DSR Recap</h2>
          <p className="text-xs text-slate-500">{selectedStoreName} — {fromDate}</p>
        </div>
        <button
          onClick={handleCopyToClipboard}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/10 transition-all cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied to Clipboard!" : "Copy for Email"}
        </button>
      </div>

      <div className="space-y-6 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
        
        {/* Main DSR Summary Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Section 1: DSR Metrics Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-rose-500" /> Operational Metrics
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">MOD / Chef:</span>
                <div className="flex gap-1">
                  <input 
                    value={modName} 
                    onChange={(e) => setModName(e.target.value)}
                    placeholder="Enter MOD name"
                    className="w-20 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold outline-none text-slate-900 dark:text-white"
                  />
                  <input 
                    value={chefName} 
                    onChange={(e) => setChefName(e.target.value)}
                    placeholder="Enter Chef name"
                    className="w-20 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Total Covers:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{stats.totalCovers}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Reservations:</span>
                <input 
                  type="number" 
                  value={reservations} 
                  onChange={(e) => setReservations(Number(e.target.value))}
                  className="w-12 text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold outline-none text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Walk-Ins:</span>
                <input 
                  type="number" 
                  value={walkIns} 
                  onChange={(e) => setWalkIns(Number(e.target.value))}
                  className="w-12 text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold outline-none text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Day Grand Sales:</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatAED(stats.grossSales)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">NET Daily Revenue:</span>
                <span className="font-black text-emerald-600">{formatAED(stats.netSales)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Average Check per Guest:</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatAED(stats.averageCheck)}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Department Revenue Breakdown (Net Values) */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Revenue Mix (Net)
            </h3>
            <div className="space-y-2.5 text-xs">
              {Object.entries(stats.departments).map(([name, amount]) => (
                <div key={name} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="text-slate-400">{name} Revenue</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatAED(amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Discount Reference:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatAED(stats.totalDiscount)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-black text-slate-900 dark:text-white">Total Net Revenue:</span>
                <span className="text-xs font-black text-emerald-600">{formatAED(stats.netSales)}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Payment Settlement Tally */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-blue-500" /> Payment Settlements
            </h3>
            <div className="space-y-2 text-xs max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
              {Object.entries(stats.payments)
                .filter(([_, val]) => val.amount > 0)
                .map(([name, val]) => (
                  <div key={name} className="flex justify-between items-center py-1 border-b border-slate-55 dark:border-slate-800/80 last:border-0">
                    <span className="text-slate-400 text-[10px]">{name}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatAED(val.amount)}</span>
                  </div>
                ))}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Total Payments:</span>
                <span className="font-black text-slate-800 dark:text-slate-200">{formatAED(stats.totalPayments || stats.grossSales)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes, Comments & Top Selling Items */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          
          {/* Operations Notes Column */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
              <PenTool className="w-4 h-4 text-amber-500" /> Duty Logs & Feedback
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Special Events / VIPs</label>
                <textarea
                  value={specialEvents}
                  onChange={(e) => setSpecialEvents(e.target.value)}
                  placeholder="Enter events or VIP notes..."
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-600 transition-all h-20 resize-none"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Guest Complaints & Recovery</label>
                <textarea
                  value={complaints}
                  onChange={(e) => setComplaints(e.target.value)}
                  placeholder="Enter guest feedback and recovery actions..."
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-600 transition-all h-20 resize-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Overall Shift Comments</label>
                <textarea
                  value={dayComments}
                  onChange={(e) => setDayComments(e.target.value)}
                  placeholder="Write a summary of today's operations..."
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-600 transition-all h-20 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Top Items & Tomorrow's Bookings */}
          <div className="space-y-4">
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" /> Top Selling Items
              </h3>
              <div className="space-y-2 text-xs">
                {stats.topItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-55 dark:border-slate-800 last:border-0">
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{item.name}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatAED(item.gross)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-500" /> Tomorrow's Bookings
              </h3>
              <input
                value={tomorrowBookings}
                onChange={(e) => setTomorrowBookings(e.target.value)}
                placeholder="Tomorrow's bookings..."
                className="w-full text-xs font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-600 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Consolidated Discount Page Table */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-500" /> Discount & Void Audit (Consolidated)
          </h3>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <tr className="text-slate-500 uppercase tracking-widest text-[9px] font-black">
                  <th className="py-2.5 px-4">Discount Name / Reason</th>
                  <th className="py-2.5 px-4 text-center">Tx Count</th>
                  <th className="py-2.5 px-4 text-center">Void Value</th>
                  <th className="py-2.5 px-4 text-center">Comp Value</th>
                  <th className="py-2.5 px-4 text-right">Discount Value</th>
                </tr>
              </thead>
              <tbody>
                {stats.discountLedger.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 italic">No discounts or voids processed today.</td>
                  </tr>
                ) : (
                  stats.discountLedger.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 last:border-0">
                      <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">{row.remarks}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-650 dark:text-slate-400">{row.count}</td>
                      <td className="py-2.5 px-4 text-center text-rose-500 font-semibold">{row.voidAmt > 0 ? formatAED(row.voidAmt) : "-"}</td>
                      <td className="py-2.5 px-4 text-center text-rose-500 font-semibold">{row.compAmt > 0 ? formatAED(row.compAmt) : "-"}</td>
                      <td className="py-2.5 px-4 text-right text-rose-600 font-black">{row.discountAmt > 0 ? formatAED(row.discountAmt) : "-"}</td>
                    </tr>
                  ))
                )}
                {stats.discountLedger.length > 0 && (
                  <tr className="bg-slate-50 dark:bg-slate-950 font-black border-t border-slate-200 dark:border-slate-800">
                    <td className="py-3 px-4 uppercase text-[9px]">Total Summary</td>
                    <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                      {stats.discountLedger.reduce((acc, r) => acc + r.count, 0)}
                    </td>
                    <td className="py-3 px-4 text-center text-rose-500">
                      {formatAED(stats.discountLedger.reduce((acc, r) => acc + r.voidAmt, 0))}
                    </td>
                    <td className="py-3 px-4 text-center text-rose-500">
                      {formatAED(stats.discountLedger.reduce((acc, r) => acc + r.compAmt, 0))}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600">
                      {formatAED(stats.discountLedger.reduce((acc, r) => acc + r.discountAmt, 0))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ReportsModule;
