
import React, { useState, useEffect } from 'react';
import { Vehicle } from '../types';
import { X, Plus, Trash2 } from 'lucide-react';
import { dateToYyyyMmDd, yyyyMmDdToDate } from '../lib/utils';

interface VehicleFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (vehicle: Vehicle) => void;
    vehicleToEdit?: Vehicle | null;
}

const VehicleFormModal: React.FC<VehicleFormModalProps> = ({ isOpen, onClose, onSubmit, vehicleToEdit }) => {
    const getInitialState = (): Vehicle => {
        return vehicleToEdit || {
            id: '', licensePlate: '', assignedNumber: 0, acquisitionDate: dateToYyyyMmDd(new Date()),
            acquisitionValue: 0, annualAmortization: 0, seats: 0, wheels: 0,
            type: 'Normal', annualKms: {},
        };
    };

    const [vehicle, setVehicle] = useState<Vehicle>(getInitialState);
    const [kmsYear, setKmsYear] = useState<number>(new Date().getFullYear());
    const [kmsValue, setKmsValue] = useState<number>(0);

    useEffect(() => {
        setVehicle(getInitialState());
    }, [vehicleToEdit, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setVehicle(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };

    const handleKmsChange = (year: number, value: string) => {
        const newKms = { ...vehicle.annualKms, [year]: parseInt(value) || 0 };
        setVehicle(prev => ({ ...prev, annualKms: newKms }));
    };
    
    const addKmsEntry = () => {
        if (kmsYear && !vehicle.annualKms[kmsYear]) {
            handleKmsChange(kmsYear, kmsValue.toString());
            setKmsYear(new Date().getFullYear());
            setKmsValue(0);
        }
    }
    
    const removeKmsEntry = (year: number) => {
        const { [year]: _, ...remainingKms } = vehicle.annualKms;
        setVehicle(prev => ({...prev, annualKms: remainingKms}));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const vehicleToSubmit = { ...vehicle, id: vehicle.licensePlate };
        onSubmit(vehicleToSubmit);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-secondary">{vehicleToEdit ? 'Editar Vehículo' : 'Crear Nuevo Vehículo'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Main Info */}
                        <div className="lg:col-span-1">
                            <label htmlFor="licensePlate">Matrícula</label>
                            <input type="text" name="licensePlate" value={vehicle.licensePlate} onChange={handleChange} required disabled={!!vehicleToEdit} className="w-full p-2 border rounded-md disabled:bg-gray-100" />
                        </div>
                        <div className="lg:col-span-1">
                            <label htmlFor="assignedNumber">Número Asignado</label>
                            <input type="number" name="assignedNumber" value={vehicle.assignedNumber} onChange={handleChange} required className="w-full p-2 border rounded-md" />
                        </div>
                        <div className="lg:col-span-1">
                            <label htmlFor="type">Tipo</label>
                            <select name="type" value={vehicle.type} onChange={handleChange} className="w-full p-2 border rounded-md">
                                <option value="Normal">Normal</option>
                                <option value="Micro">Micro</option>
                                <option value="Grande">Grande</option>
                            </select>
                        </div>
                        {/* Acquisition/Sale */}
                        <div className="lg:col-span-1">
                            <label htmlFor="acquisitionDate">Fecha Adquisición</label>
                            <input type="date" name="acquisitionDate" value={vehicle.acquisitionDate} onChange={handleChange} required className="w-full p-2 border rounded-md" />
                        </div>
                         <div className="lg:col-span-1">
                            <label htmlFor="acquisitionValue">Valor Adquisición</label>
                            <input type="number" name="acquisitionValue" value={vehicle.acquisitionValue} onChange={handleChange} step="0.01" required className="w-full p-2 border rounded-md" />
                        </div>
                        <div className="lg:col-span-1">
                            <label htmlFor="annualAmortization">Amortización Anual</label>
                            <input type="number" name="annualAmortization" value={vehicle.annualAmortization} onChange={handleChange} step="0.01" required className="w-full p-2 border rounded-md" />
                        </div>
                         <div className="lg:col-span-1">
                            <label htmlFor="saleDate">Fecha Venta</label>
                            <input type="date" name="saleDate" value={vehicle.saleDate || ''} onChange={handleChange} className="w-full p-2 border rounded-md" />
                        </div>
                        <div className="lg:col-span-1">
                            <label htmlFor="saleValue">Valor Venta</label>
                            <input type="number" name="saleValue" value={vehicle.saleValue || ''} onChange={handleChange} step="0.01" className="w-full p-2 border rounded-md" />
                        </div>
                        {/* Specs */}
                        <div className="lg:col-span-1">
                            <label htmlFor="seats">Plazas</label>
                            <input type="number" name="seats" value={vehicle.seats} onChange={handleChange} required className="w-full p-2 border rounded-md" />
                        </div>
                         <div className="lg:col-span-1">
                            <label htmlFor="wheels">Ruedas</label>
                            <input type="number" name="wheels" value={vehicle.wheels} onChange={handleChange} required className="w-full p-2 border rounded-md" />
                        </div>
                         {/* Annual Kms */}
                        <div className="md:col-span-2 lg:col-span-3">
                            <h3 className="text-lg font-semibold text-gray-700 mb-2 border-t pt-4 mt-2">Kilómetros Anuales</h3>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                {Object.entries(vehicle.annualKms).sort(([a], [b]) => Number(b) - Number(a)).map(([year, kms]) => (
                                    <div key={year} className="flex items-center gap-2">
                                        <input type="number" value={year} readOnly className="w-1/4 p-2 border rounded-md bg-gray-100" />
                                        <input type="number" value={kms} onChange={(e) => handleKmsChange(Number(year), e.target.value)} className="w-2/4 p-2 border rounded-md" />
                                        <button type="button" onClick={() => removeKmsEntry(Number(year))} className="p-2 text-negative hover:bg-red-100 rounded-md"><Trash2 size={18} /></button>
                                    </div>
                                ))}
                            </div>
                             <div className="flex items-center gap-2 mt-2">
                                <input type="number" placeholder="Año" value={kmsYear} onChange={(e) => setKmsYear(parseInt(e.target.value))} className="w-1/4 p-2 border rounded-md" />
                                <input type="number" placeholder="Kms" value={kmsValue} onChange={(e) => setKmsValue(parseInt(e.target.value))} className="w-2/4 p-2 border rounded-md" />
                                <button type="button" onClick={addKmsEntry} className="p-2 text-positive hover:bg-green-100 rounded-md"><Plus size={18} /></button>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 text-right space-x-2 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-secondary border border-transparent rounded-md shadow-sm hover:bg-green-800">
                            {vehicleToEdit ? 'Guardar Cambios' : 'Crear Vehículo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VehicleFormModal;
