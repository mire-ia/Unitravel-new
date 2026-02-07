
import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import { AmortizationAccount } from '../types';
import { PlusCircle, Archive, Loader2 } from 'lucide-react';
import { yyyyMmDdToDate } from '../lib/utils';
import AmortizationCard from '../components/AmortizationCard';
import AmortizationFormModal from '../components/AmortizationFormModal';
import { amortizationApi, clearCache } from '../lib/googleSheetsApi';

const Amortization: React.FC = () => {
    const [accounts, setAccounts] = useState<AmortizationAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [accountToEdit, setAccountToEdit] = useState<AmortizationAccount | null>(null);

    const studyYear = new Date().getFullYear();

    useEffect(() => {
        const fetchAmortizationAccounts = async () => {
            setIsLoading(true);
            const { data, error } = await amortizationApi.list();
            if (error) {
                setError('Error al cargar las amortizaciones: ' + error);
            } else {
                setAccounts(data || []);
            }
            setIsLoading(false);
        };
        fetchAmortizationAccounts();
    }, []);

    const handleOpenModal = (account?: AmortizationAccount) => {
        setAccountToEdit(account || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setAccountToEdit(null);
    };

    const handleSubmitAccount = async (account: AmortizationAccount) => {
        const { error } = await amortizationApi.upsert(account);
        if (error) {
            alert('Error al guardar la cuenta: ' + error);
        } else {
            clearCache('AmortizationAccounts');
            const { data } = await amortizationApi.list();
            setAccounts(data || []);
        }
        handleCloseModal();
    };

    const handleEndAmortization = (account: AmortizationAccount) => {
        const endDate = prompt("Introduce la fecha de finalización (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
        if (endDate) {
            const updatedAccount = { ...account, endDate };
            handleSubmitAccount(updatedAccount);
        }
    };
    
    const handleUpdateAnnualValue = async (accountId: string, year: number, value: number) => {
        const account = accounts.find(acc => acc.id === accountId);
        if (!account) return;

        const updatedValues = { ...account.annualValues, [year]: value };
        
        const { error } = await amortizationApi.update(accountId, { annualValues: updatedValues });
            
        if (error) {
            alert('Error al actualizar el valor anual.');
        } else {
             setAccounts(prev => prev.map(acc => 
                acc.id === accountId ? { ...acc, annualValues: updatedValues } : acc
            ));
        }
    };

    if (isLoading) return <div className="flex justify-center items-center"><Loader2 className="animate-spin mr-2" /> Cargando amortizaciones...</div>;
    if (error) return <div className="text-negative text-center">{error}</div>;

    const isActive = (account: AmortizationAccount) => {
        if (account.endDate) {
            return yyyyMmDdToDate(account.endDate) >= new Date(studyYear, 0, 1);
        }
        return true;
    };

    const activeAccounts = accounts.filter(isActive);
    const completedAccounts = accounts.filter(acc => !isActive(acc));

    return (
        <>
            <Card title="Gestión de Amortizaciones">
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 mb-6 bg-gray-50 rounded-lg border">
                    <button onClick={() => handleOpenModal()} className="inline-flex items-center px-4 py-2 font-bold text-white transition-colors rounded-md shadow-sm bg-primary hover:bg-orange-700">
                        <PlusCircle size={20} className="mr-2"/>
                        Añadir Cuenta de Amortización
                    </button>
                </div>

                {accounts.length > 0 ? (
                    <>
                        <div>
                            <h3 className="text-xl font-semibold text-primary mb-4">Amortizaciones Activas ({activeAccounts.length})</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {activeAccounts.map(acc => (
                                    <AmortizationCard 
                                        key={acc.id} 
                                        account={acc} 
                                        onEdit={handleOpenModal} 
                                        onEnd={handleEndAmortization}
                                        onUpdateAnnualValue={handleUpdateAnnualValue} 
                                    />
                                ))}
                            </div>
                        </div>
                        {completedAccounts.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-xl font-semibold text-gray-500 mb-4">Amortizaciones Completadas ({completedAccounts.length})</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {completedAccounts.map(acc => (
                                        <AmortizationCard 
                                            key={acc.id} 
                                            account={acc} 
                                            onEdit={handleOpenModal} 
                                            onEnd={handleEndAmortization}
                                            onUpdateAnnualValue={handleUpdateAnnualValue} 
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <Archive size={48} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">No hay cuentas de amortización</h3>
                        <p className="text-gray-600">Añade tu primera cuenta para empezar a gestionar las amortizaciones.</p>
                    </div>
                )}
            </Card>

            <AmortizationFormModal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                onSubmit={handleSubmitAccount} 
                accountToEdit={accountToEdit}
            />
        </>
    );
};

export default Amortization;
