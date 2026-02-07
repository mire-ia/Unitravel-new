/**
 * Cliente API para Google Sheets
 * Reemplaza a Supabase como backend
 */

// URL de la API de Google Apps Script
// En producción, usar variable de entorno: import.meta.env.VITE_API_URL
const API_URL = 'https://script.google.com/macros/s/AKfycbyIjiiEeoizdLl967qRUCIQENVirSDgdiyMXs2PSPtOa7k_cPcL09pd2K7li7U9HSmW/exec';

// Tipos de respuesta
interface ApiResponse<T> {
  data?: T;
  error?: string;
  success?: boolean;
  message?: string;
  count?: number;
  headers?: string[];
}

// Cache simple para evitar llamadas repetidas
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 30000; // 30 segundos

function getCached<T>(key: string): T | null {
  const cached = cache[key];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache[key] = { data, timestamp: Date.now() };
}

export function clearCache(sheet?: string): void {
  if (sheet) {
    delete cache[`list_${sheet}`];
  } else {
    Object.keys(cache).forEach(key => delete cache[key]);
  }
}

/**
 * Función base para hacer peticiones a la API
 */
async function apiRequest<T>(
  action: string,
  params: Record<string, string> = {},
  body?: any
): Promise<ApiResponse<T>> {
  try {
    const url = new URL(API_URL);
    url.searchParams.set('action', action);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    const options: RequestInit = {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'text/plain' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    };

    const response = await fetch(url.toString(), options);
    const data = await response.json();
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    return { error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

/**
 * API de Vehículos
 */
export const vehiclesApi = {
  async list() {
    const cacheKey = 'list_Vehicles';
    const cached = getCached<any[]>(cacheKey);
    if (cached) return { data: cached, error: null };

    const response = await apiRequest<any[]>('list', { sheet: 'Vehicles' });
    if (response.data) {
      // Transformar los datos al formato esperado por la app
      const vehicles = response.data.map((v: any) => ({
        id: v.id,
        licensePlate: v.licensePlate,
        assignedNumber: v.assignedNumber,
        acquisitionDate: formatDate(v.acquisitionDate),
        saleDate: v.saleDate ? formatDate(v.saleDate) : undefined,
        acquisitionValue: v.acquisitionValue,
        saleValue: v.saleValue || undefined,
        annualAmortization: v.annualAmortization,
        seats: v.seats,
        wheels: v.wheels,
        type: v.type,
        annualKms: {
          2023: v.kms_2023 || 0,
          2024: v.kms_2024 || 0,
          2025: v.kms_2025 || 0,
          2026: v.kms_2026 || 0,
        }
      }));
      setCache(cacheKey, vehicles);
      return { data: vehicles, error: null };
    }
    return { data: null, error: response.error };
  },

  async upsert(vehicle: any) {
    clearCache('Vehicles');
    // Transformar al formato de la hoja
    const sheetData = {
      id: vehicle.id || vehicle.licensePlate,
      licensePlate: vehicle.licensePlate,
      assignedNumber: vehicle.assignedNumber,
      acquisitionDate: vehicle.acquisitionDate,
      saleDate: vehicle.saleDate || '',
      acquisitionValue: vehicle.acquisitionValue,
      saleValue: vehicle.saleValue || '',
      annualAmortization: vehicle.annualAmortization,
      seats: vehicle.seats,
      wheels: vehicle.wheels,
      type: vehicle.type,
      kms_2023: vehicle.annualKms?.[2023] || 0,
      kms_2024: vehicle.annualKms?.[2024] || 0,
      kms_2025: vehicle.annualKms?.[2025] || 0,
      kms_2026: vehicle.annualKms?.[2026] || 0,
    };
    return apiRequest('upsert', { sheet: 'Vehicles' }, sheetData);
  },

  async update(id: string, data: any) {
    clearCache('Vehicles');
    const updateData: any = { ...data };
    // Si se actualizan los kms, transformar
    if (data.annual_kms || data.annualKms) {
      const kms = data.annual_kms || data.annualKms;
      updateData.kms_2023 = kms[2023] || 0;
      updateData.kms_2024 = kms[2024] || 0;
      updateData.kms_2025 = kms[2025] || 0;
      updateData.kms_2026 = kms[2026] || 0;
      delete updateData.annual_kms;
      delete updateData.annualKms;
    }
    return apiRequest('update', { sheet: 'Vehicles', id }, updateData);
  },

  async delete(id: string) {
    clearCache('Vehicles');
    return apiRequest('delete', { sheet: 'Vehicles', id });
  }
};

/**
 * API de Clasificación de Costes
 */
export const costClassificationsApi = {
  async list() {
    const cacheKey = 'list_CostClassifications';
    const cached = getCached<any[]>(cacheKey);
    if (cached) return { data: cached, error: null };

    const response = await apiRequest<any[]>('list', { sheet: 'CostClassifications' });
    if (response.data) {
      setCache(cacheKey, response.data);
      return { data: response.data, error: null };
    }
    return { data: null, error: response.error };
  },

  async insert(data: any) {
    clearCache('CostClassifications');
    return apiRequest('create', { sheet: 'CostClassifications' }, data);
  },

  async update(id: number, field: string, value: any) {
    clearCache('CostClassifications');
    return apiRequest('update', { sheet: 'CostClassifications', id: id.toString() }, { [field]: value });
  },

  async upsert(data: any) {
    clearCache('CostClassifications');
    return apiRequest('upsert', { sheet: 'CostClassifications' }, data);
  },

  async delete(id: number) {
    clearCache('CostClassifications');
    return apiRequest('delete', { sheet: 'CostClassifications', id: id.toString() });
  }
};

/**
 * API de Amortizaciones
 */
export const amortizationApi = {
  async list() {
    const cacheKey = 'list_AmortizationAccounts';
    const cached = getCached<any[]>(cacheKey);
    if (cached) return { data: cached, error: null };

    const response = await apiRequest<any[]>('list', { sheet: 'AmortizationAccounts' });
    if (response.data) {
      // Transformar al formato esperado
      const accounts = response.data.map((a: any) => ({
        id: a.id,
        name: a.name,
        totalValue: a.totalValue,
        startDate: formatDate(a.startDate),
        endDate: a.endDate ? formatDate(a.endDate) : undefined,
        annualAmount: a.annualAmount,
        annualValues: {
          2023: a.value_2023 || 0,
          2024: a.value_2024 || 0,
          2025: a.value_2025 || 0,
          2026: a.value_2026 || 0,
        }
      }));
      setCache(cacheKey, accounts);
      return { data: accounts, error: null };
    }
    return { data: null, error: response.error };
  },

  async upsert(account: any) {
    clearCache('AmortizationAccounts');
    const sheetData = {
      id: account.id,
      name: account.name,
      totalValue: account.totalValue,
      startDate: account.startDate,
      endDate: account.endDate || '',
      annualAmount: account.annualAmount,
      value_2023: account.annualValues?.[2023] || 0,
      value_2024: account.annualValues?.[2024] || 0,
      value_2025: account.annualValues?.[2025] || 0,
      value_2026: account.annualValues?.[2026] || 0,
    };
    return apiRequest('upsert', { sheet: 'AmortizationAccounts' }, sheetData);
  },

  async update(id: string, data: any) {
    clearCache('AmortizationAccounts');
    const updateData: any = { ...data };
    if (data.annual_values || data.annualValues) {
      const values = data.annual_values || data.annualValues;
      updateData.value_2023 = values[2023] || 0;
      updateData.value_2024 = values[2024] || 0;
      updateData.value_2025 = values[2025] || 0;
      updateData.value_2026 = values[2026] || 0;
      delete updateData.annual_values;
      delete updateData.annualValues;
    }
    return apiRequest('update', { sheet: 'AmortizationAccounts', id }, updateData);
  }
};

/**
 * API de Ingresos Mensuales
 */
export const yearlyIncomesApi = {
  async list() {
    const cacheKey = 'list_MonthlyIncome';
    const cached = getCached<any[]>(cacheKey);
    if (cached) return { data: cached, error: null };

    const response = await apiRequest<any[]>('list', { sheet: 'MonthlyIncome' });
    if (response.data) {
      // Agrupar por año
      const yearMap: Record<number, any> = {};
      
      response.data.forEach((row: any) => {
        const year = Number(row.year);
        if (!year || year < 2000) return; // Ignorar filas sin año válido
        
        if (!yearMap[year]) {
          yearMap[year] = {
            year,
            ownFleet: [],
            subcontracted: {}
          };
        }
        
        const income = {
          1: Number(row.Ene) || Number(row.ene) || Number(row.enero) || Number(row.Enero) || 0,
          2: Number(row.Feb) || Number(row.feb) || Number(row.febrero) || Number(row.Febrero) || 0,
          3: Number(row.Mar) || Number(row.mar) || Number(row.marzo) || Number(row.Marzo) || 0,
          4: Number(row.Abr) || Number(row.abr) || Number(row.abril) || Number(row.Abril) || 0,
          5: Number(row.May) || Number(row.may) || Number(row.mayo) || Number(row.Mayo) || 0,
          6: Number(row.Jun) || Number(row.jun) || Number(row.junio) || Number(row.Junio) || 0,
          7: Number(row.Jul) || Number(row.jul) || Number(row.julio) || Number(row.Julio) || 0,
          8: Number(row.Ago) || Number(row.ago) || Number(row.agosto) || Number(row.Agosto) || 0,
          9: Number(row.Sep) || Number(row.sep) || Number(row.septiembre) || Number(row.Septiembre) || 0,
          10: Number(row.Oct) || Number(row.oct) || Number(row.octubre) || Number(row.Octubre) || 0,
          11: Number(row.Nov) || Number(row.nov) || Number(row.noviembre) || Number(row.Noviembre) || 0,
          12: Number(row.Dic) || Number(row.dic) || Number(row.diciembre) || Number(row.Diciembre) || 0,
        };
        
        // Detectar tipo con múltiples posibilidades
        const tipo = (row.type || row.tipo || row.Type || row.Tipo || '').toString().toLowerCase().trim();
        const isSubcontratado = tipo === 'subcontratado' || tipo === 'subcontracted' || tipo === 'sub';
        
        if (isSubcontratado) {
          // Sumar los ingresos de todas las filas de subcontratados
          const current = yearMap[year].subcontracted;
          yearMap[year].subcontracted = {
            1: (current[1] || 0) + (income[1] || 0),
            2: (current[2] || 0) + (income[2] || 0),
            3: (current[3] || 0) + (income[3] || 0),
            4: (current[4] || 0) + (income[4] || 0),
            5: (current[5] || 0) + (income[5] || 0),
            6: (current[6] || 0) + (income[6] || 0),
            7: (current[7] || 0) + (income[7] || 0),
            8: (current[8] || 0) + (income[8] || 0),
            9: (current[9] || 0) + (income[9] || 0),
            10: (current[10] || 0) + (income[10] || 0),
            11: (current[11] || 0) + (income[11] || 0),
            12: (current[12] || 0) + (income[12] || 0),
          };
        } else {
          // Capturar todos los posibles identificadores del vehículo
          const vehicleId = row.vehicleId || row.vehicle_id || row.VehicleId || row.matricula || row.Matricula || '';
          const licensePlate = row.licensePlate || row.license_plate || row.LicensePlate || row.matricula || row.Matricula || vehicleId || '';
          
          yearMap[year].ownFleet.push({
            id: vehicleId,
            vehicleId: vehicleId,
            licensePlate: licensePlate,
            assignedNumber: row.assignedNumber || row.numero || row.Numero || '',
            income
          });
        }
      });
      
      const result = Object.values(yearMap);
      setCache(cacheKey, result);
      return { data: result, error: null };
    }
    return { data: null, error: response.error };
  },

  async upsert(yearData: any) {
    clearCache('MonthlyIncome');
    // Este es más complejo porque hay que actualizar múltiples filas
    // Por ahora, actualizar una fila específica
    return apiRequest('upsert', { sheet: 'MonthlyIncome' }, yearData);
  }
};

/**
 * API de Datos Financieros
 */
export const financialDataApi = {
  async list() {
    const cacheKey = 'list_FinancialData';
    const cached = getCached<any[]>(cacheKey);
    if (cached) return { data: cached, error: null };

    const response = await apiRequest<any[]>('list', { sheet: 'FinancialData' });
    if (response.data) {
      setCache(cacheKey, response.data);
      return { data: response.data, error: null };
    }
    return { data: null, error: response.error };
  },

  async upsert(data: any) {
    clearCache('FinancialData');
    return apiRequest('upsert', { sheet: 'FinancialData' }, data);
  }
};

/**
 * API de Configuración
 */
export const configApi = {
  async get() {
    const response = await apiRequest<any>('config');
    return response;
  },
  
  async getGeminiApiKey(): Promise<string | null> {
    const response: any = await apiRequest<any>('config');
    if (response && response.config && response.config.geminiApiKey) {
      return response.config.geminiApiKey;
    }
    return null;
  }
};

// Utilidad para formatear fechas de Google Sheets
function formatDate(dateValue: any): string {
  if (!dateValue) return '';
  
  // Si ya es string en formato YYYY-MM-DD
  if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateValue.split('T')[0];
  }
  
  // Si es formato europeo DD-MM-YYYY o DD/MM/YYYY
  if (typeof dateValue === 'string') {
    const euMatch = dateValue.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (euMatch) {
      const day = euMatch[1].padStart(2, '0');
      const month = euMatch[2].padStart(2, '0');
      return `${euMatch[3]}-${month}-${day}`;
    }
  }
  
  // Si es una fecha ISO de Google Sheets
  if (typeof dateValue === 'string' && dateValue.includes('T')) {
    return dateValue.split('T')[0];
  }
  
  // Si es un número (serial date de Excel/Google Sheets)
  if (typeof dateValue === 'number') {
    const date = new Date((dateValue - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // Devolver tal cual, yyyyMmDdToDate en utils.ts se encargará
  return String(dateValue);
}

// Objeto compatible con la estructura anterior de supabase.from()
export const api = {
  from: (table: string) => {
    switch (table) {
      case 'vehicles':
        return {
          select: () => vehiclesApi.list(),
          upsert: (data: any) => vehiclesApi.upsert(data),
          update: (data: any) => ({
            eq: (field: string, value: any) => vehiclesApi.update(value, data)
          }),
          delete: () => ({
            eq: (field: string, value: any) => vehiclesApi.delete(value)
          })
        };
      case 'cost_classifications':
        return {
          select: () => costClassificationsApi.list(),
          insert: (data: any) => ({
            select: () => costClassificationsApi.insert(data)
          }),
          update: (data: any) => ({
            eq: (field: string, value: any) => costClassificationsApi.update(value, Object.keys(data)[0], Object.values(data)[0])
          }),
          upsert: (data: any) => costClassificationsApi.upsert(data),
          order: () => ({ select: () => costClassificationsApi.list() })
        };
      case 'amortization_accounts':
        return {
          select: () => amortizationApi.list(),
          upsert: (data: any) => amortizationApi.upsert(data),
          update: (data: any) => ({
            eq: (field: string, value: any) => amortizationApi.update(value, data)
          })
        };
      case 'yearly_incomes':
        return {
          select: () => yearlyIncomesApi.list(),
          upsert: (data: any) => yearlyIncomesApi.upsert(data)
        };
      default:
        console.warn(`Tabla no soportada: ${table}`);
        return {
          select: () => Promise.resolve({ data: [], error: 'Tabla no soportada' })
        };
    }
  }
};

export default api;
