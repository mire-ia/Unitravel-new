
import React, { useState, useEffect } from 'react';
import { CostClassificationItem, CostCenter, Nature, DistributionBasis } from '../types';
import { X } from 'lucide-react';

interface NewAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (newCost: Omit<CostClassificationItem, 'id'>) => void;
    distributionOptions: string[];
    costCenterOptions: CostCenter[];
    natureOptions: Nature[];
    distributionBasisOptions: DistributionBasis[];
}

const NewAccountModal: React.FC<NewAccountModalProps> = ({ 
    isOpen, onClose, onSubmit, distributionOptions, costCenterOptions, natureOptions, distributionBasisOptions 
}) => {
    const initialState = {
        costType: '',
        amount: 0,
        costCenter: costCenterOptions[0],
        nature: natureOptions[0],
        distribution: distributionOptions[0],
        distributionBasis: distributionBasisOptions[0],
    };

    const [newCost, setNewCost] = useState(initialState);

    useEffect(() => {
        if (isOpen) {
            setNewCost(initialState);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewCost(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(newCost);
    };

    const renderSelect = (name: keyof typeof initialState, label: string, options: string[]) => (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
            <select
                id={name}
                name={name}
                value={newCost[name] as string}
                onChange={handleChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
            >
                {options.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-secondary">Crear Nueva Cuenta de Gasto</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="costType" className="block text-sm font-medium text-gray-700">Nombre de la Cuenta (Ej: 6XXXXX - Concepto)</label>
                            <input
                                type="text"
                                id="costType"
                                name="costType"
                                value={newCost.costType}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full pl-3 pr-4 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                            />
                        </div>
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Importe</label>
                            <input
                                type="number"
                                id="amount"
                                name="amount"
                                value={newCost.amount}
                                onChange={handleChange}
                                required
                                step="0.01"
                                className="mt-1 block w-full pl-3 pr-4 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                            />
                        </div>
                        {renderSelect('costCenter', 'Centro de Coste', costCenterOptions)}
                        {renderSelect('nature', 'Naturaleza', natureOptions)}
                        {renderSelect('distribution', 'Repartición', distributionOptions)}
                        {renderSelect('distributionBasis', 'Base Reparto', distributionBasisOptions)}
                    </div>
                    <div className="px-6 py-4 bg-gray-50 text-right space-x-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-secondary border border-transparent rounded-md shadow-sm hover:bg-green-800">
                            Guardar Cuenta
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewAccountModal;
