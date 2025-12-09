import * as XLSX from "xlsx";
import { FetchedData } from "../types";
import { STORE_LIST } from "../constants";

export const exportToExcel = (data: FetchedData, selectedStoreId: string) => {
    if (!data || !data.sales || data.sales.length === 0) {
      throw new Error("No Data to Export");
    }

    const selectedStoreName = STORE_LIST.find((store) => store.id === selectedStoreId)?.name || "Unknown Store";

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
      const netSales = summary?.netSales || "0.00";
      const discounts = summary?.discounts || "0.00";
      const totalTax = summary?.totalTaxAmount || "0.00";

      return {
        Store: selectedStoreName,
        Ticket_No: item.ticketNo,
        Customer_Name: item.customerName,
        Sale_Open_Time: item.saleOpenTime,
        Floor: floorName,
        Table_No: item.tableNo,
        Net_Sales: netSales,
        Total_Tax: totalTax,
        Discount: discounts,
        Gross_Receipt: item.grossReceiptStr,
        Closed_By: closedBy,
        Server_Name: createdBy,
        Guest_Count: item.guestCount,
        Final_SaleDate: formattedDate,
      };
    });

    const filteredDiscountData = data.saleDetails.filter((item) => item.check !== "Total");
    const extractedData2 = filteredDiscountData.map((item) => {
      return {
        Store: selectedStoreName,
        Approved_By: item.approvedBy,
        Check: item.check,
        Date: item.date,
        Discount_Amount: item.discountAmtStr,
        Discount_Applied_By: item.discountAppliedBy,
        Discount_Coupon: item.discountCoupon,
        Discount_Name: item.discountName,
        Discount_Type: item.discountType,
        Gross_Sales: item.grossSalesStr,
        Is_Total: item.isTotal,
        Menu_Items: item.menuItems,
        Percent: item.percent,
        Quantity: item.quantity,
        Reason: item.reason,
        Total_Discounts: item.totalDiscounts,
      };
    });

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
        Quantity: item.quantity,
        Menu_Item: item.menuName,
        Gross_Amount_w_VAT: item.grossAmountStr,
        Total_Amount_w_VAT: item.totalGrossAmountStr,
        Discount_w_VAT: item.totalDiscountAmountStr,
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