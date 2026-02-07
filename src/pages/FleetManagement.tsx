
import React, { useState, useEffect } from 'react';
import { Vehicle } from '../types';
import Card from '../components/Card';
import VehicleFormModal from '../components/VehicleFormModal';
import VehicleCard from '../components/VehicleCard';
import { yyyyMmDdToDate } from '../lib/utils';
import { PlusCircle, UploadCloud, Truck, Loader2 } from 'lucide-react';
import { read, utils, WorkBook } from 'xlsx';
import { vehiclesApi, clearCache } from '../lib/googleSheetsApi';

interface FleetManagementProps {
  studyDate: Date;
}

const FleetManagement: React.FC<FleetManagementProps> = ({ studyDate }) => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [vehicleToEdit, setVehicleToEdit] = useState<Vehicle | null>(null);
    
    const studyYear = studyDate.getFullYear();

    useEffect(() => {
        const fetchVehicles = async () => {
            setIsLoading(true);
            const { data, error } = await vehiclesApi.list();
            if (error) {
                setError('Error al cargar la flota: ' + error);
            } else {
                setVehicles(data || []);
            }
            setIsLoading(false);
        };
        fetchVehicles();
    }, []);

    const calculateCoefficient = (vehicle: Vehicle): number => {
        const yearStart = new Date(studyYear, 0, 1);
        const yearEnd = new Date(studyYear, 11, 31);
        const acqDate = yyyyMmDdToDate(vehicle.acquisitionDate);
        const slDate = vehicle.saleDate ? yyyyMmDdToDate(vehicle.saleDate) : null;

        if (acqDate > yearEnd || (slDate && slDate < yearStart)) return 0;
        
        const startDate = acqDate > yearStart ? acqDate : yearStart;
        const endDate = slDate && slDate < yearEnd ? slDate : yearEnd;
        
        let months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
        months -= startDate.getMonth();
        months += endDate.getMonth();
        return (months <= 0 ? 1 : months + 1) / 12;
    };

    const handleOpenModal = (vehicle?: Vehicle) => {
        setVehicleToEdit(vehicle || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => setIsModalOpen(false);

    const handleSubmitVehicle = async (vehicle: Vehicle) => {
        const { error } = await vehiclesApi.upsert(vehicle);
        if (error) {
            alert('Error al guardar el vehículo: ' + error);
        } else {
            clearCache('Vehicles');
            const { data } = await vehiclesApi.list();
            setVehicles(data || []);
        }
        handleCloseModal();
    };
    
    const handleUpdateKms = async (vehicleId: string, year: number, kms: number) => {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        if (!vehicle) return;

        const updatedKms = { ...vehicle.annualKms, [year]: kms };
        
        const { error } = await vehiclesApi.update(vehicleId, { annualKms: updatedKms });
            
        if (error) {
            alert('Error al actualizar los kilómetros.');
        } else {
             setVehicles(prev => prev.map(v => 
                v.id === vehicleId ? { ...v, annualKms: updatedKms } : v
            ));
        }
    };

    const handleSellVehicle = (vehicle: Vehicle) => {
        const saleDate = prompt("Introduce la fecha de venta (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
        if (saleDate) {
            const saleValue = prompt("Introduce el valor de venta:", "0");
            const updatedVehicle = { ...vehicle, saleDate, saleValue: parseFloat(saleValue || '0') };
            handleSubmitVehicle(updatedVehicle);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Implement file upload and batch upsert to Supabase
        alert("La carga de Excel debe implementarse para hacer upsert en Supabase.");
    };

    if (isLoading) return <div className="flex justify-center items-center"><Loader2 className="animate-spin mr-2" /> Cargando flota...</div>
    if (error) return <div className="text-negative text-center">{error}</div>

    const activeVehicles = vehicles.filter(v => calculateCoefficient(v) > 0);
    const inactiveVehicles = vehicles.filter(v => calculateCoefficient(v) === 0);

    return (
        <>
            <Card title="Gestión de Flota de Vehículos">
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 mb-6 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-4">
                        <label htmlFor="excel-upload" className="cursor-pointer inline-flex items-center px-4 py-2 font-bold text-white transition-colors rounded-md shadow-sm bg-secondary hover:bg-green-800">
                            <UploadCloud size={20} className="mr-2"/> Cargar Excel
                        </label>
                        <input id="excel-upload" type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                         <button onClick={() => handleOpenModal()} className="inline-flex items-center px-4 py-2 font-bold text-white transition-colors rounded-md shadow-sm bg-primary hover:bg-orange-700">
                            <PlusCircle size={20} className="mr-2"/> Añadir Vehículo
                        </button>
                    </div>
                     <div className="text-right">
                        <p className="text-sm text-gray-600">Año de estudio actual: <span className="font-bold">{studyYear}</span></p>
                    </div>
                </div>
                
                {vehicles.length > 0 ? (
                    <>
                        <div>
                            <h3 className="text-xl font-semibold text-primary mb-4">Vehículos Activos en {studyYear} ({activeVehicles.length})</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {activeVehicles.map(v => <VehicleCard key={v.id} vehicle={v} onEdit={handleOpenModal} onSell={handleSellVehicle} onUpdateKms={handleUpdateKms} />)}
                            </div>
                        </div>
                         {inactiveVehicles.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-xl font-semibold text-gray-500 mb-4">Vehículos Inactivos o Vendidos en {studyYear} ({inactiveVehicles.length})</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {inactiveVehicles.map(v => <VehicleCard key={v.id} vehicle={v} onEdit={handleOpenModal} onSell={handleSellVehicle} onUpdateKms={handleUpdateKms} />)}
                                </div>
                            </div>
                         )}
                    </>
                ) : (
                     <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <Truck size={48} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Tu flota está vacía</h3>
                        <p className="text-gray-600">Carga tu Excel o añade tu primer vehículo para empezar.</p>
                    </div>
                )}

            </Card>
            <VehicleFormModal isOpen={isModalOpen} onClose={handleCloseModal} onSubmit={handleSubmitVehicle} vehicleToEdit={vehicleToEdit}/>
        </>
    );
};

export default FleetManagement;
