import * as XLSX from "xlsx";
import { FetchedData } from "../types";

// Helper: Convert string values (e.g. "$1,234.50") to actual numbers (1234.50)
const parseNum = (val: string | number | undefined | null): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Remove '$', ',' and whitespace
  const strVal = String(val).replace(/[$,\s]/g, ''); 
  const num = parseFloat(strVal);
  return isNaN(num) ? 0 : num;
};

export const exportToExcel = (data: FetchedData, storeName: string) => {
    if (!data || !data.sales || data.sales.length === 0) {
      throw new Error("No Data to Export");
    }

    const selectedStoreName = storeName || "Unknown Store";

    // 1. Sales Data Sheet
    const extractedData1 = data.sales.map((item) => {
      const saleDate = new Date(item.startDate);
      const day = String(saleDate.getDate()).padStart(2, "0");
      const month = String(saleDate.getMonth() + 1).padStart(2, "0");
      const year = saleDate.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;
      
      const floorName = data.floors.find((floor) => floor.id === item.floorId)?.floorName || "Unknown";
      const createdBy = data.users.find((user) => user.id === item.employee)?.name || "Unknown";
      const closedBy = data.users.find((user) => user.id === item.saleCloseEmployee)?.name || "Unknown";
      
      const summary = data.saleSummary.find((sales) => sales.id === item.id);

      return {
        Store: selectedStoreName,
        Ticket_No: item.ticketNo,
        Customer_Name: item.customerName,
        Sale_Open_Time: item.saleOpenTime,
        Floor: floorName,
        Table_No: item.tableNo,
        // Convert these fields to numbers
        Net_Sales: parseNum(summary?.netSales),
        Total_Tax: parseNum(summary?.totalTaxAmount),
        Discount: parseNum(summary?.discounts),
        Gross_Receipt: parseNum(item.grossReceiptStr),
        Closed_By: closedBy,
        Server_Name: createdBy,
        Guest_Count: parseNum(item.guestCount),
        Final_SaleDate: formattedDate,
      };
    });

    // 2. Discount Data Sheet
    const filteredDiscountData = data.saleDetails.filter((item) => item.check !== "Total");
    const extractedData2 = filteredDiscountData.map((item) => {
      return {
        Store: selectedStoreName,
        Approved_By: item.approvedBy,
        Check: item.check,
        Date: item.date,
        // Convert these fields to numbers
        Discount_Amount: parseNum(item.discountAmtStr),
        Discount_Applied_By: item.discountAppliedBy,
        Discount_Coupon: item.discountCoupon,
        Discount_Name: item.discountName,
        Discount_Type: item.discountType,
        Gross_Sales: parseNum(item.grossSalesStr),
        Is_Total: item.isTotal,
        Menu_Items: item.menuItems,
        Percent: parseNum(item.percent),
        Quantity: parseNum(item.quantity),
        Reason: item.reason,
        Total_Discounts: parseNum(item.totalDiscounts),
      };
    });

    // 3. Menu Item Detailed Sheet
    const extractedData3 = data.detailedMenu.map((item) => {
      const saleDate = new Date(item.saleDate);
      const day = String(saleDate.getDate()).padStart(2, "0");
      const month = String(saleDate.getMonth() + 1).padStart(2, "0");
      const year = saleDate.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;
      const orderMin = String(item.orderMin).padStart(2, "0");

      const voidBy = data.users.find((user) => user.id === item.voidByEmployee)?.name || "Unknown";
      const discountName = data.saleDetails.find(
          (discount) => discount.check === item.saleId && item.totalDiscountAmountStr !== "0.00"
        )?.discountName || "N/A";

      return {
        Store: selectedStoreName,
        Order_Date: formattedDate,
        Order_Hour: `${item.orderHour}:${orderMin}`,
        Ticket_No: item.saleId,
        Department: item.departmentName,
        CategoryName: item.categoryName,
        SubCategoryName: item.subCategoryName,
        // Convert these fields to numbers
        Quantity: parseNum(item.quantity),
        Menu_Item: item.menuName,
        Gross_Amount_w_VAT: parseNum(item.grossAmountStr),
        Total_Amount_w_VAT: parseNum(item.totalGrossAmountStr),
        Discount_w_VAT: parseNum(item.totalDiscountAmountStr),
        DiscountName: discountName,
        Is_Void: item.isVoid,
        Void_Reason: item.voidError,
        VoidedBy: voidBy,
      };
    });

    const worksheet1 = XLSX.utils.json_to_sheet(extractedData1);
    const worksheet2 = XLSX.utils.json_to_sheet(extractedData2);
    const worksheet3 = XLSX.utils.json_to_sheet(extractedData3);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet1, "SalesData");
    XLSX.utils.book_append_sheet(workbook, worksheet2, "DiscountData");
    XLSX.utils.book_append_sheet(workbook, worksheet3, "MenuItemDetailed");
    XLSX.writeFile(workbook, `SalesData_${selectedStoreName}.xlsx`);
};