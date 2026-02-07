import React, { useState, useMemo, useEffect } from 'react';
import Card from '../components/Card';
import { Vehicle, YearlyIncomeData, CostClassificationItem, AmortizationAccount } from '../types';
import { yyyyMmDdToDate, formatCurrency, formatNumber, formatPercentage } from '../lib/utils';
import { Search, Loader2, HelpCircle } from 'lucide-react';
import { vehiclesApi, yearlyIncomesApi, costClassificationsApi, amortizationApi, financialDataApi } from '../lib/googleSheetsApi';

// Componente Tooltip para mostrar fórmulas
const Tooltip: React.FC<{ text: string; formula: string }> = ({ text, formula }) => (
    <span className="group relative cursor-help inline-flex items-center gap-1">
        {text}
        <HelpCircle size={14} className="text-gray-400 group-hover:text-primary" />
        <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-[100] pointer-events-none">
            <span className="block font-semibold text-yellow-300 mb-1">Fórmula:</span>
            {formula}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></span>
        </span>
    </span>
);

const VehicleAnalysis: React.FC = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [incomeData, setIncomeData] = useState<YearlyIncomeData[]>([]);
    const [classifications, setClassifications] = useState<CostClassificationItem[]>([]);
    const [financialData, setFinancialData] = useState<any[]>([]);
    const [amortizationAccounts, setAmortizationAccounts] = useState<AmortizationAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        const fetchAllData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [vehiclesRes, incomeRes, classificationsRes, financialRes, amortizationRes] = await Promise.all([
                    vehiclesApi.list(),
                    yearlyIncomesApi.list(),
                    costClassificationsApi.list(),
                    financialDataApi.list(),
                    amortizationApi.list()
                ]);

                if (vehiclesRes.error) throw new Error(`Vehículos: ${vehiclesRes.error}`);
                if (incomeRes.error) throw new Error(`Ingresos: ${incomeRes.error}`);
                if (classificationsRes.error) throw new Error(`Clasificaciones: ${classificationsRes.error}`);
                if (financialRes.error) throw new Error(`Datos financieros: ${financialRes.error}`);
                if (amortizationRes.error) throw new Error(`Amortizaciones: ${amortizationRes.error}`);
                
                setVehicles(vehiclesRes.data || []);
                setIncomeData(incomeRes.data || []);
                setClassifications(classificationsRes.data || []);
                setFinancialData(financialRes.data || []);
                setAmortizationAccounts(amortizationRes.data || []);

            } catch (err: any) {
                setError("Error al cargar los datos para el análisis: " + err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAllData();
    }, []);

    // Función para extraer código de cuenta
    const extractAccountCode = (concept: string): string => {
        if (!concept) return '';
        const match = concept.match(/^(\d{8,})/);
        return match ? match[1] : '';
    };

    // Función para buscar clasificación de una cuenta
    const findClassification = (concept: string) => {
        const code = extractAccountCode(concept);
        for (const classification of classifications) {
            const classCode = extractAccountCode(classification.costType);
            if (classCode && code && classCode === code) return classification;
            if (classification.costType && code && classification.costType.includes(code)) return classification;
        }
        return null;
    };

    // Función para verificar si es cuenta contable real
    const isAccountCode = (concept: string): boolean => {
        if (!concept || typeof concept !== 'string') return false;
        return /^\d{8,}/.test(concept.trim());
    };

    // Función para parsear amount de forma robusta (soporta formato europeo e.g. "1.234.567,89")
    const parseAmount = (value: any): number => {
        if (typeof value === 'number') return value;
        if (!value || typeof value !== 'string') return 0;
        const cleaned = value.trim();
        if (/^\-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
            return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
        }
        return Number(cleaned) || 0;
    };

    // Cruzar FinancialData (PyG) con CostClassifications
    const costsWithClassification = useMemo(() => {
        // Solo cuentas contables reales y solo gastos (importe negativo)
        const allPygData = financialData.filter(d => 
            d.documentType === 'PyG' && 
            isAccountCode(d.concept) && 
            parseAmount(d.amount) < 0
        );

        // Dedup: preferir month=0 (anual) sobre mensuales para evitar duplicación
        const yearMonths: Record<number, Set<number>> = {};
        allPygData.forEach(d => {
            const year = Number(d.year);
            if (!yearMonths[year]) yearMonths[year] = new Set();
            yearMonths[year].add(Number(d.month) || 0);
        });

        const pygData = allPygData.filter(d => {
            const year = Number(d.year);
            const month = Number(d.month) || 0;
            const hasAnnual = yearMonths[year]?.has(0);
            if (hasAnnual) return month === 0;
            return month >= 1 && month <= 12;
        });

        return pygData.map(item => {
            const classification = findClassification(item.concept);
            const amount = Math.abs(parseAmount(item.amount));
            return {
                year: Number(item.year),
                concept: item.concept,
                amount,
                costCenter: classification?.costCenter || 'INDIRECTO',
                nature: classification?.nature || 'FIJO',
                distribution: classification?.distribution || 'General'
            };
        });
    }, [financialData, classifications]);

    const availableYears = useMemo(() => {
        const yearsFromIncome = incomeData.map(d => d.year);
        const yearsFromFinancial = financialData.filter(d => d.documentType === 'PyG').map(d => Number(d.year));
        const years = new Set([selectedYear, ...yearsFromIncome, ...yearsFromFinancial]);
        return Array.from(years).filter(y => y > 2000).sort((a, b) => b - a);
    }, [incomeData, financialData, selectedYear]);

    const analysisData = useMemo(() => {
        if (isLoading || error) return null;

        const yearlyIncome = incomeData.find(d => d.year === selectedYear);
        
        // Filtrar costes del año seleccionado
        const yearCosts = costsWithClassification.filter(c => c.year === selectedYear);
        
        const activeVehicles = vehicles.map(v => {
            const yearStart = new Date(selectedYear, 0, 1);
            const yearEnd = new Date(selectedYear, 11, 31);
            const acqDate = yyyyMmDdToDate(v.acquisitionDate);
            const slDate = v.saleDate ? yyyyMmDdToDate(v.saleDate) : null;
            if (acqDate > yearEnd || (slDate && slDate < yearStart)) return null;

            const startDate = acqDate > yearStart ? acqDate : yearStart;
            const endDate = slDate && slDate < yearEnd ? slDate : yearEnd;
            let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth();
            const annualCoefficient = (months <= 0 ? 1 : months + 1) / 12;

            const annualKms = v.annualKms[selectedYear] || 0;
            
            // Buscar ingresos del vehículo en MonthlyIncome
            const vehicleIncomeData = yearlyIncome?.ownFleet?.find((i: any) => {
                // Normalizar matrículas: quitar espacios, convertir a mayúsculas
                const normalize = (s: any) => (s || '').toString().toUpperCase().replace(/\s+/g, '').trim();
                
                const vPlate = normalize(v.licensePlate);
                const iPlate = normalize(i.licensePlate);
                const iVehicleId = normalize(i.vehicleId);
                const iId = normalize(i.id);
                
                return (iPlate && vPlate && iPlate === vPlate) ||
                       (iVehicleId && vPlate && iVehicleId === vPlate) ||
                       (iId && vPlate && iId === vPlate);
            });
            
            // Sumar todos los meses de ingresos
            const income = vehicleIncomeData 
                ? Object.values(vehicleIncomeData.income || {}).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0)
                : 0;

            return { ...v, annualCoefficient, annualKms, income };
        }).filter((v): v is NonNullable<typeof v> => v !== null);

        if (activeVehicles.length === 0) return { vehicleMetrics: [], fleetTotals: {} };

        const totalKms = activeVehicles.reduce((sum: number, v) => sum + v.annualKms, 0);
        const totalCoefficients = activeVehicles.reduce((sum: number, v) => sum + v.annualCoefficient, 0);

        // Calcular costes desde FinancialData cruzado con clasificaciones
        const directFixedCosts = yearCosts.filter(c => c.costCenter === 'DIRECTO' && c.nature === 'FIJO').reduce((sum, c) => sum + c.amount, 0);
        const directVariableCosts = yearCosts.filter(c => c.costCenter === 'DIRECTO' && c.nature === 'VARIABLE').reduce((sum, c) => sum + c.amount, 0);
        const indirectFixedCosts = yearCosts.filter(c => c.costCenter === 'INDIRECTO' && c.nature === 'FIJO').reduce((sum, c) => sum + c.amount, 0);
        const indirectVariableCosts = yearCosts.filter(c => c.costCenter === 'INDIRECTO' && c.nature === 'VARIABLE').reduce((sum, c) => sum + c.amount, 0);

        const intangibleAmort = amortizationAccounts.filter(a => a.name.toLowerCase().includes('software') || a.name.toLowerCase().includes('licencia')).reduce((sum: number, a) => sum + (a.annualValues[selectedYear] || 0), 0);
        const tangibleAmort = amortizationAccounts.filter(a => !a.name.toLowerCase().includes('flota') && !a.name.toLowerCase().includes('software') && !a.name.toLowerCase().includes('licencia')).reduce((sum: number, a) => sum + (a.annualValues[selectedYear] || 0), 0);

        const vehicleMetrics = activeVehicles.map(v => {
            // Costes imputados directamente a este vehículo
            const directFixed = yearCosts.filter(c => c.distribution === v.licensePlate && c.nature === 'FIJO').reduce((s, c) => s + c.amount, 0);
            const directVariable = yearCosts.filter(c => c.distribution === v.licensePlate && c.nature === 'VARIABLE').reduce((s, c) => s + c.amount, 0);
            
            // Reparto de costes directos generales (no imputados a vehículo específico)
            const generalDirectFixed = yearCosts.filter(c => c.costCenter === 'DIRECTO' && c.nature === 'FIJO' && c.distribution === 'General').reduce((s, c) => s + c.amount, 0);
            const generalDirectVariable = yearCosts.filter(c => c.costCenter === 'DIRECTO' && c.nature === 'VARIABLE' && c.distribution === 'General').reduce((s, c) => s + c.amount, 0);
            
            const directFixedShare = totalCoefficients > 0 ? (generalDirectFixed / totalCoefficients) * v.annualCoefficient : 0;
            const directVariableShare = totalKms > 0 ? (generalDirectVariable / totalKms) * v.annualKms : 0;
            
            const indirectFixedShare = totalCoefficients > 0 ? (indirectFixedCosts / totalCoefficients) * v.annualCoefficient : 0;
            const indirectVariableShare = totalKms > 0 ? (indirectVariableCosts / totalKms) * v.annualKms : 0;

            const totalImputedCosts = directFixed + directVariable + directFixedShare + directVariableShare + indirectFixedShare + indirectVariableShare;
            
            const intangibleAmortShare = totalCoefficients > 0 ? (intangibleAmort / totalCoefficients) * v.annualCoefficient : 0;
            const tangibleAmortShare = totalCoefficients > 0 ? (tangibleAmort / totalCoefficients) * v.annualCoefficient : 0;
            const vehicleAmortization = v.annualAmortization * v.annualCoefficient;

            const totalCosts = totalImputedCosts + intangibleAmortShare + tangibleAmortShare + vehicleAmortization;
            const result = v.income - totalCosts;

            const totalVariableCosts = directVariable + directVariableShare + indirectVariableShare;
            const totalFixedCosts = directFixed + directFixedShare + indirectFixedShare + intangibleAmortShare + tangibleAmortShare + vehicleAmortization;
            const breakEvenPoint = v.income > 0 ? totalFixedCosts / (1 - (totalVariableCosts / v.income)) : 0;
            const costPerKmFixed = v.annualKms > 0 ? totalFixedCosts / v.annualKms : 0;
            const costPerKmVariable = v.annualKms > 0 ? totalVariableCosts / v.annualKms : 0;


            return {
                ...v,
                directFixed, directVariable, directFixedShare, directVariableShare,
                indirectFixedShare, indirectVariableShare,
                totalImputedCosts, intangibleAmortShare, tangibleAmortShare, vehicleAmortization,
                totalCosts, result, totalVariableCosts, totalFixedCosts, breakEvenPoint, costPerKmFixed, costPerKmVariable
            };
        });

        const fleetTotals = vehicleMetrics.reduce((totals, v) => {
             Object.keys(v).forEach(key => {
                if (typeof v[key as keyof typeof v] === 'number') {
                    totals[key as keyof typeof totals] = (totals[key as keyof typeof totals] || 0) + (v[key as keyof typeof v] as number);
                }
             });
             return totals;
        }, {} as any);

        return { vehicleMetrics, fleetTotals };
    }, [selectedYear, vehicles, incomeData, costsWithClassification, amortizationAccounts, isLoading, error]);

    // Componente de tarjeta de vehículo
    const VehicleCard: React.FC<{ v: any }> = ({ v }) => {
        const isProfit = v.result >= 0;
        return (
            <div className="bg-white rounded-xl shadow-md border overflow-hidden">
                {/* Header */}
                <div className="bg-secondary text-white p-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <span className="text-sm opacity-75">#{v.assignedNumber}</span>
                            <h3 className="text-xl font-bold">{v.licensePlate}</h3>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${isProfit ? 'bg-green-500' : 'bg-red-500'}`}>
                            {isProfit ? '✓ Rentable' : '✗ Pérdidas'}
                        </div>
                    </div>
                </div>
                
                {/* Coeficientes */}
                <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 border-b">
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase">Coef. Tiempo</p>
                        <p className="text-lg font-bold text-primary">{v.annualCoefficient.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{Math.round(v.annualCoefficient * 12)}/12 meses</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase">Coef. Km</p>
                        <p className="text-lg font-bold text-primary">
                            {analysisData && analysisData.fleetTotals.annualKms > 0 
                                ? (v.annualKms / analysisData.fleetTotals.annualKms).toFixed(3) 
                                : '0.000'}
                        </p>
                        <p className="text-xs text-gray-400">{formatNumber(v.annualKms)} km</p>
                    </div>
                </div>

                {/* Costes */}
                <div className="p-4 space-y-3">
                    {/* Costes Directos */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Costes Directos</p>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">├ Fijos <span className="text-xs text-gray-400">(× Coef.T)</span></span>
                            <span className="font-medium">{formatCurrency(v.directFixed + v.directFixedShare)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">└ Variables <span className="text-xs text-gray-400">(× Coef.Km)</span></span>
                            <span className="font-medium">{formatCurrency(v.directVariable + v.directVariableShare)}</span>
                        </div>
                    </div>

                    {/* Costes Indirectos */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Costes Indirectos</p>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">├ Fijos <span className="text-xs text-gray-400">(× Coef.T)</span></span>
                            <span className="font-medium">{formatCurrency(v.indirectFixedShare)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">└ Variables <span className="text-xs text-gray-400">(× Coef.Km)</span></span>
                            <span className="font-medium">{formatCurrency(v.indirectVariableShare)}</span>
                        </div>
                    </div>

                    {/* Amortizaciones */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Amortizaciones</p>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">├ Vehículo</span>
                            <span className="font-medium">{formatCurrency(v.vehicleAmortization)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">├ Intangible</span>
                            <span className="font-medium">{formatCurrency(v.intangibleAmortShare)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">└ Tangible</span>
                            <span className="font-medium">{formatCurrency(v.tangibleAmortShare)}</span>
                        </div>
                    </div>
                </div>

                {/* Resumen */}
                <div className="border-t bg-gray-50 p-4 space-y-2">
                    <div className="flex justify-between font-semibold">
                        <span>Total Costes</span>
                        <span className="text-gray-800">{formatCurrency(v.totalCosts)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                        <span>Ingresos <span className="text-xs font-normal text-gray-400">(MonthlyIncome)</span></span>
                        <span className="text-blue-600">{formatCurrency(v.income)}</span>
                    </div>
                    <div className={`flex justify-between font-bold text-lg pt-2 border-t ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                        <span>Beneficio</span>
                        <span>{formatCurrency(v.result)}</span>
                    </div>
                </div>

                {/* Métricas adicionales */}
                <div className="grid grid-cols-2 gap-px bg-gray-200">
                    <div className="bg-white p-3 text-center">
                        <p className="text-xs text-gray-500">Coste/Km</p>
                        <p className="font-bold text-primary">{formatCurrency(v.costPerKmFixed + v.costPerKmVariable)}</p>
                    </div>
                    <div className="bg-white p-3 text-center">
                        <p className="text-xs text-gray-500">Umbral Rentab.</p>
                        <p className="font-bold text-primary">{formatCurrency(v.breakEvenPoint)}</p>
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) return <div className="flex justify-center items-center py-12"><Loader2 className="animate-spin mr-2" /> Cargando datos para análisis...</div>
    if (error) return <div className="text-red-600 text-center py-12">{error}</div>

    return (
        <div className="space-y-6">
            {/* Header con selector de año */}
            <Card>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-secondary">Análisis por Vehículo</h2>
                    <div className="flex items-center gap-2">
                        <label className="font-medium text-gray-600">Año:</label>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))} 
                            className="p-2 border rounded-md bg-white"
                        >
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </Card>

            {!analysisData || analysisData.vehicleMetrics.length === 0 ? (
                <Card>
                    <div className="text-center py-12">
                        <Search size={48} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No hay datos para el año {selectedYear}</h3>
                        <p className="text-gray-500">Selecciona otro año o importa datos de PyG.</p>
                    </div>
                </Card>
            ) : (
                <>
                    {/* Resumen de flota */}
                    <Card title="Resumen de Flota">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <div className="bg-blue-50 rounded-lg p-4 text-center">
                                <p className="text-sm text-blue-600 font-medium">Vehículos</p>
                                <p className="text-2xl font-bold text-blue-800">{analysisData.vehicleMetrics.length}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 text-center">
                                <p className="text-sm text-gray-600 font-medium">Km Totales</p>
                                <p className="text-2xl font-bold text-gray-800">{formatNumber(analysisData.fleetTotals.annualKms || 0)}</p>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-4 text-center">
                                <p className="text-sm text-orange-600 font-medium">Costes Totales</p>
                                <p className="text-2xl font-bold text-orange-800">{formatCurrency(analysisData.fleetTotals.totalCosts || 0)}</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-4 text-center">
                                <p className="text-sm text-blue-600 font-medium">Ingresos Totales</p>
                                <p className="text-2xl font-bold text-blue-800">{formatCurrency(analysisData.fleetTotals.income || 0)}</p>
                            </div>
                            <div className={`rounded-lg p-4 text-center ${(analysisData.fleetTotals.result || 0) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                                <p className={`text-sm font-medium ${(analysisData.fleetTotals.result || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>Beneficio Total</p>
                                <p className={`text-2xl font-bold ${(analysisData.fleetTotals.result || 0) >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                                    {formatCurrency(analysisData.fleetTotals.result || 0)}
                                </p>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-4 text-center">
                                <p className="text-sm text-purple-600 font-medium">Coste/Km Medio</p>
                                <p className="text-2xl font-bold text-purple-800">
                                    {analysisData.fleetTotals.annualKms > 0 
                                        ? formatCurrency((analysisData.fleetTotals.totalCosts || 0) / analysisData.fleetTotals.annualKms)
                                        : '0,00 €'}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Grid de tarjetas de vehículos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {analysisData.vehicleMetrics.map((v, i) => (
                            <VehicleCard key={i} v={v} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default VehicleAnalysis;