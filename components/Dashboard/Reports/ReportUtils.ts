
export const parseCurrency = (val: string | undefined | number): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[$,\s]/g, '');
    return parseFloat(clean) || 0;
};

export const formatAED = (num: number) => {
  return num.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' AED';
};
