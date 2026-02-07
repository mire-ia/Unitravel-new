import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Loader2, HelpCircle } from 'lucide-react';
import Card from '../components/Card';
import PieChartCard from '../components/PieChartCard';
import { formatCurrency, formatNumber, formatPercentage, dateToYyyyMmDd, yyyyMmDdToDate } from '../lib/utils';
import { vehiclesApi, yearlyIncomesApi, costClassificationsApi, financialDataApi, clearCache } from '../lib/googleSheetsApi';

// Componente Tooltip para mostrar fórmulas
const Tooltip: React.FC<{ text: string; formula: string }> = ({ text, formula }) => (
    <span className="group relative cursor-help inline-flex items-center gap-1">
        {text}
        <HelpCircle size={14} className="text-gray-400 group-hover:text-primary" />
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
            {formula}
        </span>
    </span>
);

interface DashboardProps {
    studyDate: Date;
    setStudyDate: (date: Date) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ studyDate, setStudyDate }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [incomeData, setIncomeData] = useState<any[]>([]);
    const [costs, setCosts] = useState<any[]>([]);
    const [financialData, setFinancialData] = useState<any[]>([]);
    
    const selectedYear = studyDate.getFullYear();
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [vehiclesRes, incomeRes, costsRes, financialRes] = await Promise.all([
                    vehiclesApi.list(),
                    yearlyIncomesApi.list(),
                    costClassificationsApi.list(),
                    financialDataApi.list()
                ]);
                
                setVehicles(vehiclesRes.data || []);
                setIncomeData(incomeRes.data || []);
                setCosts(costsRes.data || []);
                setFinancialData(financialRes.data || []);
            } catch (e) {
                console.error('Error cargando datos:', e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleRefresh = () => {
        clearCache('Vehicles');
        clearCache('MonthlyIncome');
        clearCache('CostClassifications');
        clearCache('FinancialData');
        window.location.reload();
    };

    // Calcular ingresos del año seleccionado
    const yearIncome = useMemo(() => {
        const yearData = incomeData.find(d => d.year === selectedYear);
        if (!yearData) return { total: 0, own: 0, subcontracted: 0 };
        
        // Sumar ingresos propios
        const own = yearData.ownFleet?.reduce((sum: number, v: any) => {
            const vehicleTotal = Object.values(v.income || {}).reduce((s: number, val: any) => s + (Number(val) || 0), 0);
            return sum + vehicleTotal;
        }, 0) || 0;
        
        // Sumar ingresos subcontratados
        const subcontracted = Object.values(yearData.subcontracted || {}).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
        
        return { total: own + subcontracted, own, subcontracted };
    }, [incomeData, selectedYear]);

    // Calcular costes totales del año
    const totalCosts = useMemo(() => {
        // Por ahora usamos los costes clasificados
        // En el futuro esto debería venir de FinancialData (PyG)
        return costs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    }, [costs]);

    // Calcular costes por tipo de autobús
    const costsByBusType = useMemo(() => {
        // Agrupar vehículos por tipo
        const vehiclesByType: Record<string, any[]> = {
            'Micro': [],
            'Normal': [],
            'Grande': []
        };
        
        vehicles.forEach(v => {
            const type = v.type || 'Normal';
            if (vehiclesByType[type]) {
                vehiclesByType[type].push(v);
            }
        });

        // Obtener datos del año seleccionado
        const yearData = incomeData.find(d => d.year === selectedYear);
        
        const results: Array<{type: string, costPerHour: number, costPerKm: number, formula: string}> = [];
        
        // Costes fijos totales (de la clasificación de costes)
        const fixedCosts = costs.filter(c => c.nature === 'FIJO').reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
        const variableCosts = costs.filter(c => c.nature === 'VARIABLE').reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
        
        // Horas estimadas de trabajo por año (suponiendo 1800 horas por vehículo activo)
        const HOURS_PER_VEHICLE_YEAR = 1800;
        
        Object.entries(vehiclesByType).forEach(([type, typeVehicles]) => {
            if (typeVehicles.length === 0) return;
            
            // Calcular km totales del tipo
            let totalKms = 0;
            typeVehicles.forEach(v => {
                const kms = v.annualKms?.[selectedYear] || 0;
                totalKms += kms;
            });
            
            // Calcular ingresos del tipo
            let typeIncome = 0;
            if (yearData?.ownFleet) {
                yearData.ownFleet.forEach((vi: any) => {
                    const vehicle = vehicles.find(v => v.licensePlate === vi.licensePlate);
                    if (vehicle?.type === type) {
                        const income = Object.values(vi.income || {}).reduce((s: number, val: any) => s + (Number(val) || 0), 0);
                        typeIncome += income;
                    }
                });
            }
            
            // Proporción de costes por tipo (basado en número de vehículos)
            const totalVehicles = vehicles.filter(v => v.type).length || 1;
            const typeProportion = typeVehicles.length / totalVehicles;
            
            // Costes asignados al tipo
            const typeFixedCosts = fixedCosts * typeProportion;
            const typeVariableCosts = variableCosts * typeProportion;
            const typeTotalCosts = typeFixedCosts + typeVariableCosts;
            
            // Horas totales del tipo
            const totalHours = typeVehicles.length * HOURS_PER_VEHICLE_YEAR;
            
            // Coste por hora = Costes totales del tipo / Horas totales
            const costPerHour = totalHours > 0 ? typeTotalCosts / totalHours : 0;
            
            // Coste por km = Costes totales del tipo / Km totales
            const costPerKm = totalKms > 0 ? typeTotalCosts / totalKms : 0;
            
            const typeLabel = type === 'Micro' ? 'MICROBÚS' : type === 'Grande' ? 'AUTOCAR GRANDE' : 'AUTOCAR NORMAL';
            
            results.push({
                type: typeLabel,
                costPerHour,
                costPerKm,
                formula: `Costes (${formatCurrency(typeTotalCosts)}) ÷ Horas (${formatNumber(totalHours)})`
            });
        });
        
        return results;
    }, [vehicles, incomeData, costs, selectedYear]);

    // Promedio coste hora
    const avgCostPerHour = useMemo(() => {
        if (costsByBusType.length === 0) return 0;
        return costsByBusType.reduce((sum, c) => sum + c.costPerHour, 0) / costsByBusType.length;
    }, [costsByBusType]);

    // Datos del Balance (desde FinancialData)
    const balanceData = useMemo(() => {
        const currentYearData = financialData.filter(d => d.year === selectedYear && d.documentType === 'Balance');
        const prevYearData = financialData.filter(d => d.year === selectedYear - 1 && d.documentType === 'Balance');
        
        const getConcept = (data: any[], searchTerms: string[]) => {
            for (const term of searchTerms) {
                const found = data.find(d => d.concept?.toLowerCase().includes(term.toLowerCase()));
                if (found) return Number(found.amount) || 0;
            }
            return 0;
        };
        
        const activoNoCorriente = getConcept(currentYearData, ['Activo No Corriente', 'A) ACTIVO NO CORRIENTE']);
        const activoCorriente = getConcept(currentYearData, ['Activo Corriente', 'B) ACTIVO CORRIENTE']);
        const patrimonioNeto = getConcept(currentYearData, ['Patrimonio Neto', 'A) PATRIMONIO NETO']);
        const pasivoNoCorriente = getConcept(currentYearData, ['Pasivo No Corriente', 'B) PASIVO NO CORRIENTE']);
        const pasivoCorriente = getConcept(currentYearData, ['Pasivo Corriente', 'C) PASIVO CORRIENTE']);
        
        const prevActivoNoCorriente = getConcept(prevYearData, ['Activo No Corriente', 'A) ACTIVO NO CORRIENTE']);
        const prevActivoCorriente = getConcept(prevYearData, ['Activo Corriente', 'B) ACTIVO CORRIENTE']);
        const prevPatrimonioNeto = getConcept(prevYearData, ['Patrimonio Neto', 'A) PATRIMONIO NETO']);
        const prevPasivoNoCorriente = getConcept(prevYearData, ['Pasivo No Corriente', 'B) PASIVO NO CORRIENTE']);
        const prevPasivoCorriente = getConcept(prevYearData, ['Pasivo Corriente', 'C) PASIVO CORRIENTE']);
        
        const calcVariation = (current: number, prev: number) => prev !== 0 ? ((current - prev) / Math.abs(prev)) * 100 : 0;
        
        return {
            activo: [
                { concept: 'A) Activo No Corriente', currentYear: activoNoCorriente, previousYear: prevActivoNoCorriente, variation: calcVariation(activoNoCorriente, prevActivoNoCorriente) },
                { concept: 'B) Activo Corriente', currentYear: activoCorriente, previousYear: prevActivoCorriente, variation: calcVariation(activoCorriente, prevActivoCorriente) },
                { concept: 'Total Activo', currentYear: activoNoCorriente + activoCorriente, previousYear: prevActivoNoCorriente + prevActivoCorriente, variation: calcVariation(activoNoCorriente + activoCorriente, prevActivoNoCorriente + prevActivoCorriente) },
            ],
            pasivo: [
                { concept: 'A) Patrimonio Neto', currentYear: patrimonioNeto, previousYear: prevPatrimonioNeto, variation: calcVariation(patrimonioNeto, prevPatrimonioNeto) },
                { concept: 'B) Pasivo No Corriente', currentYear: pasivoNoCorriente, previousYear: prevPasivoNoCorriente, variation: calcVariation(pasivoNoCorriente, prevPasivoNoCorriente) },
                { concept: 'C) Pasivo Corriente', currentYear: pasivoCorriente, previousYear: prevPasivoCorriente, variation: calcVariation(pasivoCorriente, prevPasivoCorriente) },
                { concept: 'Total Pasivo', currentYear: patrimonioNeto + pasivoNoCorriente + pasivoCorriente, previousYear: prevPatrimonioNeto + prevPasivoNoCorriente + prevPasivoCorriente, variation: calcVariation(patrimonioNeto + pasivoNoCorriente + pasivoCorriente, prevPatrimonioNeto + prevPasivoNoCorriente + prevPasivoCorriente) },
            ],
            // Datos para ratios
            activoCorriente,
            pasivoCorriente,
            patrimonioNeto,
            pasivoTotal: pasivoNoCorriente + pasivoCorriente,
            activoTotal: activoNoCorriente + activoCorriente,
            prevActivoCorriente,
            prevPasivoCorriente,
            prevPatrimonioNeto,
            prevPasivoTotal: prevPasivoNoCorriente + prevPasivoCorriente,
            prevActivoTotal: prevActivoNoCorriente + prevActivoCorriente,
        };
    }, [financialData, selectedYear]);

    // Ratios financieros
    const ratios = useMemo(() => {
        const { activoCorriente, pasivoCorriente, patrimonioNeto, pasivoTotal, activoTotal,
                prevActivoCorriente, prevPasivoCorriente, prevPatrimonioNeto, prevPasivoTotal, prevActivoTotal } = balanceData;
        
        const fondoManiobra = activoCorriente - pasivoCorriente;
        const prevFondoManiobra = prevActivoCorriente - prevPasivoCorriente;
        
        const liquidez = pasivoCorriente !== 0 ? activoCorriente / pasivoCorriente : 0;
        const prevLiquidez = prevPasivoCorriente !== 0 ? prevActivoCorriente / prevPasivoCorriente : 0;
        
        const solvencia = pasivoTotal !== 0 ? activoTotal / pasivoTotal : 0;
        const prevSolvencia = prevPasivoTotal !== 0 ? prevActivoTotal / prevPasivoTotal : 0;
        
        const endeudamiento = patrimonioNeto !== 0 ? pasivoTotal / patrimonioNeto : 0;
        const prevEndeudamiento = prevPatrimonioNeto !== 0 ? prevPasivoTotal / prevPatrimonioNeto : 0;
        
        const calcVariation = (current: number, prev: number) => prev !== 0 ? ((current - prev) / Math.abs(prev)) * 100 : 0;
        
        return [
            { 
                ratio: 'Fondo de Maniobra', 
                currentYear: fondoManiobra, 
                previousYear: prevFondoManiobra, 
                variation: calcVariation(fondoManiobra, prevFondoManiobra), 
                optimalValue: '> 0',
                formula: 'Activo Corriente - Pasivo Corriente',
                interpretation: fondoManiobra < 0 ? 'Riesgo de liquidez' : undefined
            },
            { 
                ratio: 'Ratio de Liquidez', 
                currentYear: liquidez, 
                previousYear: prevLiquidez, 
                variation: calcVariation(liquidez, prevLiquidez), 
                optimalValue: '1,5 - 2',
                formula: 'Activo Corriente ÷ Pasivo Corriente',
                interpretation: liquidez < 1 ? 'Problemas de liquidez' : liquidez > 2 ? 'Exceso de liquidez' : undefined
            },
            { 
                ratio: 'Ratio de Solvencia', 
                currentYear: solvencia, 
                previousYear: prevSolvencia, 
                variation: calcVariation(solvencia, prevSolvencia), 
                optimalValue: '> 1,5',
                formula: 'Activo Total ÷ Pasivo Total',
                interpretation: solvencia < 1.5 ? 'Solvencia ajustada' : undefined
            },
            { 
                ratio: 'Ratio de Endeudamiento', 
                currentYear: endeudamiento, 
                previousYear: prevEndeudamiento, 
                variation: calcVariation(endeudamiento, prevEndeudamiento), 
                optimalValue: '0,4 - 0,6',
                formula: 'Pasivo Total ÷ Patrimonio Neto',
                interpretation: endeudamiento > 1 ? 'Alto endeudamiento' : undefined
            },
        ];
    }, [balanceData]);

    // Umbral de rentabilidad
    const breakEvenAnalysis = useMemo(() => {
        const fixedCosts = costs.filter(c => c.nature === 'FIJO').reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
        const variableCosts = costs.filter(c => c.nature === 'VARIABLE').reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
        const sales = yearIncome.total;
        
        // Margen de contribución = Ventas - Costes Variables
        const contributionMargin = sales - variableCosts;
        // Ratio de contribución = Margen / Ventas
        const contributionRatio = sales !== 0 ? contributionMargin / sales : 0;
        // Umbral = Costes Fijos / Ratio de contribución
        const breakEven = contributionRatio !== 0 ? fixedCosts / contributionRatio : 0;
        // Beneficio actual = Ventas - Costes Fijos - Costes Variables
        const currentProfit = sales - fixedCosts - variableCosts;
        
        return { breakEven, currentProfit, fixedCosts, variableCosts, sales };
    }, [costs, yearIncome]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStudyDate(yyyyMmDdToDate(e.target.value));
    };

    const pieChartData = [
        { name: 'Propios', value: yearIncome.own },
        { name: 'Subcontratados', value: yearIncome.subcontracted },
    ];

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="animate-spin mr-2" />
                Cargando datos del dashboard...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl">U</div>
                        <h1 className="text-2xl font-bold text-secondary">Dashboard Principal</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center space-x-2">
                            <label htmlFor="studyDate" className="font-semibold">Fecha de estudio:</label>
                            <input 
                                type="date" 
                                id="studyDate" 
                                value={dateToYyyyMmDd(studyDate)}
                                onChange={handleDateChange}
                                className="p-2 border rounded-md"
                            />
                        </div>
                        <button 
                            onClick={handleRefresh}
                            className="flex items-center justify-center px-4 py-2 font-bold text-white transition-colors rounded-md bg-primary hover:bg-orange-700"
                        >
                            <RefreshCw size={18} className="mr-2"/>
                            Actualizar
                        </button>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card title="Estudio de Costes por Tipo de Autobús">
                        {costsByBusType.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3">Tipo</th>
                                            <th scope="col" className="px-6 py-3 text-right">
                                                <Tooltip text="Coste/Hora" formula="Costes Totales Tipo ÷ Horas Trabajadas" />
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-right">
                                                <Tooltip text="Coste/Km" formula="Costes Totales Tipo ÷ Km Recorridos" />
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {costsByBusType.map((c, i) => (
                                            <tr key={i} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">{c.type}</td>
                                                <td className="px-6 py-4 text-right">{formatCurrency(c.costPerHour)}</td>
                                                <td className="px-6 py-4 text-right">{formatCurrency(c.costPerKm)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="font-semibold text-gray-900 bg-gray-50">
                                            <td className="px-6 py-3">
                                                <Tooltip text="Promedio Coste Hora" formula="Suma Costes/Hora ÷ Número de Tipos" />
                                            </td>
                                            <td className="px-6 py-3 text-right">{formatCurrency(avgCostPerHour)}</td>
                                            <td className="px-6 py-3 text-right"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-4">No hay vehículos con tipo asignado. Configura los tipos en Flota de Vehículos.</p>
                        )}
                    </Card>
                    
                    <Card title="Umbral de Rentabilidad">
                        <p className="text-sm text-gray-500 mb-4">
                            <Tooltip text="Cifra de ventas en la que se cubren todos los CF y CV" formula="Umbral = Costes Fijos ÷ (1 - Costes Variables / Ventas)" />
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-blue-50 rounded-lg">
                                <p className="text-sm font-semibold text-blue-800">
                                    <Tooltip text="Umbral de Rentabilidad" formula="CF ÷ Ratio Contribución" />
                                </p>
                                <p className="text-2xl font-bold text-blue-900">{formatCurrency(breakEvenAnalysis.breakEven)}</p>
                            </div>
                            <div className="p-4 bg-green-50 rounded-lg">
                                <p className="text-sm font-semibold text-green-800">
                                    <Tooltip text="Beneficio Actual" formula="Ventas - CF - CV" />
                                </p>
                                <p className={`text-2xl font-bold ${breakEvenAnalysis.currentProfit >= 0 ? 'text-green-900' : 'text-red-600'}`}>
                                    {formatCurrency(breakEvenAnalysis.currentProfit)}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm font-semibold text-gray-600">Ventas Actuales</p>
                                <p className="text-2xl font-bold text-gray-800">{formatCurrency(breakEvenAnalysis.sales)}</p>
                            </div>
                        </div>
                    </Card>
                </div>
                
                <div className="lg:col-span-1 space-y-6">
                    <Card title={`Ingresos ${selectedYear}`}>
                        <div className="space-y-2">
                            <div className="flex justify-between p-2 rounded bg-gray-50">
                                <span>Propios:</span> 
                                <span className="font-bold">{formatCurrency(yearIncome.own)}</span>
                            </div>
                            <div className="flex justify-between p-2 rounded bg-gray-50">
                                <span>Subcontratados:</span> 
                                <span className="font-bold">{formatCurrency(yearIncome.subcontracted)}</span>
                            </div>
                            <div className="flex justify-between p-3 font-bold text-white rounded bg-secondary">
                                <span>TOTAL:</span> 
                                <span>{formatCurrency(yearIncome.total)}</span>
                            </div>
                        </div>
                    </Card>
                    <PieChartCard title="Proporción Ingresos" data={pieChartData} colors={['#2D5A27', '#C4842D']} />
                </div>
            </div>
            
            <Card title="Análisis de Liquidez, Solvencia y Endeudamiento">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-bold text-lg mb-2 text-primary">ACTIVO</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3">Concepto</th>
                                        <th className="px-6 py-3 text-right">{selectedYear}</th>
                                        <th className="px-6 py-3 text-right">{selectedYear - 1}</th>
                                        <th className="px-6 py-3 text-right">Var. %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {balanceData.activo.map((item, i) => (
                                        <tr key={i} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900">{item.concept}</td>
                                            <td className="px-6 py-4 text-right">{formatCurrency(item.currentYear)}</td>
                                            <td className="px-6 py-4 text-right">{formatCurrency(item.previousYear)}</td>
                                            <td className={`px-6 py-4 text-right ${item.variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatPercentage(item.variation)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg mb-2 text-primary">PASIVO</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3">Concepto</th>
                                        <th className="px-6 py-3 text-right">{selectedYear}</th>
                                        <th className="px-6 py-3 text-right">{selectedYear - 1}</th>
                                        <th className="px-6 py-3 text-right">Var. %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {balanceData.pasivo.map((item, i) => (
                                        <tr key={i} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900">{item.concept}</td>
                                            <td className="px-6 py-4 text-right">{formatCurrency(item.currentYear)}</td>
                                            <td className="px-6 py-4 text-right">{formatCurrency(item.previousYear)}</td>
                                            <td className={`px-6 py-4 text-right ${item.variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatPercentage(item.variation)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div className="mt-6">
                    <h3 className="font-bold text-lg mb-2 text-primary">Ratios Financieros</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3">Ratio</th>
                                    <th className="px-6 py-3 text-right">{selectedYear}</th>
                                    <th className="px-6 py-3 text-right">{selectedYear - 1}</th>
                                    <th className="px-6 py-3 text-right">Var. %</th>
                                    <th className="px-6 py-3 text-center">Óptimo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ratios.map((r, i) => (
                                    <tr key={i} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            <Tooltip text={r.ratio} formula={r.formula} />
                                            {r.interpretation && <p className="text-xs text-red-600 font-normal">{r.interpretation}</p>}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {r.ratio === 'Fondo de Maniobra' ? formatCurrency(r.currentYear) : formatNumber(r.currentYear)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {r.ratio === 'Fondo de Maniobra' ? formatCurrency(r.previousYear) : formatNumber(r.previousYear)}
                                        </td>
                                        <td className={`px-6 py-4 text-right ${r.variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatPercentage(r.variation)}
                                        </td>
                                        <td className="px-6 py-4 text-center font-mono">{r.optimalValue}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default Dashboard;
