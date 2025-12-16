import { USE_MOCK_DATA } from '../constants';
import { FetchedData, SaleOrder, Floor, StoreUser, MenuItemDetail, SaleSummary } from '../types';

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// --- MOCK DATA FALLBACK ---
// (Simplified mock implementation for offline fallback)
const getMockData = (storeId: string): FetchedData => ({
    sales: [], saleDetails: [], floors: [], users: [], menus: [], detailedMenu: [], saleSummary: [], totalGrossAmount: "0.00", isSimulated: true
});

async function fetchFromBackend(endpoint: string): Promise<any> {
  // We now call the local /api/v1/... routes which Vercel/Express handles
  // These are GET requests, mirroring your working backend reference
  const response = await fetch(`/api${endpoint}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `Server Error (${response.status})`;
    try {
        const json = JSON.parse(errorBody);
        errorMessage = json.message || json.error || errorMessage;
    } catch(e) {}
    throw new Error(errorMessage);
  }

  return await response.json();
}

export const fetchDashboardData = async (storeId: string, from: Date, to: Date, forceMock: boolean = false): Promise<FetchedData> => {
  if (USE_MOCK_DATA || forceMock) {
    await new Promise(resolve => setTimeout(resolve, 800)); 
    return getMockData(storeId);
  }

  try {
    const formattedFrom = formatDate(from);
    const formattedTo = formatDate(to);
    
    // Explicit endpoints mirroring the server.js routes
    // Note: We don't include '/api' here because fetchFromBackend prepends it
    const endpoints = [
      `/v1/lingapos/store/${storeId}/getsale?fromDate=${formattedFrom}&toDate=${formattedTo}`,
      `/v1/lingapos/store/${storeId}/discountReport?dateOption=DR&fromDate=${formattedFrom}&toDate=${formattedTo}&selectedReportType=By Discount Type`,
      `/v1/lingapos/store/${storeId}/layout`,
      `/v1/lingapos/store/${storeId}/users`,
      `/v1/lingapos/store/${storeId}/saleReport?dateOption=DR&employeeGroup=N&fromDate=${formattedFrom}&toDate=${formattedTo}&isDetailedView=false&numberOfDay=&page=1&reportType=&selectedEmployee=&selectedItemId=&specificDate=&type=MENUITEM`,
      `/v1/lingapos/store/${storeId}/saleSummaryReport?dateOption=DR&fromDate=${formattedFrom}&toDate=${formattedTo}`,
    ];

    const responses = await Promise.all(endpoints.map(ep => fetchFromBackend(ep)));
    const [salesData, discountData, floorData, userData, menuData, saleSummaryData] = responses;

    const allOrders: MenuItemDetail[] = [];
    let totalGross = 0;

    if (salesData && salesData.sales) {
        salesData.sales.forEach((sale: any) => {
            if (sale.orders) {
                sale.orders.forEach((order: any) => {
                    allOrders.push({
                    ...order,
                    saleId: sale.ticketNo,
                    saleDate: sale.startDate,
                    });
                    totalGross += parseFloat(order.grossAmountStr || "0");
                });
            }
        });
    }

    return {
      sales: salesData?.sales || [],
      saleDetails: discountData || [],
      floors: floorData?.floors || [],
      users: userData || [],
      menus: menuData?.data || [],
      detailedMenu: allOrders,
      saleSummary: saleSummaryData || [],
      totalGrossAmount: totalGross.toFixed(2),
      isSimulated: false
    };

  } catch (err: any) {
    console.warn("Fetch failed:", err);
    throw err; 
  }
};