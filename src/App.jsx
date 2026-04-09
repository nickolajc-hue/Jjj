import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/BottomNav.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Customers from './pages/Customers.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import AddEditCustomer from './pages/AddEditCustomer.jsx';
import Appointments from './pages/Appointments.jsx';
import AddEditAppointment from './pages/AddEditAppointment.jsx';

export default function App() {
  return (
    <HashRouter>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/overblik" replace />} />
            <Route path="/overblik" element={<Dashboard />} />
            <Route path="/kunder" element={<Customers />} />
            <Route path="/kunder/ny" element={<AddEditCustomer />} />
            <Route path="/kunder/:id" element={<CustomerDetail />} />
            <Route path="/kunder/:id/rediger" element={<AddEditCustomer />} />
            <Route path="/kunder/:id/ny-aftale" element={<AddEditAppointment />} />
            <Route path="/aftaler" element={<Appointments />} />
            <Route path="/aftaler/ny" element={<AddEditAppointment />} />
            <Route path="/aftaler/:id/rediger" element={<AddEditAppointment />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </HashRouter>
  );
}
