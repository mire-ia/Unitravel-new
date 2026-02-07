import React, { useState, useMemo, useEffect } from 'react';
import Card from '../components/Card';
import { YearlyIncomeData, VehicleIncome, MonthlyIncomeRecord } from '../types';
import { UploadCloud, BarChart2, DollarSign, Loader2, TrendingUp } from 'lucide-react';
import { read, utils, WorkBook } from 'xlsx';
import { formatCurrency } from '../lib/utils';
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, PieChart, Pie, Cell } from 'recharts';
import { yearlyIncomesApi } from '../lib/googleSheetsApi';

const MONTHS = [
    { num: 1, name: 'Ene' }, { num: 2, name: 'Feb' }, { num: 3, name: 'Mar' },
    { num: 4, name: 'Abr' }, { num: 5, name: 'May' }, { num: 6, 'name': 'Jun' },
    { num: 7, name: 'Jul' }, { num: 8, name: 'Ago' }, { num: 9, name: 'Sep' },
    { num: 10, name: 'Oct' }, { num: 11, name: 'Nov' }, { num: 12, name: 'Dic' }
];

const initialYears = [new Date().getFullYear(), 2025, 2024, 2023];

const MonthlyIncome: React.FC = () => {
    const [incomeData, setIncomeData] = useState<YearlyIncomeData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        const fetchIncomeData = async () => {
            setIsLoading(true);
            const { data, error } = await yearlyIncomesApi.list();
            if (error) {
                setError('Error al cargar los ingresos: ' + error);
            } else {
                setIncomeData(data || []);
            }
            setIsLoading(false);
        };
        fetchIncomeData();
    }, []);
    
    const availableYears = useMemo(() => {
        const yearsFromData = incomeData.map(d => d.year);
        return [...new Set([...initialYears, ...yearsFromData])].sort((a, b) => b - a);
    }, [incomeData]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'own' | 'subcontracted') => {
        // Implement file upload and upsert to Supabase
        alert("La carga de Excel debe implementarse para hacer upsert en Supabase.");
    };
    
    const handleIncomeChange = async (type: 'own' | 'subcontracted', id: string, month: number, value: string) => {
        const numericValue = parseFloat(value) || 0;
        let yearData = incomeData.find(d => d.year === selectedYear);
        if (!yearData) {
            yearData = { year: selectedYear, ownFleet: [], subcontracted: {} };
        }
        
        let updatedData: Partial<YearlyIncomeData>;

        if (type === 'own') {
            const updatedOwnFleet = yearData.ownFleet.map(vehicle =>
                vehicle.id === id ? { ...vehicle, income: { ...vehicle.income, [month]: numericValue } } : vehicle
            );
            updatedData = { ownFleet: updatedOwnFleet };
        } else {
            const updatedSubcontracted = { ...yearData.subcontracted, [month]: numericValue };
            updatedData = { subcontracted: updatedSubcontracted };
        }

        // Actualizar localmente (la sincronización con Google Sheets se hará en lote)
        setIncomeData(prev => {
            const existing = prev.find(d => d.year === selectedYear);
            if (existing) {
                return prev.map(d => d.year === selectedYear ? { ...d, ...updatedData } : d);
            }
            return [...prev, { year: selectedYear, ownFleet: [], subcontracted: {}, ...updatedData }];
        });
    };

    const currentYearData = incomeData.find(d => d.year === selectedYear);

    const chartData = useMemo(() => {
        if (!currentYearData) return [];
        return MONTHS.map(month => {
            const own = currentYearData.ownFleet.reduce((sum, v) => sum + (v.income[month.num] || 0), 0);
            const sub = currentYearData.subcontracted[month.num] || 0;
            return {
                name: month.name,
                Propios: own,
                Subcontratados: sub,
                Total: own + sub
            };
        });
    }, [currentYearData]);

    const ownFleetTotals = useMemo(() => {
        if (!currentYearData) return {};
        return currentYearData.ownFleet.reduce((acc, vehicle) => {
            // FIX: Add explicit types to reduce accumulators to prevent type errors.
            // Safely reduce values, ensuring they are treated as numbers.
            acc[vehicle.id] = Object.values(vehicle.income || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
            return acc;
        }, {} as Record<string, number>);
    }, [currentYearData]);
    
    const monthlyTotals = useMemo(() => {
        if (!currentYearData) return {};
        const totals: Record<string, number> = {};
        for(let i=1; i<=12; i++){
            const own = currentYearData.ownFleet.reduce((sum, v) => sum + (v.income[i] || 0), 0);
            const sub = currentYearData.subcontracted[i] || 0;
            totals[i] = own + sub;
        }
        // FIX: Add explicit types to reduce accumulators to prevent type errors.
        totals['ownGrandTotal'] = currentYearData.ownFleet.reduce((sum: number, v: VehicleIncome) => sum + Object.values(v.income || {}).reduce((s: number, val) => s + (Number(val) || 0), 0), 0);
        // FIX: Add explicit types to reduce accumulators to prevent type errors.
        // Fix for "Type 'unknown' is not assignable to type 'number'" by safely reducing values.
        totals['subGrandTotal'] = Object.values(currentYearData.subcontracted || {}).reduce((sum: number, val) => sum + (Number(val) || 0), 0);
        totals['grandTotal'] = totals['ownGrandTotal'] + totals['subGrandTotal'];
        return totals;
    }, [currentYearData]);

    // Datos para el gráfico de pastel
    const pieData = useMemo(() => {
        if (!monthlyTotals['ownGrandTotal'] && !monthlyTotals['subGrandTotal']) return [];
        return [
            { name: 'Propios', value: monthlyTotals['ownGrandTotal'] || 0 },
            { name: 'Subcontratados', value: monthlyTotals['subGrandTotal'] || 0 }
        ];
    }, [monthlyTotals]);

    const PIE_COLORS = ['#2D5A27', '#C4842D'];
    
    const renderIncomeTable = () => (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm text-left">
                <thead className="text-xs text-white uppercase bg-secondary">
                    <tr>
                        <th className="px-2 py-3">Nº Vehículo</th>
                        <th className="px-2 py-3">Matrícula</th>
                        {MONTHS.map(m => <th key={m.num} className="px-2 py-3 text-center">{m.name}</th>)}
                        <th className="px-2 py-3 text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {currentYearData?.ownFleet.map(vehicle => (
                        <tr key={vehicle.id} className="bg-white border-b hover:bg-gray-50">
                            <td className="px-2 py-2">{vehicle.assignedNumber}</td>
                            <td className="px-2 py-2 font-medium">{vehicle.licensePlate}</td>
                            {MONTHS.map(m => (
                                <td key={m.num} className="px-1 py-1">
                                    <input 
                                        type="number"
                                        value={vehicle.income[m.num] || ''}
                                        onChange={(e) => handleIncomeChange('own', vehicle.id, m.num, e.target.value)}
                                        className="w-full p-1 border rounded-md text-right focus:outline-none focus:ring-2 focus:ring-primary"
                                        placeholder="0"
                                    />
                                </td>
                            ))}
                            <td className="px-2 py-2 text-right font-bold">{formatCurrency(ownFleetTotals[vehicle.id] || 0)}</td>
                        </tr>
                    ))}
                    <tr className="bg-gray-100 font-bold border-b">
                        <td colSpan={2} className="px-2 py-2">Subcontratados</td>
                        {MONTHS.map(m => (
                            <td key={m.num} className="px-1 py-1">
                                <input
                                    type="number"
                                    value={currentYearData?.subcontracted[m.num] || ''}
                                    onChange={(e) => handleIncomeChange('subcontracted', 'total', m.num, e.target.value)}
                                    className="w-full p-1 border rounded-md text-right bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="0"
                                />
                            </td>
                        ))}
                        <td className="px-2 py-2 text-right">{formatCurrency(monthlyTotals['subGrandTotal'] || 0)}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr className="text-white bg-primary font-bold">
                        <td colSpan={2} className="px-2 py-3">TOTAL GENERAL</td>
                        {MONTHS.map(m => <td key={m.num} className="px-2 py-3 text-center">{formatCurrency(monthlyTotals[m.num] || 0)}</td>)}
                        <td className="px-2 py-3 text-right">{formatCurrency(monthlyTotals['grandTotal'] || 0)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );

    return (
        <div className="space-y-6">
            <Card title="Gestión de Ingresos Mensuales">
                 <div className="flex flex-wrap items-center justify-between gap-4 p-4 mb-6 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-4">
                        <label htmlFor="year-select" className="font-semibold">Año de Análisis:</label>
                        <select id="year-select" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="p-2 border rounded-md">
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                     <div className="flex items-center gap-4">
                        <label htmlFor="excel-own" className="cursor-pointer inline-flex items-center px-4 py-2 font-bold text-white transition-colors rounded-md shadow-sm bg-secondary hover:bg-green-800">
                           <UploadCloud size={18} className="mr-2"/> Ingresos Propios
                        </label>
                         <input id="excel-own" type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 'own')} />
                        <label htmlFor="excel-sub" className="cursor-pointer inline-flex items-center px-4 py-2 font-bold text-white transition-colors rounded-md shadow-sm bg-primary hover:bg-orange-700">
                           <UploadCloud size={18} className="mr-2"/> Ingresos Subcontratados
                        </label>
                        <input id="excel-sub" type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 'subcontracted')} />
                    </div>
                 </div>
            </Card>

            {/* Resumen de Ingresos con Pastel */}
            {!isLoading && currentYearData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Total Ventas */}
                    <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-primary flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Ventas {selectedYear}</p>
                            <p className="text-3xl font-bold text-gray-800 mt-1">{formatCurrency(monthlyTotals['grandTotal'] || 0)}</p>
                        </div>
                        <div className="p-3 bg-primary bg-opacity-10 rounded-full">
                            <TrendingUp className="text-primary" size={32} />
                        </div>
                    </div>
                    
                    {/* Gráfico de Pastel */}
                    <div className="md:col-span-2 bg-white rounded-xl shadow-md p-4">
                        <h3 className="text-sm font-semibold text-gray-600 mb-2 text-center">Distribución de Ingresos</h3>
                        {pieData.length > 0 ? (
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={2}
                                            dataKey="value"
                                            label={({ name, percent, value }) => `${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(1)}%)`}
                                            labelLine={true}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => formatCurrency(value as number)} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="text-center text-gray-400 py-8">Sin datos</p>
                        )}
                    </div>
                </div>
            )}
            
            <Card title={`Evolución de Ingresos - ${selectedYear}`}>
                {isLoading ? <div className="text-center py-12"><Loader2 className="animate-spin"/></div> :
                chartData.length > 0 ? (
                    <div className="w-full h-96">
                        <ResponsiveContainer>
                            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis tickFormatter={(value) => formatCurrency(value as number)}/>
                                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                                <Legend />
                                <Bar dataKey="Propios" stackId="a" fill="#2D5A27" name="Propios"/>
                                <Bar dataKey="Subcontratados" stackId="a" fill="#C4842D" name="Subcontratados"/>
                                <Line type="monotone" dataKey="Total" stroke="#DC3545" strokeWidth={2} name="Total Ingresos" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="text-center py-12">
                         <BarChart2 size={48} className="mx-auto text-gray-400 mb-4" />
                         <p>No hay datos para mostrar en la gráfica para el año {selectedYear}.</p>
                    </div>
                )}
            </Card>

            <Card title={`Desglose de Ingresos - ${selectedYear}`}>
                {isLoading ? <div className="text-center py-12"><Loader2 className="animate-spin"/></div> :
                currentYearData ? renderIncomeTable() : (
                    <div className="text-center py-12">
                        <DollarSign size={48} className="mx-auto text-gray-400 mb-4" />
                        <p>No hay datos de ingresos para el año {selectedYear}.</p>
                        <p className="text-sm text-gray-500">Carga un archivo de Excel para empezar.</p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default MonthlyIncome;