
export const parseCurrency = (val: string | undefined | number): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    // Replace dollar sign, commas, and whitespace
    const clean = String(val).replace(/[$,\s]/g, '');
    return parseFloat(clean) || 0;
};

export const formatAED = (num: number) => {
  // Use 2 decimal places to match exactly with Linga report precision
  return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' AED';
};
