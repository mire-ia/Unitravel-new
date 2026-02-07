
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatPercentage = (value: number): string => {
  return `${formatNumber(value)}%`;
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export const dateToYyyyMmDd = (date: Date): string => {
    return date.toISOString().split('T')[0];
}

export const yyyyMmDdToDate = (dateString: string): Date => {
    if (!dateString) return new Date(2000, 0, 1);
    
    const s = dateString.toString().trim();
    
    // Formato DD-MM-YYYY o DD/MM/YYYY (europeo)
    const euMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (euMatch) {
        const d = new Date(Number(euMatch[3]), Number(euMatch[2]) - 1, Number(euMatch[1]));
        if (!isNaN(d.getTime())) return d;
    }
    
    // Formato YYYY-MM-DD o YYYY/MM/DD (ISO)
    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
        const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
        if (!isNaN(d.getTime())) return d;
    }
    
    // Intentar parseo nativo como último recurso
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    
    return new Date(2000, 0, 1);
}
