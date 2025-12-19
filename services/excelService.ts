import * as XLSX from "xlsx";
import { FetchedData } from "../types";

// Helper: Convert string values (e.g. "$1,234.50") to actual numbers (1234.50)
const parseNum = (val: string | number | undefined | null): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const strVal = String(val).replace(/[$,\s]/g, ''); 
  const num = parseFloat(strVal);
  return isNaN(num) ? 0 : num;
};

export const exportToExcel = (data: FetchedData, storeName: string) => {
    if (!data || !data.sales || data.sales.length === 0) {
      throw new Error("No Data to Export");
    }

    const selectedStoreName = storeName || "Unknown Store";

    const extractedData1 = data.sales.map((item) => {
      const summary = data.saleSummary.find((sales) => sales.id === item.id);
      return {
        Store: selectedStoreName,
        Ticket_No: item.ticketNo,
        Sale_Open_Time: item.saleOpenTime,
        Net_Sales: parseNum(summary?.netSales),
        Total_Tax: parseNum(summary?.totalTaxAmount),
        Discount: parseNum(summary?.discounts),
        Guest_Count: parseNum(item.guestCount),
      };
    });

    const worksheet1 = XLSX.utils.json_to_sheet(extractedData1);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet1, "SalesData");
    XLSX.writeFile(workbook, `SalesData_${selectedStoreName}.xlsx`);
};

/**
 * EXPORT: SALE RECAP
 */
export const exportRecapToExcel = (summary: any, storeName: string) => {
    const data = [{
        Store: storeName,
        'Report Period': summary.period,
        'Gross Sales': parseNum(summary.grossSales),
        'Total Net Sales': parseNum(summary.netSales),
        'Total Tax': parseNum(summary.tax),
        'Total Discounts': parseNum(summary.discounts),
        'Guest Count': summary.guests,
        'Avg Ticket': parseNum(summary.avgTicket),
        'Ticket Count': summary.tickets
    }];
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recap");
    XLSX.writeFile(wb, `Recap_${storeName}.xlsx`);
};

/**
 * EXPORT: SPECIFIC ANALYSIS (Grouped data)
 */
export const exportAnalysisToExcel = (analysisData: any[], dimension: string, storeName: string) => {
    const data = analysisData.map(item => ({
        [dimension]: item.name,
        'Quantity/Count': item.count,
        'Total Value': parseNum(item.value)
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, dimension);
    XLSX.writeFile(wb, `${dimension}_Report_${storeName}.xlsx`);
};