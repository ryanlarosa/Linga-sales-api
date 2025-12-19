
import * as XLSX from "xlsx";
import { FetchedData } from "../types";

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

    // SHEET 1: SalesData
    const salesData = data.sales.map((item) => {
      const saleDate = new Date(item.startDate);
      const day = String(saleDate.getDate()).padStart(2, "0");
      const month = String(saleDate.getMonth() + 1).padStart(2, "0");
      const year = saleDate.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;

      const floorName = data.floors.find((f) => f.id === item.floorId)?.floorName || "Unknown";
      const createdBy = data.users.find((u) => u.id === item.employee)?.name || "Unknown";
      const closedBy = data.users.find((u) => u.id === item.saleCloseEmployee)?.name || "Unknown";

      const summary = data.saleSummary.find((s) => s.id === item.id);

      return {
        Store: selectedStoreName,
        Ticket_No: item.ticketNo,
        Customer_Name: item.customerName,
        Sale_Open_Time: item.saleOpenTime,
        Floor: floorName,
        Table_No: item.tableNo,
        Net_Sales: parseNum(summary?.netSales),
        Total_Tax: parseNum(summary?.totalTaxAmount),
        Discount: parseNum(summary?.discounts),
        Gross_Receipt: parseNum(item.grossReceiptStr),
        Closed_By: closedBy,
        Server_Name: createdBy,
        Guest_Count: item.guestCount,
        Final_SaleDate: formattedDate,
      };
    });

    // SHEET 2: DiscountData
    const filteredDiscountData = data.saleDetails.filter((item) => item.check !== "Total");
    const discountData = filteredDiscountData.map((item) => ({
      Store: selectedStoreName,
      Approved_By: item.approvedBy,
      Check: item.check, // Mapped to Link to Ticket
      Date: item.date,
      Discount_Amount: parseNum(item.discountAmtStr),
      Discount_Applied_By: item.discountAppliedBy,
      Discount_Coupon: item.discountCoupon,
      Discount_Name: item.discountName,
      Discount_Type: item.discountType,
      Gross_Sales: parseNum(item.grossSalesStr),
      Is_Total: item.isTotal,
      Menu_Items: item.menuItems,
      Percent: item.percent,
      Quantity: item.quantity,
      Reason: item.reason,
      Total_Discounts: parseNum(item.totalDiscounts),
    }));

    // SHEET 3: MenuItemDetailed
    const menuItemData = data.detailedMenu.map((item) => {
      const saleDate = new Date(item.saleDate);
      const day = String(saleDate.getDate()).padStart(2, "0");
      const month = String(saleDate.getMonth() + 1).padStart(2, "0");
      const year = saleDate.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;
      const orderMin = String(item.orderMin).padStart(2, '0');

      const voidBy = data.users.find((u) => u.id === item.voidByEmployee)?.name || "Unknown";
      const discountName = data.saleDetails.find(
          (d) => d.check === item.saleId && item.totalDiscountAmountStr !== "0.00"
      )?.discountName || "N/A";

      return {
        Store: selectedStoreName,
        Order_Date: formattedDate,
        Order_Hour: `${item.orderHour}:${orderMin}`,
        Ticket_No: item.saleId,
        Department: item.departmentName,
        CategoryName: item.categoryName,
        SubCategoryName: item.subCategoryName,
        Quantity: item.quantity,
        Menu_Item: item.menuName,
        Gross_Amount: parseNum(item.grossAmountStr),
        Total_Amount: parseNum(item.totalGrossAmountStr),
        Discount: parseNum(item.totalDiscountAmountStr),
        DiscountName: discountName,
        Is_Void: item.isVoid,
        Void_Reason: item.voidError,
        VoidedBy: voidBy,
      };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(salesData), "SalesData");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(discountData), "DiscountData");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(menuItemData), "MenuItemDetailed");
    
    XLSX.writeFile(workbook, `Linga_Analytics_${selectedStoreName}.xlsx`);
};

export const exportAnalysisToExcel = (analysisData: any[], dimension: string, storeName: string) => {
    const data = analysisData.map(item => ({
        [dimension]: item.name,
        'Quantity': item.count,
        'Value': parseNum(item.value)
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, dimension);
    XLSX.writeFile(wb, `${dimension}_Report_${storeName}.xlsx`);
};
