
import React from 'react';
import { 
    LayoutDashboard, FileText, BarChart3, Truck, TrendingDown, 
    CalendarDays, Search, ClipboardList, FileUp, Settings 
} from 'lucide-react';

export const NAV_LINKS = [
    { name: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Clasificación de Costes', href: '/cost-classification', icon: <FileText size={20} /> },
    { name: 'Análisis de Costes', href: '/cost-analysis', icon: <BarChart3 size={20} /> },
    { name: 'Flota de Vehículos', href: '/fleet-management', icon: <Truck size={20} /> },
    { name: 'Amortizaciones', href: '/amortization', icon: <TrendingDown size={20} /> },
    { name: 'Ingresos Mensuales', href: '/monthly-income', icon: <CalendarDays size={20} /> },
    { name: 'Análisis por Vehículo', href: '/vehicle-analysis', icon: <Search size={20} /> },
    { name: 'Presupuestos', href: '/quotes', icon: <ClipboardList size={20} /> },
    { name: 'Importar Documentos', href: '/import', icon: <FileUp size={20} /> },
    { name: 'Configuración', href: '/configuration', icon: <Settings size={20} /> },
];
