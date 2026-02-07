
import React, { useState } from 'react';
import { Vehicle } from '../types';
import { yyyyMmDdToDate, formatCurrency, formatDate } from '../lib/utils';
import { Edit, LogOut, Plus, Trash2 } from 'lucide-react';

interface VehicleCardProps {
    vehicle: Vehicle;
    onEdit: (vehicle: Vehicle) => void;
    onSell: (vehicle: Vehicle) => void;
    onUpdateKms: (vehicleId: string, year: number, kms: number) => void;
}

const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, onEdit, onSell, onUpdateKms }) => {
    const defaultYears = [2023, 2024, 2025, 2026];
    const existingYears = Object.keys(vehicle.annualKms).map(Number);
    const allYears = [...new Set([...defaultYears, ...existingYears])].sort((a, b) => b - a);

    const [newYear, setNewYear] = useState<number>(new Date().getFullYear() + 1);
    const [newKms, setNewKms] = useState<number>(0);

    const handleAddKms = () => {
        if (newYear && !vehicle.annualKms[newYear]) {
            onUpdateKms(vehicle.id, newYear, newKms);
            setNewYear(new Date().getFullYear() + 1);
            setNewKms(0);
        } else {
            alert('El año ya existe o es inválido.');
        }
    };

    const handleRemoveKms = (year: number) => {
        // Technically, we can't remove a key, but we can set its value to 0 or have a more complex state update.
        // For simplicity, we just zero it out. Or we could pass a remove handler. Let's just update to 0.
        onUpdateKms(vehicle.id, year, 0);
    }

    const DetailItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
        <div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="font-semibold">{value}</p>
        </div>
    );
    
    return (
        <div className="bg-white rounded-lg shadow-md flex flex-col">
            <header className="p-4 border-b bg-gray-50 rounded-t-lg flex justify-between items-center">
                <div>
                    <h4 className="text-lg font-bold text-secondary">{vehicle.licensePlate}</h4>
                    <p className="text-sm text-gray-600">Nº {vehicle.assignedNumber}</p>
                </div>
                <div className="flex items-center space-x-2">
                    {vehicle.saleDate ? (
                        <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">
                            Vendido el {formatDate(yyyyMmDdToDate(vehicle.saleDate))}
                        </span>
                    ) : (
                        <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">Activo</span>
                    )}
                     <button onClick={() => onEdit(vehicle)} className="p-2 text-primary hover:bg-yellow-100 rounded-full"><Edit size={16}/></button>
                </div>
            </header>
            
            <div className="p-4 grid grid-cols-3 gap-4">
                <DetailItem label="Tipo" value={vehicle.type} />
                <DetailItem label="Plazas" value={vehicle.seats} />
                <DetailItem label="Ruedas" value={vehicle.wheels} />
                <DetailItem label="Fecha Adq." value={formatDate(yyyyMmDdToDate(vehicle.acquisitionDate))} />
                <DetailItem label="Valor Adq." value={formatCurrency(vehicle.acquisitionValue)} />
                {!vehicle.saleDate && <button onClick={() => onSell(vehicle)} className="col-span-3 -mt-2 text-sm text-center text-negative font-semibold hover:underline">Vender / Dar de baja</button>}
            </div>

            <div className="p-4 border-t mt-auto">
                <h5 className="font-semibold text-gray-700 mb-2">Kilometraje Anual</h5>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {allYears.map(year => (
                        <div key={year} className="flex items-center gap-2">
                            <label htmlFor={`kms-${vehicle.id}-${year}`} className="w-1/4 font-medium text-sm">{year}</label>
                            <input
                                id={`kms-${vehicle.id}-${year}`}
                                type="number"
                                value={vehicle.annualKms[year] || ''}
                                onChange={(e) => onUpdateKms(vehicle.id, year, parseInt(e.target.value) || 0)}
                                className="w-3/4 p-2 border rounded-md text-right"
                                placeholder="0 km"
                            />
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <input type="number" placeholder="Año" value={newYear} onChange={e => setNewYear(parseInt(e.target.value))} className="w-1/4 p-2 border rounded-md"/>
                    <input type="number" placeholder="Kms" value={newKms} onChange={e => setNewKms(parseInt(e.target.value))} className="w-2/4 p-2 border rounded-md"/>
                    <button onClick={handleAddKms} className="p-2 text-positive hover:bg-green-100 rounded-md"><Plus size={18}/></button>
                </div>
            </div>
        </div>
    );
};

export default VehicleCard;
