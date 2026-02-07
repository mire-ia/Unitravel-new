import React, { useMemo, useState, useEffect } from 'react';
import Card from '../components/Card';
import PieChartCard from '../components/PieChartCard';
import { CostClassificationItem, YearlyIncomeData, VehicleIncome, Vehicle, AmortizationAccount } from '../types';
import { formatCurrency, formatPercentage, formatNumber, yyyyMmDdToDate } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, Loader2, HelpCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { costClassificationsApi, yearlyIncomesApi, vehiclesApi, amortizationApi, financialDataApi } from '../lib/googleSheetsApi';

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

interface CostAnalysisProps {
    studyDate: Date;
}

const CostAnalysis: React.FC<CostAnalysisProps> = ({ studyDate }) => {
    const [classifications, setClassifications] = useState<CostClassificationItem[]>([]);
    const [financialData, setFinancialData] = useState<any[]>([]);
    const [incomeData, setIncomeData] = useState<YearlyIncomeData[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [amortizationAccounts, setAmortizationAccounts] = useState<AmortizationAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState<number>(studyDate.getFullYear());

    useEffect(() => {
        const fetchAnalysisData = async () => {
            setIsLoading(true);
            try {
                const [classificationsRes, financialRes, incomeRes, vehiclesRes, amortRes] = await Promise.all([
                    costClassificationsApi.list(),
                    financialDataApi.list(),
                    yearlyIncomesApi.list(),
                    vehiclesApi.list(),
                    amortizationApi.list()
                ]);

                if (classificationsRes.error) throw new Error(classificationsRes.error);
                if (financialRes.error) throw new Error(financialRes.error);
                if (incomeRes.error) throw new Error(incomeRes.error);
                if (vehiclesRes.error) throw new Error(vehiclesRes.error);
                if (amortRes.error) throw new Error(amortRes.error);

                setClassifications(classificationsRes.data || []);
                setFinancialData(financialRes.data || []);
                setIncomeData(incomeRes.data || []);
                setVehicles(vehiclesRes.data || []);
                setAmortizationAccounts(amortRes.data || []);

            } catch (err: any) {
                setError("Error al cargar datos para el análisis: " + err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnalysisData();
    }, []);

    // Años disponibles para comparativa
    const availableYears = useMemo(() => {
        const yearsFromIncome = incomeData.map(d => d.year);
        const yearsFromFinancial = financialData.filter(d => d.documentType === 'PyG').map(d => Number(d.year));
        const years = new Set([selectedYear, ...yearsFromIncome, ...yearsFromFinancial]);
        return Array.from(years).filter(y => y > 2000).sort((a, b) => b - a);
    }, [incomeData, financialData, selectedYear]);

    // Función para extraer código de cuenta del concepto (ej: "62600000004 COMISION..." -> "62600000004")
    const extractAccountCode = (concept: string): string => {
        if (!concept) return '';
        const match = concept.match(/^(\d{8,})/);
        return match ? match[1] : '';
    };

    // Función para buscar clasificación de una cuenta
    const findClassification = (concept: string) => {
        const code = extractAccountCode(concept);
        
        // Buscar por código exacto o por coincidencia en costType
        for (const classification of classifications) {
            const classCode = extractAccountCode(classification.costType);
            if (classCode && code && classCode === code) {
                return classification;
            }
            // También buscar si el costType contiene el código
            if (classification.costType && classification.costType.includes(code)) {
                return classification;
            }
        }
        return null;
    };

    // Función para verificar si es una cuenta contable real (código 8+ dígitos al inicio)
    const isAccountCode = (concept: string): boolean => {
        if (!concept || typeof concept !== 'string') return false;
        return /^\d{8,}/.test(concept.trim());
    };

    // Cruzar FinancialData (PyG) con CostClassifications para obtener costes con su clasificación
    const { costsWithClassification, incomesFromPyG } = useMemo(() => {
        // Filtrar solo registros de PyG que sean cuentas contables reales
        const pygData = financialData.filter(d => 
            d.documentType === 'PyG' && isAccountCode(d.concept)
        );
        
        const costs: any[] = [];
        const incomes: any[] = [];
        
        // DEBUG: Ver las primeras cuentas de ingresos
        const ingresosCuentas = pygData.filter(item => item.concept.startsWith('7') && Number(item.amount) > 0);
        console.log('DEBUG - Cuentas de ingresos (7xxx):', ingresosCuentas.slice(0, 5).map(i => ({
            concept: i.concept,
            amount: i.amount,
            amountNumber: Number(i.amount)
        })));
        
        pygData.forEach(item => {
            const classification = findClassification(item.concept);
            const rawAmount = Number(item.amount) || 0;
            
            const record = {
                year: Number(item.year),
                month: Number(item.month) || 0,
                concept: item.concept,
                amount: Math.abs(rawAmount),
                costCenter: classification?.costCenter || 'INDIRECTO',
                nature: classification?.nature || 'FIJO',
                distribution: classification?.distribution || 'General',
                distributionBasis: classification?.distributionBasis || 'Meses',
                isClassified: !!classification
            };
            
            // Las cuentas que empiezan por 7 son ingresos (tienen importe positivo en el PyG)
            // Las cuentas de gastos tienen importe negativo
            if (item.concept.startsWith('7') && rawAmount > 0) {
                incomes.push(record);
            } else if (rawAmount < 0) {
                costs.push(record);
            }
        });
        
        console.log('DEBUG - Total ingresos calculado:', incomes.reduce((sum, i) => sum + i.amount, 0));
        
        return { costsWithClassification: costs, incomesFromPyG: incomes };
    }, [financialData, classifications]);

    // Calcular ingresos totales por año
    const incomesByYear = useMemo(() => {
        const result: Record<number, number> = {};
        incomesFromPyG.forEach(item => {
            const year = item.year;
            result[year] = (result[year] || 0) + item.amount;
        });
        return result;
    }, [incomesFromPyG]);

    // Calcular costes por año para comparativa
    const costsByYear = useMemo(() => {
        const result: Record<number, {
            directFixed: number;
            directVariable: number;
            indirectFixed: number;
            indirectVariable: number;
            totalDirect: number;
            totalIndirect: number;
            totalFixed: number;
            totalVariable: number;
            total: number;
            income: number;
            profit: number;
            costs: typeof costsWithClassification;
        }> = {};

        availableYears.forEach(year => {
            // Filtrar costes del año (month = 0 es anual, o sumar todos los meses)
            const yearCosts = costsWithClassification.filter(c => c.year === year);
            
            const directFixed = yearCosts.filter(c => c.costCenter === 'DIRECTO' && c.nature === 'FIJO').reduce((sum, c) => sum + c.amount, 0);
            const directVariable = yearCosts.filter(c => c.costCenter === 'DIRECTO' && c.nature === 'VARIABLE').reduce((sum, c) => sum + c.amount, 0);
            const indirectFixed = yearCosts.filter(c => c.costCenter === 'INDIRECTO' && c.nature === 'FIJO').reduce((sum, c) => sum + c.amount, 0);
            const indirectVariable = yearCosts.filter(c => c.costCenter === 'INDIRECTO' && c.nature === 'VARIABLE').reduce((sum, c) => sum + c.amount, 0);

            const totalCosts = directFixed + directVariable + indirectFixed + indirectVariable;
            const income = incomesByYear[year] || 0;

            result[year] = {
                directFixed,
                directVariable,
                indirectFixed,
                indirectVariable,
                totalDirect: directFixed + directVariable,
                totalIndirect: indirectFixed + indirectVariable,
                totalFixed: directFixed + indirectFixed,
                totalVariable: directVariable + indirectVariable,
                total: totalCosts,
                income: income,
                profit: income - totalCosts,
                costs: yearCosts
            };
        });

        return result;
    }, [costsWithClassification, availableYears]);

    // Análisis detallado por vehículo
    const vehicleAnalysis = useMemo(() => {
        if (isLoading || error || vehicles.length === 0) return null;

        const yearlyIncome = incomeData.find(d => d.year === selectedYear);
        const yearCosts = costsByYear[selectedYear];
        if (!yearCosts || yearCosts.total === 0) return null;

        // Amortización indirecta (no vehículos)
        const indirectAmortization = amortizationAccounts
            .filter(a => !a.name.toLowerCase().includes('flota') && !a.name.toLowerCase().includes('vehiculo') && !a.name.toLowerCase().includes('autobus'))
            .reduce((sum, a) => sum + (Number(a.annualValues?.[selectedYear]) || Number(a.annualAmount) || 0), 0);

        // Procesar vehículos activos en el año
        const activeVehicles = vehicles.map(v => {
            const yearStart = new Date(selectedYear, 0, 1);
            const yearEnd = new Date(selectedYear, 11, 31);
            const acqDate = yyyyMmDdToDate(v.acquisitionDate);
            const slDate = v.saleDate ? yyyyMmDdToDate(v.saleDate) : null;

            if (acqDate > yearEnd || (slDate && slDate < yearStart)) return null;

            const startDate = acqDate > yearStart ? acqDate : yearStart;
            const endDate = slDate && slDate < yearEnd ? slDate : yearEnd;
            let monthsActive = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth() + 1;
            if (monthsActive < 1) monthsActive = 1;
            if (monthsActive > 12) monthsActive = 12;

            const coefTime = monthsActive / 12;
            const kms = Number(v.annualKms?.[selectedYear]) || 0;

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
            
            const income = vehicleIncomeData
                ? Object.values(vehicleIncomeData.income || {}).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0)
                : 0;

            // Costes directos imputados a este vehículo específico (desde las clasificaciones)
            const directImputed = yearCosts.costs
                .filter(c => c.distribution === v.licensePlate)
                .reduce((sum, c) => sum + c.amount, 0);

            const vehicleAmortization = (Number(v.annualAmortization) || 0) * coefTime;

            return { ...v, monthsActive, coefTime, kms, income, directImputed, vehicleAmortization };
        }).filter((v): v is NonNullable<typeof v> => v !== null);

        if (activeVehicles.length === 0) return { vehicles: [], totals: null, companyBreakeven: 0 };

        const totalKms = activeVehicles.reduce((sum, v) => sum + v.kms, 0);
        const totalCoefTime = activeVehicles.reduce((sum, v) => sum + v.coefTime, 0);

        const vehicleMetrics = activeVehicles.map(v => {
            const coefKm = totalKms > 0 ? v.kms / totalKms : 0;

            const cdFijos = totalCoefTime > 0 ? yearCosts.directFixed * v.coefTime / totalCoefTime : 0;
            const cdVariables = yearCosts.directVariable * coefKm;
            const ciFijos = totalCoefTime > 0 ? yearCosts.indirectFixed * v.coefTime / totalCoefTime : 0;
            const ciVariables = yearCosts.indirectVariable * coefKm;
            const amortIndirecta = totalCoefTime > 0 ? indirectAmortization * v.coefTime / totalCoefTime : 0;

            const totalCosts = cdFijos + cdVariables + v.directImputed + ciFijos + ciVariables + v.vehicleAmortization + amortIndirecta;
            const totalFixedCosts = cdFijos + v.directImputed + ciFijos + v.vehicleAmortization + amortIndirecta;
            const totalVariableCosts = cdVariables + ciVariables;

            const costPerKm = v.kms > 0 ? totalCosts / v.kms : 0;
            const profit = v.income - totalCosts;

            const contributionRatio = v.income > 0 ? (v.income - totalVariableCosts) / v.income : 0;
            const breakeven = contributionRatio > 0 ? totalFixedCosts / contributionRatio : 0;

            return {
                licensePlate: v.licensePlate,
                assignedNumber: v.assignedNumber,
                type: v.type,
                monthsActive: v.monthsActive,
                coefTime: v.coefTime,
                coefKm,
                kms: v.kms,
                cdFijos,
                cdVariables,
                directImputed: v.directImputed,
                ciFijos,
                ciVariables,
                vehicleAmortization: v.vehicleAmortization,
                amortIndirecta,
                totalCosts,
                totalFixedCosts,
                totalVariableCosts,
                costPerKm,
                income: v.income,
                profit,
                breakeven
            };
        });

        const totals = {
            kms: vehicleMetrics.reduce((sum, v) => sum + v.kms, 0),
            cdFijos: vehicleMetrics.reduce((sum, v) => sum + v.cdFijos, 0),
            cdVariables: vehicleMetrics.reduce((sum, v) => sum + v.cdVariables, 0),
            directImputed: vehicleMetrics.reduce((sum, v) => sum + v.directImputed, 0),
            ciFijos: vehicleMetrics.reduce((sum, v) => sum + v.ciFijos, 0),
            ciVariables: vehicleMetrics.reduce((sum, v) => sum + v.ciVariables, 0),
            vehicleAmortization: vehicleMetrics.reduce((sum, v) => sum + v.vehicleAmortization, 0),
            amortIndirecta: vehicleMetrics.reduce((sum, v) => sum + v.amortIndirecta, 0),
            totalCosts: vehicleMetrics.reduce((sum, v) => sum + v.totalCosts, 0),
            totalFixedCosts: vehicleMetrics.reduce((sum, v) => sum + v.totalFixedCosts, 0),
            totalVariableCosts: vehicleMetrics.reduce((sum, v) => sum + v.totalVariableCosts, 0),
            income: vehicleMetrics.reduce((sum, v) => sum + v.income, 0),
            profit: vehicleMetrics.reduce((sum, v) => sum + v.profit, 0),
            costPerKm: 0
        };

        totals.costPerKm = totals.kms > 0 ? totals.totalCosts / totals.kms : 0;

        const companyContributionRatio = totals.income > 0 ? (totals.income - totals.totalVariableCosts) / totals.income : 0;
        const companyBreakeven = companyContributionRatio > 0 ? totals.totalFixedCosts / companyContributionRatio : 0;

        return { vehicles: vehicleMetrics, totals, companyBreakeven };
    }, [vehicles, incomeData, costsByYear, amortizationAccounts, selectedYear, isLoading, error]);

    const KpiBox: React.FC<{ title: string; value: string; subtitle?: string; tooltip?: string }> = 
        ({ title, value, subtitle, tooltip }) => (
        <div className="p-4 bg-white rounded-lg border shadow-sm">
            <p className="text-sm font-medium text-gray-500">
                {tooltip ? <Tooltip text={title} formula={tooltip} /> : title}
            </p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
    );

    if (isLoading) return <div className="flex justify-center items-center py-12"><Loader2 className="animate-spin mr-2" /> Cargando análisis...</div>;
    if (error) return <div className="text-red-600 text-center py-12">{error}</div>;

    // Verificar si hay datos de PyG en general (no solo del año seleccionado)
    const hasPyGData = financialData.some(d => d.documentType === 'PyG');
    
    if (!hasPyGData) {
        return (
            <Card title="Análisis de Costes">
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No hay datos de PyG importados</h3>
                    <p className="text-gray-600">Ve a 'Importar Documentos' para cargar un archivo de Pérdidas y Ganancias.</p>
                </div>
            </Card>
        );
    }

    const currentCosts = costsByYear[selectedYear];
    const prevCosts = costsByYear[selectedYear - 1];

    const evolutionData = availableYears.map(year => ({
        year,
        'CD Fijos': costsByYear[year]?.directFixed || 0,
        'CD Variables': costsByYear[year]?.directVariable || 0,
        'CI Fijos': costsByYear[year]?.indirectFixed || 0,
        'CI Variables': costsByYear[year]?.indirectVariable || 0,
    })).reverse();

    return (
        <div className="space-y-6">
            {/* SELECTOR DE AÑO */}
            <Card>
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-secondary">Análisis de Costes</h2>
                    <div className="flex items-center gap-2">
                        <label className="font-medium text-gray-600">Año:</label>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="p-2 border rounded-md bg-white"
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </Card>

            {/* SECCIÓN 1: RESUMEN DE COSTES EMPRESA */}
            {currentCosts && currentCosts.total > 0 ? (
            <Card title={`Resumen de Costes - ${selectedYear}`}>
                <div className="overflow-x-auto mb-6">
                    <table className="w-full text-sm">
                        <thead className="bg-secondary text-white">
                            <tr>
                                <th className="px-4 py-3 text-left"></th>
                                <th className="px-4 py-3 text-right">
                                    <Tooltip text="Costes Fijos" formula="Costes que no varían con la actividad" />
                                </th>
                                <th className="px-4 py-3 text-right">
                                    <Tooltip text="Costes Variables" formula="Costes que varían según km o actividad" />
                                </th>
                                <th className="px-4 py-3 text-right font-bold">Total</th>
                                {prevCosts && <th className="px-4 py-3 text-right">Var. %</th>}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3 font-semibold">Costes Directos</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(currentCosts.directFixed)}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(currentCosts.directVariable)}</td>
                                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(currentCosts.totalDirect)}</td>
                                {prevCosts && prevCosts.totalDirect > 0 && (
                                    <td className={`px-4 py-3 text-right ${currentCosts.totalDirect > prevCosts.totalDirect ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatPercentage(((currentCosts.totalDirect - prevCosts.totalDirect) / prevCosts.totalDirect) * 100)}
                                    </td>
                                )}
                            </tr>
                            <tr className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3 font-semibold">Costes Indirectos</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(currentCosts.indirectFixed)}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(currentCosts.indirectVariable)}</td>
                                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(currentCosts.totalIndirect)}</td>
                                {prevCosts && prevCosts.totalIndirect > 0 && (
                                    <td className={`px-4 py-3 text-right ${currentCosts.totalIndirect > prevCosts.totalIndirect ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatPercentage(((currentCosts.totalIndirect - prevCosts.totalIndirect) / prevCosts.totalIndirect) * 100)}
                                    </td>
                                )}
                            </tr>
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold">
                            <tr>
                                <td className="px-4 py-3">TOTAL</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(currentCosts.totalFixed)}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(currentCosts.totalVariable)}</td>
                                <td className="px-4 py-3 text-right text-lg text-primary">{formatCurrency(currentCosts.total)}</td>
                                {prevCosts && prevCosts.total > 0 && (
                                    <td className={`px-4 py-3 text-right ${currentCosts.total > prevCosts.total ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatPercentage(((currentCosts.total - prevCosts.total) / prevCosts.total) * 100)}
                                    </td>
                                )}
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* KPIs con datos del PyG */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                    <KpiBox title="Ingresos Totales (PyG)" value={formatCurrency(currentCosts.income)} />
                    <KpiBox title="Costes Totales" value={formatCurrency(currentCosts.total)} />
                    <KpiBox 
                        title="Beneficio" 
                        value={formatCurrency(currentCosts.profit)}
                        subtitle={currentCosts.income > 0 ? `${formatPercentage((currentCosts.profit / currentCosts.income) * 100)} margen` : ''}
                    />
                    <KpiBox 
                        title="Umbral Rentabilidad" 
                        value={formatCurrency(currentCosts.totalVariable > 0 && currentCosts.income > 0 
                            ? currentCosts.totalFixed / (1 - currentCosts.totalVariable / currentCosts.income)
                            : 0)}
                        tooltip="CF ÷ (1 - CV/Ingresos)"
                        subtitle={currentCosts.income > (currentCosts.totalFixed / (1 - (currentCosts.totalVariable / currentCosts.income || 1))) ? '✅ Por encima' : '⚠️ Por debajo'}
                    />
                </div>
            </Card>
            ) : (
                <Card>
                    <div className="text-center py-8 text-gray-500">
                        <AlertCircle size={40} className="mx-auto mb-3 text-gray-400" />
                        <p>No hay datos de costes para el año {selectedYear}.</p>
                        <p className="text-sm mt-2">Selecciona otro año o importa un PyG para este período.</p>
                    </div>
                </Card>
            )}

            {/* SECCIÓN 2: GRÁFICOS */}
            {currentCosts && currentCosts.total > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PieChartCard 
                    title="Distribución por Centro de Coste"
                    data={[{ name: 'Directos', value: currentCosts.totalDirect }, { name: 'Indirectos', value: currentCosts.totalIndirect }]}
                    colors={['#2D5A27', '#6c757d']}
                />
                <PieChartCard 
                    title="Distribución por Naturaleza"
                    data={[{ name: 'Fijos', value: currentCosts.totalFixed }, { name: 'Variables', value: currentCosts.totalVariable }]}
                    colors={['#C4842D', '#DC3545']}
                />
            </div>
            )}

            {evolutionData.length > 1 && (
                <Card title="Evolución de Costes">
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={evolutionData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="year" />
                                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                                <RechartsTooltip formatter={(value) => formatCurrency(value as number)} />
                                <Legend />
                                <Bar dataKey="CD Fijos" stackId="a" fill="#2D5A27" />
                                <Bar dataKey="CD Variables" stackId="a" fill="#4a8c42" />
                                <Bar dataKey="CI Fijos" stackId="a" fill="#C4842D" />
                                <Bar dataKey="CI Variables" stackId="a" fill="#e6a84d" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}

            {/* SECCIÓN 3: ANÁLISIS POR VEHÍCULO */}
            {vehicleAnalysis && vehicleAnalysis.vehicles.length > 0 && vehicleAnalysis.totals && (
                <Card title="Análisis de Costes por Vehículo">
                    <p className="text-sm text-gray-500 mb-4">
                        Reparto según <strong>Coef. Tiempo</strong> (meses activo/12) y <strong>Coef. Km</strong> (km vehículo/km totales)
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-secondary text-white">
                                <tr>
                                    <th className="px-2 py-2 text-left">Vehículo</th>
                                    <th className="px-2 py-2 text-center"><Tooltip text="C.T" formula="Meses activo ÷ 12" /></th>
                                    <th className="px-2 py-2 text-center"><Tooltip text="C.Km" formula="Km vehículo ÷ Km totales" /></th>
                                    <th className="px-2 py-2 text-right"><Tooltip text="CD Fij" formula="CD Fijos × C.T" /></th>
                                    <th className="px-2 py-2 text-right"><Tooltip text="CD Var" formula="CD Variables × C.Km" /></th>
                                    <th className="px-2 py-2 text-right"><Tooltip text="CD Imp" formula="Costes imputados directamente" /></th>
                                    <th className="px-2 py-2 text-right"><Tooltip text="CI Fij" formula="CI Fijos × C.T" /></th>
                                    <th className="px-2 py-2 text-right"><Tooltip text="CI Var" formula="CI Variables × C.Km" /></th>
                                    <th className="px-2 py-2 text-right"><Tooltip text="Am.V" formula="Amort. vehículo × C.T" /></th>
                                    <th className="px-2 py-2 text-right"><Tooltip text="Am.I" formula="Amort. indirecta × C.T" /></th>
                                    <th className="px-2 py-2 text-right font-bold bg-gray-700">Total</th>
                                    <th className="px-2 py-2 text-right">Km</th>
                                    <th className="px-2 py-2 text-right"><Tooltip text="€/Km" formula="Total Costes ÷ Km" /></th>
                                    <th className="px-2 py-2 text-right"><Tooltip text="Ingr." formula="Suma MonthlyIncome (tipo Propio)" /></th>
                                    <th className="px-2 py-2 text-right font-bold bg-gray-700"><Tooltip text="Benef." formula="Ingresos - Total Costes" /></th>
                                    <th className="px-2 py-2 text-right"><Tooltip text="Umbral" formula="CF ÷ (1 - CV/Ing)" /></th>
                                </tr>
                            </thead>
                            <tbody>
                                {vehicleAnalysis.vehicles.map((v, i) => (
                                    <tr key={i} className="border-b hover:bg-gray-50">
                                        <td className="px-2 py-2 font-medium">
                                            <span className="text-gray-400">#{v.assignedNumber}</span> {v.licensePlate}
                                        </td>
                                        <td className="px-2 py-2 text-center">{v.coefTime.toFixed(2)}</td>
                                        <td className="px-2 py-2 text-center">{v.coefKm.toFixed(3)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(v.cdFijos)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(v.cdVariables)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(v.directImputed)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(v.ciFijos)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(v.ciVariables)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(v.vehicleAmortization)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(v.amortIndirecta)}</td>
                                        <td className="px-2 py-2 text-right font-semibold bg-gray-50">{formatCurrency(v.totalCosts)}</td>
                                        <td className="px-2 py-2 text-right">{formatNumber(v.kms)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(v.costPerKm)}</td>
                                        <td className="px-2 py-2 text-right">{formatCurrency(v.income)}</td>
                                        <td className={`px-2 py-2 text-right font-semibold ${v.profit >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                            {formatCurrency(v.profit)}
                                        </td>
                                        <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(v.breakeven)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 font-bold text-xs">
                                <tr>
                                    <td className="px-2 py-3">TOTALES</td>
                                    <td className="px-2 py-3 text-center">-</td>
                                    <td className="px-2 py-3 text-center">-</td>
                                    <td className="px-2 py-3 text-right">{formatCurrency(vehicleAnalysis.totals.cdFijos)}</td>
                                    <td className="px-2 py-3 text-right">{formatCurrency(vehicleAnalysis.totals.cdVariables)}</td>
                                    <td className="px-2 py-3 text-right">{formatCurrency(vehicleAnalysis.totals.directImputed)}</td>
                                    <td className="px-2 py-3 text-right">{formatCurrency(vehicleAnalysis.totals.ciFijos)}</td>
                                    <td className="px-2 py-3 text-right">{formatCurrency(vehicleAnalysis.totals.ciVariables)}</td>
                                    <td className="px-2 py-3 text-right">{formatCurrency(vehicleAnalysis.totals.vehicleAmortization)}</td>
                                    <td className="px-2 py-3 text-right">{formatCurrency(vehicleAnalysis.totals.amortIndirecta)}</td>
                                    <td className="px-2 py-3 text-right bg-gray-200">{formatCurrency(vehicleAnalysis.totals.totalCosts)}</td>
                                    <td className="px-2 py-3 text-right">{formatNumber(vehicleAnalysis.totals.kms)}</td>
                                    <td className="px-2 py-3 text-right">{formatCurrency(vehicleAnalysis.totals.costPerKm)}</td>
                                    <td className="px-2 py-3 text-right">{formatCurrency(vehicleAnalysis.totals.income)}</td>
                                    <td className={`px-2 py-3 text-right ${vehicleAnalysis.totals.profit >= 0 ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                                        {formatCurrency(vehicleAnalysis.totals.profit)}
                                    </td>
                                    <td className="px-2 py-3 text-right">{formatCurrency(vehicleAnalysis.companyBreakeven)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </Card>
            )}

            {/* SECCIÓN 4: TOP COSTES */}
            {currentCosts && currentCosts.costs && currentCosts.costs.length > 0 && (
                <Card title={`Top Cuentas de Gasto - ${selectedYear}`}>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={[...currentCosts.costs].sort((a, b) => b.amount - a.amount).slice(0, 10).map(c => ({
                                    costType: c.concept.length > 40 ? c.concept.substring(0, 40) + '...' : c.concept,
                                    amount: c.amount
                                }))} 
                                layout="vertical" 
                                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                                <YAxis dataKey="costType" type="category" width={190} tick={{ fontSize: 10 }} />
                                <RechartsTooltip formatter={(value) => formatCurrency(value as number)} />
                                <Bar dataKey="amount" fill="#2D5A27" name="Importe" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default CostAnalysis;
