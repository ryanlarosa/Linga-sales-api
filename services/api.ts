import { API_KEY, USE_MOCK_DATA, API_BASE_URL, BACKEND_URL } from '../constants';
import { FetchedData, SaleOrder, Floor, StoreUser, MenuItemDetail, SaleSummary, DiscountDetail } from '../types';

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// --- SIMULATED BACKEND ENGINE ---
class SimulatedBackend {
  private users: StoreUser[] = [
    { id: 'u1', name: 'Sarah Jenkins' },
    { id: 'u2', name: 'Mike Ross' },
    { id: 'u3', name: 'Jessica Pearson' },
    { id: 'u4', name: 'Harvey Specter' }
  ];

  private floors: Floor[] = [
    { id: 'f1', floorName: 'Main Dining Room' },
    { id: 'f2', floorName: 'Patio' },
    { id: 'f3', floorName: 'Bar Area' },
    { id: 'f4', floorName: 'Rooftop Lounge' }
  ];

  private menuItems = [
    { dept: 'Food', cat: 'Mains', sub: 'Pizza', name: 'Margherita Pizza', price: 18 },
    { dept: 'Food', cat: 'Mains', sub: 'Pasta', name: 'Truffle Pasta', price: 24 },
    { dept: 'Food', cat: 'Starters', sub: 'Salad', name: 'Caesar Salad', price: 14 },
    { dept: 'Beverage', cat: 'Coffee', sub: 'Hot', name: 'Latte', price: 5 },
    { dept: 'Beverage', cat: 'Alcohol', sub: 'Cocktail', name: 'Mojito', price: 12 },
    { dept: 'Food', cat: 'Dessert', sub: 'Cake', name: 'Cheesecake', price: 9 },
    { dept: 'Food', cat: 'Mains', sub: 'Burger', name: 'Wagyu Burger', price: 22 },
    { dept: 'Beverage', cat: 'Soft Drink', sub: 'Cold', name: 'Iced Tea', price: 6 }
  ];

  generateData(storeId: string, fromDate: Date, toDate: Date): FetchedData {
    // Generate data inclusive of the end date
    const end = new Date(toDate);
    end.setHours(23, 59, 59);
    
    const daysDiff = Math.max(1, Math.ceil((end.getTime() - fromDate.getTime()) / (1000 * 3600 * 24)));
    const numOrders = Math.max(daysDiff * 15, 8); // Minimum 8 orders to show charts

    const sales: SaleOrder[] = [];
    const detailedMenu: MenuItemDetail[] = [];
    const saleSummary: SaleSummary[] = [];
    const saleDetails: DiscountDetail[] = [];

    let totalGross = 0;

    for (let i = 0; i < numOrders; i++) {
      const saleId = `TCK-${10000 + i}`;
      // Randomize time within the date range
      const randomDayOffset = Math.floor(Math.random() * daysDiff);
      const date = new Date(fromDate.getTime() + (randomDayOffset * 24 * 60 * 60 * 1000));
      
      // Set realistic hours (11am - 11pm)
      const hour = 11 + Math.floor(Math.random() * 12); 
      date.setHours(hour, Math.floor(Math.random() * 60));

      // Determine items in order
      const itemCount = Math.floor(Math.random() * 5) + 1;
      let saleGross = 0;
      
      const orderItems: MenuItemDetail[] = [];

      for(let k=0; k<itemCount; k++) {
        const itemTemplate = this.menuItems[Math.floor(Math.random() * this.menuItems.length)];
        const itemPrice = itemTemplate.price;
        
        const detailItem: MenuItemDetail = {
          saleId: saleId,
          saleDate: date.toISOString(),
          orderHour: date.getHours().toString(),
          orderMin: date.getMinutes().toString(),
          departmentName: itemTemplate.dept,
          categoryName: itemTemplate.cat,
          subCategoryName: itemTemplate.sub,
          quantity: 1,
          menuName: itemTemplate.name,
          grossAmountStr: itemPrice.toFixed(2),
          totalGrossAmountStr: itemPrice.toFixed(2),
          totalDiscountAmountStr: '0.00',
          isVoid: 'false',
          voidError: '',
          voidByEmployee: ''
        };
        
        detailedMenu.push(detailItem);
        orderItems.push(detailItem);
        saleGross += itemPrice;
      }

      const tax = saleGross * 0.05;
      const hasDiscount = Math.random() > 0.85;
      const discount = hasDiscount ? (saleGross * 0.1) : 0;
      const net = saleGross - discount;

      totalGross += saleGross;

      const employee = this.users[Math.floor(Math.random() * this.users.length)];

      const sale: SaleOrder = {
        id: saleId,
        ticketNo: saleId,
        startDate: date.toISOString(),
        saleOpenTime: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        customerName: Math.random() > 0.7 ? `Walk-in Guest` : `Table ${Math.floor(Math.random() * 20) + 1}`,
        tableNo: `${Math.floor(Math.random() * 30) + 1}`,
        floorId: this.floors[Math.floor(Math.random() * this.floors.length)].id,
        employee: employee.id,
        saleCloseEmployee: employee.id,
        guestCount: Math.floor(Math.random() * 4) + 1,
        netSalesStr: net.toFixed(2),
        grossAmountStr: saleGross.toFixed(2),
        totalTaxAmountStr: tax.toFixed(2),
        grossReceiptStr: (net + tax).toFixed(2),
        orders: orderItems,
      };
      sales.push(sale);

      saleSummary.push({
        id: saleId,
        netSales: net.toFixed(2),
        discounts: discount.toFixed(2),
        totalTaxAmount: tax.toFixed(2),
        saleOpenDate: date.toISOString()
      });
    }

    // Sort by date desc
    sales.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    return {
      sales,
      saleDetails,
      floors: this.floors,
      users: this.users,
      menus: [],
      detailedMenu,
      saleSummary,
      totalGrossAmount: totalGross.toFixed(2),
      isSimulated: true
    };
  }
}

const backend = new SimulatedBackend();

// Helper to fetch using the Vercel Backend
async function fetchFromBackend(endpoint: string): Promise<any> {
  console.log(`Fetching via Vercel Proxy: ${endpoint}`);
  
  // Use relative path so it works automatically on deployment
  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      endpoint: endpoint,
      method: 'GET'
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Backend Error (${response.status}): ${errorBody}`);
  }

  return await response.json();
}

export const fetchDashboardData = async (storeId: string, from: Date, to: Date, forceMock: boolean = false): Promise<FetchedData> => {
  if (USE_MOCK_DATA || forceMock) {
    await new Promise(resolve => setTimeout(resolve, 600)); 
    return backend.generateData(storeId, from, to);
  }

  try {
    const formattedFrom = formatDate(from);
    const formattedTo = formatDate(to);
    
    const endpoints = [
      `/v1/lingapos/store/${storeId}/getsale?fromDate=${formattedFrom}&toDate=${formattedTo}`,
      `/v1/lingapos/store/${storeId}/discountReport?dateOption=DR&fromDate=${formattedFrom}&toDate=${formattedTo}&selectedReportType=By Discount Type`,
      `/v1/lingapos/store/${storeId}/layout`,
      `/v1/lingapos/store/${storeId}/users`,
      `/v1/lingapos/store/${storeId}/saleReport?dateOption=DR&employeeGroup=N&${formattedFrom}&toDate=${formattedTo}&isDetailedView=false&numberOfDay=&page=1&reportType=&selectedEmployee=&selectedItemId=&specificDate=&type=MENUITEM`,
      `/v1/lingapos/store/${storeId}/saleSummaryReport?dateOption=DR&fromDate=${formattedFrom}&toDate=${formattedTo}`,
    ];

    // Always try the backend first
    const responses = await Promise.all(endpoints.map(ep => fetchFromBackend(ep)));

    const [salesData, discountData, floorData, userData, menuData, saleSummaryData] = responses;

    // Data Processing Logic
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
    console.warn("Fetch failed, reverting to simulation:", err);
    // Auto-fallback to simulation if the backend fails or is unreachable
    const mockData = backend.generateData(storeId, from, to);
    return { ...mockData, isSimulated: true };
  }
};