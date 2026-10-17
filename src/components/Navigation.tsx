'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Dumbbell,
  Hammer,
  Utensils,
  Timer,
  Droplets,
  Moon,
  LineChart,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface NavigationProps {
  userFullName?: string;
  userRole?: string;
  onLogout?: () => void;
}

export default function Navigation({ userFullName, userRole, onLogout }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Define navigation items based on role
  const getMemberNavItems = () => [
    { label: 'Today', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Train', href: '/train', icon: Dumbbell },
    { label: 'Build', href: '/build', icon: Hammer },
    { label: 'Fuel', href: '/fuel', icon: Utensils },
    { label: 'Fasting', href: '/fasting', icon: Timer },
    { label: 'Water', href: '/water', icon: Droplets },
    { label: 'Sleep', href: '/sleep', icon: Moon },
    { label: 'Track', href: '/track', icon: LineChart },
  ];

  const getTrainerNavItems = () => [
    { label: 'Dashboard', href: '/trainer', icon: LayoutDashboard },
    { label: 'My Clients', href: '/trainer', icon: Users },
    { label: 'Schedule', href: '/trainer', icon: LineChart },
  ];

  const getGymOwnerNavItems = () => [
    { label: 'Dashboard', href: '/gym-owner', icon: LayoutDashboard },
    { label: 'Members', href: '/gym-owner', icon: Users },
    { label: 'Staff', href: '/gym-owner', icon: Dumbbell },
    { label: 'Classes', href: '/gym-owner', icon: LineChart },
  ];

  // Select nav items based on role
  let navItems = getMemberNavItems();
  if (userRole === 'trainer') {
    navItems = getTrainerNavItems();
  } else if (userRole === 'gym_owner') {
    navItems = getGymOwnerNavItems();
  }

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem('urji_user');
      localStorage.removeItem('urji_user_id');
      router.push('/login');
    }
  };

  return (
    <>
      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#FCFAF6] border-r border-[#14201A]/10 p-5 sticky top-0 h-screen z-30 justify-between">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 pb-6 mb-6 border-b border-[#14201A]/10">
            <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 30 30" fill="none">
              <circle cx="15" cy="15" r="9" stroke="currentColor" strokeWidth="2.5" className="text-[#0B3D2E]" />
              <circle cx="15" cy="15" r="3" fill="currentColor" className="text-[#0B3D2E]" />
            </svg>
            <div>
              <h1 className="font-serif text-2xl leading-none text-[#0B3D2E] font-medium tracking-tight">
                Urji Fit
              </h1>
              <p className="text-[11px] font-medium uppercase tracking-widest text-[rgb(90,102,96)] mt-0.5">
                Personal Planner
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#0B3D2E] text-[#F2F7D9] shadow-sm font-semibold'
                      : 'text-[rgb(90,102,96)] hover:bg-[#F2F7D9]/60 hover:text-[#14201A]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#F2F7D9]' : 'text-[rgb(90,102,96)]'}`} />
                  {item.label}
                </Link>
              );
            })}

            {(userRole === 'admin' || userRole === 'platform_admin') && (
              <div className="pt-3 mt-3 border-t border-[#14201A]/10">
                <Link
                  href="/admin"
                  className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    pathname === '/admin'
                      ? 'bg-[#0B3D2E] text-[#F2F7D9] shadow-sm font-semibold'
                      : 'text-[#C1502E] hover:bg-[#F2F7D9]/60'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Surface
                </Link>
              </div>
            )}
          </nav>
        </div>

        {/* User profile, theme toggle & logout */}
        <div className="pt-4 border-t border-[#14201A]/10 space-y-3">
          <ThemeToggle variant="sidebar" />

          <div className="flex items-center justify-between px-1">
            <div className="truncate mr-2">
              <p className="text-sm font-semibold text-[#14201A] truncate">
                {userFullName || 'User'}
              </p>
              <p className="text-xs text-[rgb(90,102,96)] truncate">Active Device Bound</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-2 text-[rgb(90,102,96)] hover:text-[#C1502E] hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FCFAF6]/95 backdrop-blur-md border-t border-[#14201A]/10 z-50 px-2 py-1 flex justify-around items-center">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                isActive ? 'text-[#0B3D2E] font-semibold' : 'text-[rgb(90,102,96)]'
              }`}
            >
              <div
                className={`p-1 rounded-full ${
                  isActive ? 'bg-[#F2F7D9] text-[#0B3D2E]' : 'text-current'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/track"
          className={`flex flex-col items-center gap-1 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-colors ${
            pathname === '/track' ? 'text-[#0B3D2E] font-semibold' : 'text-[rgb(90,102,96)]'
          }`}
        >
          <div
            className={`p-1 rounded-full ${
              pathname === '/track' ? 'bg-[#F2F7D9] text-[#0B3D2E]' : 'text-current'
            }`}
          >
            <LineChart className="w-4 h-4" />
          </div>
          Track
        </Link>
        <div className="flex flex-col items-center justify-center px-1">
          <ThemeToggle variant="icon" />
        </div>
      </nav>
    </>
  );
}
