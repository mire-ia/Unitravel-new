
import React, { useState } from 'react';
import { AmortizationAccount } from '../types';
import { yyyyMmDdToDate, formatCurrency, formatDate } from '../lib/utils';
import { Edit, LogOut, Plus } from 'lucide-react';

interface AmortizationCardProps {
    account: AmortizationAccount;
    onEdit: (account: AmortizationAccount) => void;
    onEnd: (account: AmortizationAccount) => void;
    onUpdateAnnualValue: (accountId: string, year: number, value: number) => void;
}

const AmortizationCard: React.FC<AmortizationCardProps> = ({ account, onEdit, onEnd, onUpdateAnnualValue }) => {
    const currentYear = new Date().getFullYear();
    const defaultYears = [currentYear, 2025, 2024, 2023];
    const existingYears = Object.keys(account.annualValues).map(Number);
    const allYears = [...new Set([...defaultYears, ...existingYears])].sort((a, b) => b - a);

    const [newYear, setNewYear] = useState<number>(currentYear + 1);

    const handleAddYear = () => {
        if (newYear && !account.annualValues[newYear]) {
            onUpdateAnnualValue(account.id, newYear, account.annualAmount); // Default to annual amount
            setNewYear(prev => prev + 1);
        } else {
            alert('El año ya existe o es inválido.');
        }
    };

    const monthlyAmount = account.annualAmount / 12;

    const DetailItem: React.FC<{ label: string; value: string | number; className?: string }> = ({ label, value, className }) => (
        <div className={className}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="font-semibold">{value}</p>
        </div>
    );
    
    return (
        <div className="bg-white rounded-lg shadow-md flex flex-col">
            <header className="p-4 border-b bg-gray-50 rounded-t-lg flex justify-between items-center">
                <div>
                    <h4 className="text-lg font-bold text-secondary">{account.name}</h4>
                    <p className="text-sm text-gray-600">Iniciada el {formatDate(yyyyMmDdToDate(account.startDate))}</p>
                </div>
                 <div className="flex items-center space-x-2">
                    {account.endDate ? (
                        <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">
                            Finalizada
                        </span>
                    ) : (
                        <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">Activa</span>
                    )}
                     <button onClick={() => onEdit(account)} className="p-2 text-primary hover:bg-yellow-100 rounded-full"><Edit size={16}/></button>
                </div>
            </header>
            
            <div className="p-4 grid grid-cols-3 gap-4">
                <DetailItem label="Valor Total" value={formatCurrency(account.totalValue)} className="col-span-1"/>
                <DetailItem label="Importe Anual" value={formatCurrency(account.annualAmount)} className="col-span-1"/>
                <DetailItem label="Importe Mensual" value={formatCurrency(monthlyAmount)} className="col-span-1"/>
                {!account.endDate && <button onClick={() => onEnd(account)} className="col-span-3 -mt-2 text-sm text-center text-negative font-semibold hover:underline">Finalizar Amortización</button>}
            </div>

            <div className="p-4 border-t mt-auto">
                <h5 className="font-semibold text-gray-700 mb-2">Desglose Anual</h5>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {allYears.map(year => (
                        <div key={year} className="flex items-center gap-2">
                            <label htmlFor={`val-${account.id}-${year}`} className="w-1/4 font-medium text-sm">{year}</label>
                            <input
                                id={`val-${account.id}-${year}`}
                                type="text"
                                value={new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(account.annualValues[year] || 0)}
                                onChange={(e) => {
                                    const rawValue = e.target.value.replace(/[^0-9,-]+/g, "").replace(',', '.');
                                    onUpdateAnnualValue(account.id, year, parseFloat(rawValue) || 0)
                                }}
                                className="w-3/4 p-2 border rounded-md text-right"
                            />
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <input type="number" placeholder="Año" value={newYear} onChange={e => setNewYear(parseInt(e.target.value))} className="w-1/3 p-2 border rounded-md"/>
                    <button onClick={handleAddYear} className="w-2/3 flex items-center justify-center p-2 text-sm font-medium text-positive hover:bg-green-50 border border-dashed rounded-md">
                        <Plus size={16} className="mr-1"/> Añadir Año
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AmortizationCard;
