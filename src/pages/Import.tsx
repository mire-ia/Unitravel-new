import React, { useState, useCallback, useEffect } from 'react';
import Card from '../components/Card';
import { UploadCloud, FileText, Loader2, AlertTriangle, CheckCircle, FileSpreadsheet, Truck, File } from 'lucide-react';
import { read, utils } from 'xlsx';
import { configApi, financialDataApi, vehiclesApi, clearCache } from '../lib/googleSheetsApi';

type ImportTab = 'financial' | 'fleet';
type FileMode = 'ocr' | 'excel';

const MONTHS = [
    { value: 0, label: 'Anual (todo el año)' },
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
];

interface VehicleData {
    licensePlate: string;
    assignedNumber: number;
    acquisitionDate: string;
    acquisitionValue: number;
    seats: number;
    wheels: number;
    type: 'Normal' | 'Micro' | 'Grande';
    annualAmortization: number;
}

const Import: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ImportTab>('financial');
    const [fileMode, setFileMode] = useState<FileMode>('excel');
    const [file, setFile] = useState<File | null>(null);
    const [docType, setDocType] = useState<'Balance' | 'PyG'>('PyG');
    const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
    const [fiscalMonth, setFiscalMonth] = useState<number>(0); // 0 = anual
    
    const [extractedFinancialData, setExtractedFinancialData] = useState<Array<{concept: string, amount: number}> | null>(null);
    const [extractedFleetData, setExtractedFleetData] = useState<VehicleData[] | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);

    useEffect(() => {
        const loadConfig = async () => {
            setIsLoadingConfig(true);
            const apiKey = await configApi.getGeminiApiKey();
            setGeminiApiKey(apiKey);
            setIsLoadingConfig(false);
        };
        loadConfig();
    }, []);

    const resetState = () => {
        setFile(null);
        setExtractedFinancialData(null);
        setExtractedFleetData(null);
        setError(null);
        setSuccess(null);
    };

    const handleTabChange = (tab: ImportTab) => {
        resetState();
        setActiveTab(tab);
    };

    const handleFileChange = (files: FileList | null) => {
        if (files && files[0]) {
            const fileName = files[0].name.toLowerCase();
            const fileType = files[0].type;
            
            const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv') ||
                           fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                           fileType === 'application/vnd.ms-excel' ||
                           fileType === 'text/csv';
            const isPdfOrImage = fileType === 'application/pdf' || fileType.startsWith('image/');
            
            if (isExcel || isPdfOrImage) {
                setFile(files[0]);
                setFileMode(isExcel ? 'excel' : 'ocr');
                setExtractedFinancialData(null);
                setExtractedFleetData(null);
                setError(null);
                setSuccess(null);
            } else {
                setError('Por favor, sube un archivo Excel (.xlsx), CSV, PDF o imagen.');
            }
        }
    };
    
    const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        handleFileChange(event.dataTransfer.files);
    }, []);

    const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    // ==================== EXCEL PROCESSING ====================
    const processExcelFinancial = async () => {
        if (!file) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const data = await file.arrayBuffer();
            const workbook = read(data, { raw: false });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
            
            const extracted: Array<{concept: string, amount: number}> = [];
            
            // Función para limpiar y convertir números en formato español
            const parseSpanishNumber = (str: string): number | null => {
                if (!str || typeof str !== 'string') return null;
                const cleaned = str.trim().replace(/\s/g, '');
                if (!cleaned || cleaned === '-' || cleaned === '') return null;
                // Formato español: 1.234.567,89 -> 1234567.89
                const normalized = cleaned.replace(/\./g, '').replace(',', '.');
                const num = parseFloat(normalized);
                return isNaN(num) ? null : num;
            };
            
            // Función para verificar si un código es una cuenta contable real
            // Cuentas contables: empiezan con 8+ dígitos (ej: 62600000004)
            const isAccountCode = (code: string): boolean => {
                if (!code || typeof code !== 'string') return false;
                const trimmed = code.trim();
                // Debe empezar con al menos 8 dígitos consecutivos
                return /^\d{8,}/.test(trimmed);
            };
            
            // Función para verificar si una celda es un concepto válido (no subtotal ni sección)
            const isValidConcept = (cell: any): boolean => {
                if (!cell || typeof cell !== 'string') return false;
                const trimmed = cell.trim();
                if (trimmed.length < 3) return false;
                if (trimmed.startsWith('---') || trimmed.startsWith('===')) return false;
                if (trimmed === 'Total' || trimmed === '') return false;
                return true;
            };
            
            // Procesar cada fila buscando cuentas contables
            for (const row of jsonData) {
                if (!row || row.length < 2) continue;
                
                // El CSV tiene formato: [codigo, concepto, importe, vacio, codigo, concepto, importe]
                // Columnas 0-2: ACTIVO, Columnas 4-6: PASIVO
                
                // Procesar lado izquierdo (ACTIVO) - columnas 0, 1, 2
                const codeLeft = row[0]?.toString().trim() || '';
                const conceptLeft = row[1]?.toString().trim() || '';
                const amountLeft = parseSpanishNumber(row[2]?.toString());
                
                // Solo incluir si tiene código de cuenta contable válido
                if (isAccountCode(codeLeft) && isValidConcept(conceptLeft) && amountLeft !== null) {
                    // Guardar código + concepto para identificar mejor
                    extracted.push({ concept: `${codeLeft} ${conceptLeft}`, amount: amountLeft });
                }
                
                // Procesar lado derecho (PASIVO) - columnas 4, 5, 6
                if (row.length >= 7) {
                    const codeRight = row[4]?.toString().trim() || '';
                    const conceptRight = row[5]?.toString().trim() || '';
                    const amountRight = parseSpanishNumber(row[6]?.toString());
                    
                    // Solo incluir si tiene código de cuenta contable válido
                    if (isAccountCode(codeRight) && isValidConcept(conceptRight) && amountRight !== null) {
                        extracted.push({ concept: `${codeRight} ${conceptRight}`, amount: amountRight });
                    }
                }
            }
            
            if (extracted.length === 0) {
                throw new Error('No se encontraron datos válidos. Verifica que el archivo tenga columnas de concepto e importe.');
            }
            
            // Eliminar duplicados por concepto (mantener el último)
            const uniqueMap = new Map<string, {concept: string, amount: number}>();
            for (const item of extracted) {
                uniqueMap.set(item.concept, item);
            }
            const uniqueExtracted = Array.from(uniqueMap.values());
            
            setExtractedFinancialData(uniqueExtracted);
            setSuccess(`Se extrajeron ${uniqueExtracted.length} conceptos del archivo.`);
            
        } catch (e: any) {
            setError(`Error al procesar: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const processExcelFleet = async () => {
        if (!file) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const data = await file.arrayBuffer();
            const workbook = read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = utils.sheet_to_json(worksheet) as any[];
            
            const extracted: VehicleData[] = jsonData.map((row, index) => {
                // Buscar campos por diferentes nombres posibles
                const licensePlate = row.licensePlate || row.matricula || row.Matricula || row.MATRICULA || 
                                    row['Matrícula'] || row.plate || `TEMP-${index + 1}`;
                const seats = Number(row.seats || row.plazas || row.Plazas || row.PLAZAS || row.asientos || 55);
                
                let type: 'Normal' | 'Micro' | 'Grande' = 'Normal';
                if (seats < 30) type = 'Micro';
                else if (seats >= 60) type = 'Grande';
                
                const acquisitionValue = Number(row.acquisitionValue || row.valor || row.Valor || row.precio || row.Precio || 100000);
                
                return {
                    licensePlate: String(licensePlate),
                    assignedNumber: Number(row.assignedNumber || row.numero || row.Numero || row.num || index + 1),
                    acquisitionDate: row.acquisitionDate || row.fecha || row.Fecha || row['Fecha Adquisición'] || '2020-01-01',
                    acquisitionValue,
                    seats,
                    wheels: Number(row.wheels || row.ruedas || row.Ruedas || 6),
                    type,
                    annualAmortization: Number(row.annualAmortization || row.amortizacion || Math.round(acquisitionValue / 10))
                };
            }).filter(v => v.licensePlate && v.licensePlate !== 'undefined');
            
            if (extracted.length === 0) {
                throw new Error('No se encontraron vehículos válidos en el Excel.');
            }
            
            setExtractedFleetData(extracted);
            setSuccess(`Se extrajeron ${extracted.length} vehículos del Excel.`);
            
        } catch (e: any) {
            setError(`Error al procesar Excel: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // ==================== OCR PROCESSING (Gemini) ====================
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const callGeminiAPI = async (base64Data: string, mimeType: string, prompt: string) => {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inline_data: { mime_type: mimeType, data: base64Data } },
                        { text: prompt }
                    ]
                }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Error al llamar a Gemini API');
        }

        const data = await response.json();
        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            throw new Error('Respuesta vacía de Gemini');
        }

        let jsonText = data.candidates[0].content.parts[0].text.trim();
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        try {
            return JSON.parse(jsonText);
        } catch (e) {
            // Intentar limpiar el JSON si tiene errores
            console.error('JSON original:', jsonText);
            throw new Error('El documento es demasiado complejo. Intenta con un Excel o una imagen más simple.');
        }
    };

    const processOCRFinancial = async () => {
        if (!file || !geminiApiKey) return;

        setIsLoading(true);
        setError(null);
        
        try {
            const base64Data = await fileToBase64(file);
            const prompt = `Analiza este documento financiero (${docType === 'Balance' ? 'Balance de Situación' : 'Cuenta de Pérdidas y Ganancias'}).

Extrae los conceptos contables principales con sus importes. Devuelve SOLO un JSON array con máximo 20 elementos, cada uno con "concept" (string corto) y "amount" (number).

Ejemplo de formato esperado:
[{"concept": "Ventas", "amount": 100000}, {"concept": "Gastos personal", "amount": -50000}]

Los gastos deben ser números negativos. Responde SOLO con el JSON array, sin explicaciones.`;

            const extractedArray = await callGeminiAPI(base64Data, file.type, prompt);
            
            if (!Array.isArray(extractedArray) || extractedArray.length === 0) {
                throw new Error('No se pudieron extraer datos del documento');
            }

            setExtractedFinancialData(extractedArray);
            setSuccess(`Se extrajeron ${extractedArray.length} conceptos del documento.`);

        } catch (e: any) {
            setError(`Error al procesar: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const processOCRFleet = async () => {
        if (!file || !geminiApiKey) return;

        setIsLoading(true);
        setError(null);
        
        try {
            const base64Data = await fileToBase64(file);
            const prompt = `Analiza este documento de flota de vehículos.

Extrae la información de los vehículos. Devuelve SOLO un JSON array con objetos que tengan:
- "licensePlate": string (matrícula)
- "assignedNumber": number 
- "acquisitionDate": string (formato YYYY-MM-DD)
- "acquisitionValue": number
- "seats": number
- "wheels": number (4 o 6)
- "type": "Normal" | "Micro" | "Grande"
- "annualAmortization": number

Responde SOLO con el JSON array.`;

            const extractedArray = await callGeminiAPI(base64Data, file.type, prompt);
            
            if (!Array.isArray(extractedArray) || extractedArray.length === 0) {
                throw new Error('No se pudieron extraer vehículos del documento');
            }

            const cleanedData: VehicleData[] = extractedArray.map((v: any, index: number) => ({
                licensePlate: v.licensePlate || `TEMP-${index + 1}`,
                assignedNumber: v.assignedNumber || index + 1,
                acquisitionDate: v.acquisitionDate || '2020-01-01',
                acquisitionValue: Number(v.acquisitionValue) || 100000,
                seats: Number(v.seats) || 55,
                wheels: Number(v.wheels) || 6,
                type: (['Normal', 'Micro', 'Grande'].includes(v.type) ? v.type : 'Normal') as 'Normal' | 'Micro' | 'Grande',
                annualAmortization: Number(v.annualAmortization) || Math.round(Number(v.acquisitionValue) / 10) || 10000
            }));

            setExtractedFleetData(cleanedData);
            setSuccess(`Se extrajeron ${cleanedData.length} vehículos del documento.`);

        } catch (e: any) {
            setError(`Error al procesar: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // ==================== PROCESS HANDLERS ====================
    const processFinancialDocument = () => {
        if (fileMode === 'excel') {
            processExcelFinancial();
        } else {
            processOCRFinancial();
        }
    };

    const processFleetDocument = () => {
        if (fileMode === 'excel') {
            processExcelFleet();
        } else {
            processOCRFleet();
        }
    };

    // ==================== SAVE HANDLERS ====================
    const saveFinancialData = async () => {
        if (!extractedFinancialData) return;

        setIsSaving(true);
        setError(null);
        
        try {
            for (const item of extractedFinancialData) {
                await financialDataApi.upsert({
                    year: fiscalYear,
                    month: fiscalMonth, // 0 = anual, 1-12 = mes específico
                    documentType: docType,
                    concept: item.concept,
                    amount: item.amount
                });
            }
            
            clearCache('FinancialData');
            const periodLabel = fiscalMonth === 0 ? `año ${fiscalYear}` : `${MONTHS[fiscalMonth].label} ${fiscalYear}`;
            setSuccess(`Se guardaron ${extractedFinancialData.length} conceptos para ${periodLabel}.`);
            setExtractedFinancialData(null);
            setFile(null);
        } catch (e: any) {
            setError(`Error al guardar: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const saveFleetData = async () => {
        if (!extractedFleetData) return;

        setIsSaving(true);
        setError(null);
        
        try {
            for (const vehicle of extractedFleetData) {
                await vehiclesApi.upsert({
                    id: vehicle.licensePlate,
                    ...vehicle,
                    saleDate: '',
                    saleValue: 0,
                    annualKms: { 2023: 0, 2024: 0, 2025: 0, 2026: 0 }
                });
            }
            
            clearCache('Vehicles');
            setSuccess(`Se guardaron ${extractedFleetData.length} vehículos en la base de datos.`);
            setExtractedFleetData(null);
            setFile(null);
        } catch (e: any) {
            setError(`Error al guardar: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // ==================== EDIT HANDLERS ====================
    const handleFinancialAmountChange = (index: number, value: string) => {
        if (extractedFinancialData) {
            const numericValue = parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
            const newData = [...extractedFinancialData];
            newData[index] = { ...newData[index], amount: numericValue };
            setExtractedFinancialData(newData);
        }
    };

    const handleFinancialConceptChange = (index: number, value: string) => {
        if (extractedFinancialData) {
            const newData = [...extractedFinancialData];
            newData[index] = { ...newData[index], concept: value };
            setExtractedFinancialData(newData);
        }
    };

    const removeFinancialRow = (index: number) => {
        if (extractedFinancialData) {
            setExtractedFinancialData(extractedFinancialData.filter((_, i) => i !== index));
        }
    };

    const handleFleetFieldChange = (index: number, field: keyof VehicleData, value: any) => {
        if (extractedFleetData) {
            const newData = [...extractedFleetData];
            newData[index] = { ...newData[index], [field]: value };
            setExtractedFleetData(newData);
        }
    };

    const removeFleetRow = (index: number) => {
        if (extractedFleetData) {
            setExtractedFleetData(extractedFleetData.filter((_, i) => i !== index));
        }
    };

    if (isLoadingConfig) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="animate-spin mr-2" />
                Cargando configuración...
            </div>
        );
    }

    const renderUploadArea = () => (
        <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-primary"
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => document.getElementById('file-upload')?.click()}
        >
            <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
                Arrastra un archivo aquí o haz clic para seleccionar
            </p>
            <p className="mt-1 text-xs text-gray-400">
                Excel (.xlsx), CSV, PDF o imagen (JPG, PNG)
            </p>
            <input 
                type="file" 
                id="file-upload" 
                className="hidden" 
                accept=".xlsx,.xls,.csv,.pdf,image/*" 
                onChange={(e) => handleFileChange(e.target.files)}
            />
        </div>
    );

    const renderFileInfo = () => file && (
        <div className="mt-4 p-3 bg-gray-100 rounded-md flex items-center justify-between">
            <div className="flex items-center space-x-2">
                {fileMode === 'excel' ? (
                    <FileSpreadsheet className="text-green-600" />
                ) : (
                    <FileText className="text-primary" />
                )}
                <div>
                    <span className="text-sm font-medium block">{file.name}</span>
                    <span className="text-xs text-gray-500">
                        {fileMode === 'excel' ? 'Procesamiento directo' : 'OCR con Gemini AI'}
                    </span>
                </div>
            </div>
            <button onClick={resetState} className="text-red-500 hover:text-red-700 font-bold">✕</button>
        </div>
    );

    return (
        <div className="space-y-6">
            <Card title="Importación de Documentos">
                {/* Tabs */}
                <div className="flex border-b mb-6">
                    <button
                        onClick={() => handleTabChange('financial')}
                        className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                            activeTab === 'financial' 
                                ? 'border-primary text-primary' 
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <FileSpreadsheet size={18} />
                        Documentos Financieros
                    </button>
                    <button
                        onClick={() => handleTabChange('fleet')}
                        className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                            activeTab === 'fleet' 
                                ? 'border-primary text-primary' 
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Truck size={18} />
                        Flota de Vehículos
                    </button>
                </div>

                {/* Info box */}
                <div className="p-4 mb-6 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                    <File className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="text-sm text-blue-800 font-medium">Formatos soportados</p>
                        <p className="text-sm text-blue-700">
                            <strong>Excel (.xlsx)</strong> - Procesamiento directo, más rápido y fiable<br/>
                            <strong>PDF/Imagen</strong> - OCR con Gemini AI (requiere API Key configurada)
                        </p>
                    </div>
                </div>
                
                {/* ==================== FINANCIAL TAB ==================== */}
                {activeTab === 'financial' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-semibold text-lg mb-4 text-primary">1. Subida de Documento</h3>
                            {renderUploadArea()}
                            {renderFileInfo()}
                            
                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Tipo de documento</label>
                                    <select 
                                        value={docType} 
                                        onChange={(e) => setDocType(e.target.value as 'Balance' | 'PyG')} 
                                        className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md"
                                    >
                                        <option value="Balance">Balance de Situación</option>
                                        <option value="PyG">Cuenta de Pérdidas y Ganancias</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Año</label>
                                        <input 
                                            type="number" 
                                            value={fiscalYear} 
                                            onChange={(e) => setFiscalYear(Number(e.target.value))} 
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Período</label>
                                        <select 
                                            value={fiscalMonth} 
                                            onChange={(e) => setFiscalMonth(Number(e.target.value))} 
                                            className="mt-1 block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md"
                                        >
                                            {MONTHS.map(m => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={processFinancialDocument} 
                                disabled={!file || isLoading || (fileMode === 'ocr' && !geminiApiKey)} 
                                className="mt-6 w-full py-2 px-4 rounded-md text-white bg-secondary hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed flex justify-center items-center"
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando...</>
                                ) : fileMode === 'excel' ? (
                                    'Procesar Excel'
                                ) : (
                                    'Extraer con Gemini AI'
                                )}
                            </button>
                            
                            {fileMode === 'ocr' && !geminiApiKey && (
                                <p className="mt-2 text-sm text-orange-600">
                                    ⚠️ Para usar OCR, configura la API Key de Gemini en el Google Sheet (hoja Config)
                                </p>
                            )}
                            
                            {error && <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
                            {success && <p className="mt-3 text-sm text-green-600 bg-green-50 p-3 rounded">{success}</p>}
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-4 text-primary">2. Revisión y Corrección</h3>
                            {extractedFinancialData && extractedFinancialData.length > 0 ? (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                    {extractedFinancialData.map((item, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                value={item.concept}
                                                onChange={(e) => handleFinancialConceptChange(index, e.target.value)}
                                                className="flex-1 p-2 text-sm border border-gray-300 rounded-md"
                                            />
                                            <input
                                                type="text"
                                                value={new Intl.NumberFormat('es-ES', {minimumFractionDigits: 2}).format(item.amount)}
                                                onChange={(e) => handleFinancialAmountChange(index, e.target.value)}
                                                className="w-32 p-2 text-sm text-right border border-gray-300 rounded-md"
                                            />
                                            <button onClick={() => removeFinancialRow(index)} className="p-2 text-red-500 hover:bg-red-50 rounded">✕</button>
                                        </div>
                                    ))}
                                    
                                    <button 
                                        onClick={saveFinancialData} 
                                        disabled={isSaving}
                                        className="mt-4 w-full py-2 px-4 rounded-md text-white bg-primary hover:bg-orange-700 disabled:bg-gray-400 flex justify-center items-center"
                                    >
                                        {isSaving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando...</> : 'Guardar en Base de Datos'}
                                    </button>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center h-full flex items-center justify-center min-h-[300px]">
                                    <div className="text-gray-500">
                                        <FileText className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                                        <p>Los datos extraídos aparecerán aquí.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ==================== FLEET TAB ==================== */}
                {activeTab === 'fleet' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div>
                            <h3 className="font-semibold text-lg mb-4 text-primary">1. Subida de Documento</h3>
                            {renderUploadArea()}
                            {renderFileInfo()}
                            
                            <p className="mt-4 text-sm text-gray-600">
                                Sube un documento con información de vehículos: matrículas, fechas, precios, plazas, etc.
                            </p>
                            
                            <button 
                                onClick={processFleetDocument} 
                                disabled={!file || isLoading || (fileMode === 'ocr' && !geminiApiKey)} 
                                className="mt-6 w-full py-2 px-4 rounded-md text-white bg-secondary hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed flex justify-center items-center"
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando...</>
                                ) : fileMode === 'excel' ? (
                                    'Procesar Excel'
                                ) : (
                                    'Extraer con Gemini AI'
                                )}
                            </button>
                            
                            {fileMode === 'ocr' && !geminiApiKey && (
                                <p className="mt-2 text-sm text-orange-600">
                                    ⚠️ Para usar OCR, configura la API Key de Gemini en el Google Sheet
                                </p>
                            )}
                            
                            {error && <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
                            {success && <p className="mt-3 text-sm text-green-600 bg-green-50 p-3 rounded">{success}</p>}
                        </div>

                        <div className="lg:col-span-2">
                            <h3 className="font-semibold text-lg mb-4 text-primary">2. Revisión y Corrección</h3>
                            {extractedFleetData && extractedFleetData.length > 0 ? (
                                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                                    {extractedFleetData.map((vehicle, index) => (
                                        <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="font-medium text-secondary">Vehículo #{index + 1}</span>
                                                <button onClick={() => removeFleetRow(index)} className="text-red-500 hover:bg-red-100 px-2 py-1 rounded text-sm">Eliminar</button>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Matrícula</label>
                                                    <input
                                                        type="text"
                                                        value={vehicle.licensePlate}
                                                        onChange={(e) => handleFleetFieldChange(index, 'licensePlate', e.target.value)}
                                                        className="w-full p-2 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Nº Asignado</label>
                                                    <input
                                                        type="number"
                                                        value={vehicle.assignedNumber}
                                                        onChange={(e) => handleFleetFieldChange(index, 'assignedNumber', Number(e.target.value))}
                                                        className="w-full p-2 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Fecha Adquisición</label>
                                                    <input
                                                        type="date"
                                                        value={vehicle.acquisitionDate}
                                                        onChange={(e) => handleFleetFieldChange(index, 'acquisitionDate', e.target.value)}
                                                        className="w-full p-2 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Valor (€)</label>
                                                    <input
                                                        type="number"
                                                        value={vehicle.acquisitionValue}
                                                        onChange={(e) => handleFleetFieldChange(index, 'acquisitionValue', Number(e.target.value))}
                                                        className="w-full p-2 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Plazas</label>
                                                    <input
                                                        type="number"
                                                        value={vehicle.seats}
                                                        onChange={(e) => handleFleetFieldChange(index, 'seats', Number(e.target.value))}
                                                        className="w-full p-2 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Ruedas</label>
                                                    <input
                                                        type="number"
                                                        value={vehicle.wheels}
                                                        onChange={(e) => handleFleetFieldChange(index, 'wheels', Number(e.target.value))}
                                                        className="w-full p-2 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                                                    <select
                                                        value={vehicle.type}
                                                        onChange={(e) => handleFleetFieldChange(index, 'type', e.target.value)}
                                                        className="w-full p-2 text-sm border border-gray-300 rounded"
                                                    >
                                                        <option value="Micro">Micro</option>
                                                        <option value="Normal">Normal</option>
                                                        <option value="Grande">Grande</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Amort. Anual (€)</label>
                                                    <input
                                                        type="number"
                                                        value={vehicle.annualAmortization}
                                                        onChange={(e) => handleFleetFieldChange(index, 'annualAmortization', Number(e.target.value))}
                                                        className="w-full p-2 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <button 
                                        onClick={saveFleetData} 
                                        disabled={isSaving}
                                        className="mt-4 w-full py-3 px-4 rounded-md text-white bg-primary hover:bg-orange-700 disabled:bg-gray-400 flex justify-center items-center font-medium"
                                    >
                                        {isSaving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando...</> : `Guardar ${extractedFleetData.length} vehículos`}
                                    </button>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center h-full flex items-center justify-center min-h-[300px]">
                                    <div className="text-gray-500">
                                        <Truck className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                                        <p>Los vehículos extraídos aparecerán aquí.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default Import;
