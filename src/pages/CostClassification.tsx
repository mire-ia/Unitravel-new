
import React, { useState, useEffect, useMemo } from 'react';
import Card from '../components/Card';
import NewAccountModal from '../components/NewAccountModal';
import { CostClassificationItem, CostCenter, Nature, DistributionBasis, Vehicle } from '../types';
import { FileUp, Save, Info, PlusCircle, UploadCloud, Loader2, Trash2 } from 'lucide-react';
import { read, utils, WorkBook } from 'xlsx';
import { costClassificationsApi, vehiclesApi, financialDataApi, clearCache } from '../lib/googleSheetsApi';

const COST_CENTER_OPTIONS: CostCenter[] = ['DIRECTO', 'INDIRECTO'];
const NATURE_OPTIONS: Nature[] = ['FIJO', 'VARIABLE'];
const DISTRIBUTION_BASIS_OPTIONS: DistributionBasis[] = ['Kilómetros', 'Meses'];
const STATIC_DISTRIBUTION_OPTIONS = ['General', 'otras empresas', 'amortización'];

const CostClassification: React.FC = () => {
  const [costs, setCosts] = useState<CostClassificationItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unclassifiedAccounts, setUnclassifiedAccounts] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: costsData, error: costsError } = await costClassificationsApi.list();
        if (costsError) throw new Error(costsError);
        setCosts(costsData || []);

        const { data: vehiclesData, error: vehiclesError } = await vehiclesApi.list();
        if (vehiclesError) throw new Error(vehiclesError);
        setVehicles(vehiclesData as any || []);

        // Cargar datos financieros (PyG) para detectar cuentas no clasificadas
        const { data: financialData, error: financialError } = await financialDataApi.list();
        if (!financialError && financialData) {
          // Función para verificar si es una cuenta contable real (código 8+ dígitos)
          // Y NO es una cuenta de ingresos (las que empiezan por 7)
          const isExpenseAccountCode = (concept: string): boolean => {
            if (!concept || typeof concept !== 'string') return false;
            const trimmed = concept.trim();
            // Debe empezar con 8+ dígitos Y NO empezar por 7 (ingresos)
            return /^\d{8,}/.test(trimmed) && !trimmed.startsWith('7');
          };
          
          // Extraer cuentas de PyG que son GASTOS (no ingresos) Y tienen código contable real
          const pygAccounts = financialData
            .filter((item: any) => item.documentType === 'PyG' && isExpenseAccountCode(item.concept))
            .map((item: any) => item.concept);
          
          // Filtrar las que ya están clasificadas (comparar por código de cuenta)
          const extractCode = (s: string) => s.match(/^(\d{8,})/)?.[1] || '';
          const classifiedCodes = new Set((costsData || []).map((c: any) => extractCode(c.costType)));
          const unclassified = pygAccounts.filter((acc: string) => !classifiedCodes.has(extractCode(acc)));
          setUnclassifiedAccounts([...new Set(unclassified)]); // Eliminar duplicados
        }

      } catch (err: any) {
        setError("Error al cargar los datos: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const distributionOptions = useMemo(() => {
    const vehicleDistributionOptions = vehicles.map(v => v.licensePlate);
    return [...STATIC_DISTRIBUTION_OPTIONS, ...vehicleDistributionOptions];
  }, [vehicles]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Implement file upload and batch insert to Supabase if needed
      alert("La carga de Excel debe implementarse para insertar en Supabase.");
  };

  const handleUpdate = async (id: number, field: keyof CostClassificationItem, value: any) => {
    const originalCosts = [...costs];
    const updatedCosts = costs.map(cost => (cost.id === id ? { ...cost, [field]: value } : cost));
    setCosts(updatedCosts);

    const { error } = await costClassificationsApi.update(id, field, value);

    if (error) {
        alert("Error al guardar el cambio. Reintentando...");
        setCosts(originalCosts);
    }
  };
  
  const handleAddNewCost = async (newCost: Omit<CostClassificationItem, 'id'>) => {
    try {
      // Generar un nuevo ID
      const maxId = costs.reduce((max, c) => Math.max(max, c.id), 0);
      const costWithId = { ...newCost, id: maxId + 1 };
      
      const { error } = await costClassificationsApi.insert(costWithId);

      if (error) {
          alert("Error al añadir la cuenta: " + error);
      } else {
          // Añadir a la lista de costes
          setCosts(prev => [...prev, costWithId as CostClassificationItem]);
          // Quitar de la lista de pendientes
          setUnclassifiedAccounts(prev => prev.filter(acc => acc !== newCost.costType));
          setIsModalOpen(false);
      }
    } catch (err: any) {
      alert("Error al añadir la cuenta: " + err.message);
    }
  };

  const handleQuickAdd = async (accountName: string) => {
      const newCostItem: Omit<CostClassificationItem, 'id'> = {
          costType: accountName,
          amount: 0,
          costCenter: 'INDIRECTO',
          nature: 'FIJO',
          distribution: 'General',
          distributionBasis: 'Meses',
      };
      await handleAddNewCost(newCostItem);
  };

  const handleDelete = async (cost: CostClassificationItem) => {
    if (!confirm(`¿Seguro que quieres desclasificar "${cost.costType}"?`)) return;
    
    try {
      const { error } = await costClassificationsApi.delete(cost.id);
      if (error) {
        alert("Error al desclasificar: " + error);
      } else {
        // Quitar de la lista de clasificados
        setCosts(prev => prev.filter(c => c.id !== cost.id));
        // Añadir a pendientes si es una cuenta contable real (empieza por 8+ dígitos y no por 7)
        if (/^\d{8,}/.test(cost.costType) && !cost.costType.startsWith('7')) {
          setUnclassifiedAccounts(prev => [...prev, cost.costType]);
        }
      }
    } catch (err: any) {
      alert("Error al desclasificar: " + err.message);
    }
  };
  
  if (isLoading) return <div className="flex justify-center items-center"><Loader2 className="animate-spin mr-2" /> Cargando datos...</div>
  if (error) return <div className="text-negative text-center">{error}</div>

  return (
    <>
    <Card title="Clasificación de Costes (Gastos)">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 mb-6 bg-gray-50 rounded-lg border">
          <div className="flex items-center gap-4">
              <label htmlFor="excel-upload" className="cursor-pointer inline-flex items-center px-4 py-2 font-bold text-white transition-colors rounded-md shadow-sm bg-secondary hover:bg-green-800">
                  <UploadCloud size={20} className="mr-2"/>
                  Cargar Excel
              </label>
              <input id="excel-upload" type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
               <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center px-4 py-2 font-bold text-white transition-colors rounded-md shadow-sm bg-primary hover:bg-orange-700">
                  <PlusCircle size={20} className="mr-2"/>
                  Crear Cuenta Nueva
              </button>
          </div>
      </div>

      {unclassifiedAccounts.length > 0 && (
          <Card title="Cuentas Pendientes de Clasificar" className="mb-6 border-l-4 border-highlight bg-yellow-50" titleClassName="text-yellow-800">
              <p className="text-sm text-yellow-700 mb-4">Hemos detectado las siguientes cuentas en tus datos de Pérdidas y Ganancias que aún no han sido clasificadas. Por favor, añádelas para asegurar un análisis de costes completo.</p>
              <ul className="space-y-2">
                  {unclassifiedAccounts.map(acc => (
                      <li key={acc} className="flex items-center justify-between p-2 bg-white rounded-md">
                          <span className="font-medium">{acc}</span>
                          <button onClick={() => handleQuickAdd(acc)} className="text-sm text-positive font-semibold hover:underline">Añadir y clasificar</button>
                      </li>
                  ))}
              </ul>
          </Card>
      )}

      {costs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Info size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Aún no hay datos cargados</h3>
            <p className="text-gray-600">Utiliza los botones de arriba para cargar tus cuentas desde un archivo Excel o para crearlas manualmente.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-700">
                <thead className="text-xs text-white uppercase bg-secondary">
                    <tr>
                        <th scope="col" className="px-4 py-3 w-2/5">Cuenta de Gasto</th>
                        <th scope="col" className="px-4 py-3 text-center">Centro de Coste</th>
                        <th scope="col" className="px-4 py-3 text-center">Naturaleza</th>
                        <th scope="col" className="px-4 py-3 text-center">Repartición</th>
                        <th scope="col" className="px-4 py-3 text-center">Base Reparto</th>
                        <th scope="col" className="px-4 py-3 w-16 text-center"></th>
                    </tr>
                </thead>
                <tbody>
                    {costs.map(cost => (
                        <tr key={cost.id} className="bg-white border-b hover:bg-gray-50 align-middle">
                            <td className="px-4 py-4 font-medium text-gray-900">{cost.costType}</td>
                            <td className="px-2 py-3">
                                <select 
                                    value={cost.costCenter} 
                                    onChange={e => handleUpdate(cost.id, 'costCenter', e.target.value)} 
                                    className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary text-center"
                                >
                                    {COST_CENTER_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                                </select>
                            </td>
                            <td className="px-2 py-3">
                                <select 
                                    value={cost.nature} 
                                    onChange={e => handleUpdate(cost.id, 'nature', e.target.value)} 
                                    className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary text-center"
                                >
                                    {NATURE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                                </select>
                            </td>
                            <td className="px-2 py-3">
                                <select 
                                    value={cost.distribution} 
                                    onChange={e => handleUpdate(cost.id, 'distribution', e.target.value)} 
                                    className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary text-center"
                                >
                                    {distributionOptions.map(option => <option key={option} value={option}>{option}</option>)}
                                </select>
                            </td>
                            <td className="px-2 py-3">
                                <select 
                                    value={cost.distributionBasis} 
                                    onChange={e => handleUpdate(cost.id, 'distributionBasis', e.target.value)} 
                                    className="w-full p-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary text-center"
                                >
                                    {DISTRIBUTION_BASIS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                                </select>
                            </td>
                            <td className="px-2 py-3 text-center">
                                <button 
                                    onClick={() => handleDelete(cost)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    title="Desclasificar"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}
    </Card>
     <NewAccountModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddNewCost}
        distributionOptions={distributionOptions}
        costCenterOptions={COST_CENTER_OPTIONS}
        natureOptions={NATURE_OPTIONS}
        distributionBasisOptions={DISTRIBUTION_BASIS_OPTIONS}
    />
    </>
  );
};

export default CostClassification;
