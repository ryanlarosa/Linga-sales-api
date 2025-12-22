import React, { useState, useMemo, useRef } from "react";
import { FetchedData } from "../../types";
import { exportAnalysisToExcel } from "../../services/excelService";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Sub-components
import { parseCurrency } from "./Reports/ReportUtils";
import DSRRecap from "./Reports/DSRRecap";
import StaffMetrics from "./Reports/StaffMetrics";
import VoidLog from "./Reports/VoidLog";
import DiscountLedger from "./Reports/DiscountLedger";
import PivotAnalysis from "./Reports/PivotAnalysis";
import ItemPerformance from "./Reports/ItemPerformance";

interface ReportsProps {
  data: FetchedData | null;
  fromDate: string;
  toDate: string;
  selectedStoreName: string;
}

type AnalysisDimension = "CATEGORY" | "DEPARTMENT" | "HOUR" | "FLOOR";

const ReportsModule: React.FC<ReportsProps> = ({
  data,
  fromDate,
  toDate,
  selectedStoreName,
}) => {
  const [tab, setTab] = useState<
    "RECAP" | "ANALYSIS" | "MENU" | "STAFF" | "VOIDS" | "DISCOUNTS"
  >("RECAP");
  const [analysisDim, setAnalysisDim] = useState<AnalysisDimension>("CATEGORY");
  const [operationalTarget, setOperationalTarget] = useState<number>(0);
  const [modName, setModName] = useState("MANAGER");
  const [bohName, setBohName] = useState("CHEF");
  const [exporting, setExporting] = useState(false);
  const recapRef = useRef<HTMLDivElement>(null);

  // --- DERIVED DATA ---
  const dsrStats = useMemo(() => {
    if (!data || !data.sales || data.sales.length === 0) return null;
    let grossReceiptSum = 0;
    let net = 0;
    let tax = 0;
    let discTotal = 0;
    let guestCount = 0;

    const segments: Record<
      string,
      { revenue: number; covers: number; checks: number }
    > = {
      Breakfast: { revenue: 0, covers: 0, checks: 0 },
      Lunch: { revenue: 0, covers: 0, checks: 0 },
      Dinner: { revenue: 0, covers: 0, checks: 0 },
      Other: { revenue: 0, covers: 0, checks: 0 },
    };

    data.sales.forEach((s) => {
      const netVal = parseCurrency(s.netSalesStr);
      const taxVal = parseCurrency(s.totalTaxAmountStr);
      const grossReceipt = parseCurrency(s.grossReceiptStr);

      net += netVal;
      tax += taxVal;
      grossReceiptSum += grossReceipt;
      guestCount += s.guestCount;

      const dateObj = new Date(s.saleOpenTime);
      const h = isNaN(dateObj.getTime())
        ? parseInt(s.saleOpenTime.split(":")[0])
        : dateObj.getHours();

      let seg = "Other";
      if (h >= 6 && h < 11) seg = "Breakfast";
      else if (h >= 11 && h < 16) seg = "Lunch";
      else if (h >= 16 && h < 24) seg = "Dinner";

      segments[seg].revenue += netVal;
      segments[seg].covers += s.guestCount;
      segments[seg].checks += 1;
    });

    data.saleDetails.forEach((d) => {
      if (d.check !== "Total") discTotal += parseCurrency(d.discountAmtStr);
    });

    // REVENUE MIX BY DEPARTMENT (User requested: "based on the Department")
    const departmentMix: Record<string, number> = {};
    data.detailedMenu.forEach((m) => {
      const val = parseCurrency(m.totalGrossAmountStr);
      const dept = m.departmentName || "Unassigned";
      departmentMix[dept] = (departmentMix[dept] || 0) + val;
    });

    const avgGuest = guestCount > 0 ? net / guestCount : 0;

    return {
      gross: grossReceiptSum,
      net,
      tax,
      discTotal,
      guestCount,
      avgGuest,
      segments,
      departmentMix,
      checks: data.sales.length,
    };
  }, [data]);

  const staffMetrics = useMemo(() => {
    if (!data) return [];
    const map = new Map<
      string,
      { name: string; netSales: number; checks: number; covers: number }
    >();
    data.sales.forEach((sale) => {
      const empName =
        data.users.find((u) => u.id === sale.employee)?.name || "Unknown";
      const curr = map.get(empName) || {
        name: empName,
        netSales: 0,
        checks: 0,
        covers: 0,
      };
      curr.netSales += parseCurrency(sale.netSalesStr);
      curr.checks += 1;
      curr.covers += sale.guestCount || 0;
      map.set(empName, curr);
    });
    return Array.from(map.values()).sort((a, b) => b.netSales - a.netSales);
  }, [data]);

  const voidsData = useMemo(() => {
    if (!data) return [];
    return data.detailedMenu.filter(
      (item) => item.isVoid === "Y" || item.isVoid === "true"
    );
  }, [data]);

  const discountLedger = useMemo(() => {
    if (!data) return [];
    return data.saleDetails.filter((d) => d.check !== "Total");
  }, [data]);

  const menuPerformance = useMemo(() => {
    if (!data) return [];
    const map = new Map<
      string,
      { name: string; value: number; count: number }
    >();
    data.detailedMenu.forEach((m) => {
      const curr = map.get(m.menuName) || {
        name: m.menuName,
        value: 0,
        count: 0,
      };
      curr.value += parseCurrency(m.totalGrossAmountStr);
      curr.count += m.quantity;
      map.set(m.menuName, curr);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [data]);

  const flexibleData = useMemo(() => {
    if (!data) return [];
    const map = new Map<
      string,
      { name: string; value: number; count: number }
    >();
    if (analysisDim === "FLOOR") {
      data.sales.forEach((sale) => {
        const floor =
          data.floors.find((f) => f.id === sale.floorId)?.floorName || "Other";
        const curr = map.get(floor) || { name: floor, value: 0, count: 0 };
        curr.value += parseCurrency(sale.netSalesStr);
        curr.count += 1;
        map.set(floor, curr);
      });
    } else {
      data.detailedMenu.forEach((item) => {
        let key = item.categoryName || "Uncategorized";
        if (analysisDim === "DEPARTMENT")
          key = item.departmentName || "No Dept";
        if (analysisDim === "HOUR") key = `${parseInt(item.orderHour)}:00`;
        const curr = map.get(key) || { name: key, value: 0, count: 0 };
        curr.value += parseCurrency(item.grossAmountStr);
        curr.count += item.quantity || 0;
        map.set(key, curr);
      });
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [data, analysisDim]);

  const handleExportPDF = async () => {
    if (!recapRef.current) return;
    setExporting(true);
    try {
      const isDark = document.documentElement.classList.contains("dark");
      const canvas = await html2canvas(recapRef.current, {
        backgroundColor: isDark ? "#020617" : "#f8fafc",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`DSR_Recap_${selectedStoreName}_${fromDate}.pdf`);
    } catch (err) {
      console.error("PDF Export Failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handlePivotExport = () => {
    if (!data) return;
    exportAnalysisToExcel(flexibleData, analysisDim, selectedStoreName);
  };

  const handleMenuExport = () => {
    if (!data) return;
    exportAnalysisToExcel(menuPerformance, "MenuItem", selectedStoreName);
  };

  return (
    <div className="px-8 space-y-6 max-w-[1600px] mx-auto animate-fadeIn flex flex-col h-[calc(100vh-140px)] transition-colors duration-300">
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto custom-scrollbar transition-colors">
        {[
          { id: "RECAP", label: "DSR Recap" },
          { id: "ANALYSIS", label: "Pivot Table" },
          { id: "MENU", label: "Item Performance" },
          { id: "STAFF", label: "Staff Metrics" },
          { id: "VOIDS", label: "Void Log" },
          { id: "DISCOUNTS", label: "Discount Ledger" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              tab === t.id
                ? "border-slate-900 dark:border-rose-500 text-slate-900 dark:text-rose-400"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
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

      {data && dsrStats && (
        <div className="flex-1 overflow-auto custom-scrollbar pb-10">
          {tab === "RECAP" && (
            <DSRRecap
              ref={recapRef}
              data={data}
              dsrStats={dsrStats}
              fromDate={fromDate}
              selectedStoreName={selectedStoreName}
              modName={modName}
              setModName={setModName}
              bohName={bohName}
              setBohName={setBohName}
              operationalTarget={operationalTarget}
              setOperationalTarget={setOperationalTarget}
              exporting={exporting}
              onExportPDF={handleExportPDF}
            />
          )}

          {tab === "STAFF" && <StaffMetrics metrics={staffMetrics} />}

          {tab === "VOIDS" && <VoidLog voids={voidsData} data={data} />}

          {tab === "DISCOUNTS" && <DiscountLedger discounts={discountLedger} />}

          {tab === "ANALYSIS" && (
            <PivotAnalysis
              flexibleData={flexibleData}
              analysisDim={analysisDim}
              setAnalysisDim={setAnalysisDim}
              onExportExcel={handlePivotExport}
            />
          )}

          {tab === "MENU" && (
            <ItemPerformance
              menuPerformance={menuPerformance}
              onExportExcel={handleMenuExport}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsModule;
