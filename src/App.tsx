import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CostClassification from './pages/CostClassification';
import CostAnalysis from './pages/CostAnalysis';
import FleetManagement from './pages/FleetManagement';
import Amortization from './pages/Amortization';
import MonthlyIncome from './pages/MonthlyIncome';
import VehicleAnalysis from './pages/VehicleAnalysis';
import Quotes from './pages/Quotes';
import Import from './pages/Import';
import Configuration from './pages/Configuration';

const App: React.FC = () => {
  const [studyDate, setStudyDate] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), 11, 31);
  });

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard studyDate={studyDate} setStudyDate={setStudyDate} />} />
          <Route path="cost-classification" element={<CostClassification />} />
          <Route path="cost-analysis" element={<CostAnalysis studyDate={studyDate} />} />
          <Route path="fleet-management" element={<FleetManagement studyDate={studyDate} />} />
          <Route path="amortization" element={<Amortization />} />
          <Route path="monthly-income" element={<MonthlyIncome />} />
          <Route path="vehicle-analysis" element={<VehicleAnalysis />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="import" element={<Import />} />
          <Route path="configuration" element={<Configuration />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;
