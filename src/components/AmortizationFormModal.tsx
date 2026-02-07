
import React, { useState, useEffect } from 'react';
import { AmortizationAccount } from '../types';
import { X } from 'lucide-react';
import { dateToYyyyMmDd } from '../lib/utils';

interface AmortizationFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (account: AmortizationAccount) => void;
    accountToEdit?: AmortizationAccount | null;
}

const AmortizationFormModal: React.FC<AmortizationFormModalProps> = ({ isOpen, onClose, onSubmit, accountToEdit }) => {
    const getInitialState = (): AmortizationAccount => {
        const currentYear = new Date().getFullYear();
        return accountToEdit || {
            id: '',
            name: '',
            totalValue: 0,
            startDate: dateToYyyyMmDd(new Date()),
            annualAmount: 0,
            annualValues: { [currentYear]: 0 },
        };
    };

    const [account, setAccount] = useState<AmortizationAccount>(getInitialState);

    useEffect(() => {
        setAccount(getInitialState());
    }, [accountToEdit, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setAccount(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Use name to create a URL-friendly ID
        const id = account.id || account.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const accountToSubmit = { ...account, id };
        
        // When annual amount changes, update the current year's value as a default
        if (!accountToSubmit.annualValues[new Date().getFullYear()] || accountToEdit?.annualAmount !== accountToSubmit.annualAmount) {
             accountToSubmit.annualValues[new Date().getFullYear()] = accountToSubmit.annualAmount;
        }

        onSubmit(accountToSubmit);
    };

    const FormField: React.FC<{ name: keyof AmortizationAccount, label: string, type?: string, required?: boolean }> = ({ name, label, type = 'text', required = false }) => (
        <div>
            <label htmlFor={name.toString()} className="block text-sm font-medium text-gray-700">{label}</label>
            <input
                type={type}
                name={name.toString()}
                id={name.toString()}
                value={account[name] as any || ''}
                onChange={handleChange}
                required={required}
                step={type === 'number' ? '0.01' : undefined}
                className="mt-1 block w-full pl-3 pr-4 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
            />
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-secondary">{accountToEdit ? 'Editar Cuenta' : 'Nueva Cuenta de Amortización'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                           <FormField name="name" label="Nombre de la Cuenta" required />
                        </div>
                        <FormField name="totalValue" label="Valor Total a Amortizar" type="number" required />
                        <FormField name="annualAmount" label="Importe Anual" type="number" required />
                        <FormField name="startDate" label="Fecha de Inicio" type="date" required />
                        <FormField name="endDate" label="Fecha de Fin (Opcional)" type="date" />
                    </div>
                    <div className="px-6 py-4 bg-gray-50 text-right space-x-2 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-secondary border border-transparent rounded-md shadow-sm hover:bg-green-800">
                            {accountToEdit ? 'Guardar Cambios' : 'Crear Cuenta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AmortizationFormModal;
