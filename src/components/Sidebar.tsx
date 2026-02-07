import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_LINKS } from '../constants';
import { X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  return (
    <>
      <div className={`fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsOpen(false)}></div>
      <aside className={`absolute lg:relative inset-y-0 left-0 bg-secondary text-white w-64 space-y-6 py-7 px-2 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200 ease-in-out z-30 flex flex-col`}>
        <div className="px-4 flex justify-between items-center">
          <a href="#" className="flex items-center space-x-2">
            <img src="https://picsum.photos/seed/unitravellogo/40/40" alt="Unitravel Logo" className="h-10 w-10 rounded-full" />
            <span className="text-2xl font-extrabold text-white">Unitravel</span>
          </a>
          <button className="lg:hidden" onClick={() => setIsOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.name}
              to={link.href}
              onClick={() => { if(window.innerWidth < 1024) setIsOpen(false) }}
              className={({ isActive }) =>
                `flex items-center space-x-3 p-2 rounded-md transition-colors duration-200 ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'hover:bg-white hover:bg-opacity-20'
                }`
              }
            >
              {link.icon}
              <span className="font-medium">{link.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
