
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';

const Layout: React.FC = () => {
    const [isSidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="flex h-screen bg-gray-100 text-base-text">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setSidebarOpen} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white shadow-md p-4 flex items-center lg:hidden">
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-gray-600 focus:outline-none">
                        {isSidebarOpen ? <X /> : <Menu />}
                    </button>
                    <h1 className="text-xl font-semibold ml-4 text-secondary">Unitravel</h1>
                </header>
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
