# Unitravel - Fleet Cost Management

Sistema de gestión y análisis de costes de flota de vehículos para empresa de transporte.

## Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Estilos**: Tailwind CSS
- **Backend/DB**: Google Sheets + Google Apps Script
- **Despliegue**: GitHub Pages (GitHub Actions)

## Funcionalidades

- 📊 **Dashboard** - Vista general con KPIs
- 💰 **Análisis de Costes** - Distribución de costes directos/indirectos por flota
- 🚐 **Gestión de Flota** - Alta/baja de vehículos con coeficientes de tiempo y km
- 📋 **Clasificación de Costes** - Asignación de cuentas contables a centros de coste
- 📈 **Análisis por Vehículo** - Rentabilidad individual por vehículo
- 💵 **Ingresos Mensuales** - Importación y seguimiento de ingresos por vehículo
- 📉 **Amortizaciones** - Control de amortizaciones de vehículos
- 📄 **Importación** - Carga de PyG desde PDF (con IA) y datos desde Excel
- ⚙️ **Configuración** - Ajustes de conexión con Google Sheets

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Arrancar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Preview del build
npm run preview
```

## Despliegue

El despliegue se realiza automáticamente mediante GitHub Actions al hacer push a la rama `main`. El workflow compila el proyecto y lo publica en GitHub Pages.

## Estructura del proyecto

```
src/
├── components/     # Componentes reutilizables (Card, Layout, Sidebar...)
├── pages/          # Páginas de la aplicación
├── lib/            # API de Google Sheets y utilidades
├── hooks/          # Custom hooks
├── types.ts        # Tipos TypeScript
├── constants.tsx   # Constantes de la app
└── App.tsx         # Rutas y componente principal
```
