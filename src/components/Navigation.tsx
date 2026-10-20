'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  ContactRound,
  CreditCard,
  CircleDollarSign,
  ChevronDown,
  Droplets,
  Dumbbell,
  FileSignature,
  Flame,
  Hammer,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  MoreHorizontal,
  ShieldCheck,
  Timer,
  Utensils,
  Users,
  X,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface NavigationProps {
  userFullName?: string;
  userRole?: string;
  onLogout?: () => void;
}

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

const memberGroups: NavGroup[] = [
  {
    label: 'Home & community',
    items: [
      { label: 'Today', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Updates', href: '/notifications', icon: Bell },
      { label: 'My gym', href: '/gym', icon: ShieldCheck },
      { label: 'Classes', href: '/classes', icon: CalendarDays },
      { label: 'Coach plans', href: '/coaching', icon: BookOpenCheck },
    ],
  },
  {
    label: 'Training',
    items: [
      { label: 'Train', href: '/train', icon: Dumbbell },
      { label: 'Build workouts', href: '/build', icon: Hammer },
      { label: 'Progress', href: '/track', icon: BarChart3 },
    ],
  },
  {
    label: 'Wellness',
    items: [
      { label: 'Nutrition', href: '/fuel', icon: Utensils },
      { label: 'Fasting', href: '/fasting', icon: Timer },
      { label: 'Water', href: '/water', icon: Droplets },
      { label: 'Sleep', href: '/sleep', icon: Moon },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Payments', href: '/payments', icon: CreditCard },
      { label: 'Profile', href: '/profile', icon: ContactRound },
      { label: 'Waivers', href: '/waivers', icon: FileSignature },
    ],
  },
];

const trainerItems: NavItem[] = [
  { label: 'Dashboard', href: '/trainer', icon: LayoutDashboard },
  { label: 'Earnings', href: '/trainer/earnings', icon: CircleDollarSign },
  { label: 'Schedule', href: '/trainer/schedule', icon: CalendarDays },
  { label: 'Programs', href: '/trainer/programs', icon: BookOpenCheck },
  { label: 'Messages', href: '/trainer/messages', icon: MessageSquare },
];

const ownerItems: NavItem[] = [
  { label: 'Dashboard', href: '/gym-owner', icon: LayoutDashboard },
  { label: 'Operations', href: '/gym-owner/operations', icon: BriefcaseBusiness },
  { label: 'Billing', href: '/gym-owner/payments', icon: CreditCard },
  { label: 'POS & Inventory', href: '/gym-owner/pos', icon: BriefcaseBusiness },
  { label: 'Reports', href: '/gym-owner/reports', icon: BarChart3 },
  { label: 'Members', href: '/gym-owner', icon: Users },
  { label: 'Staff', href: '/gym-owner', icon: Dumbbell },
  { label: 'Classes', href: '/gym-owner', icon: Activity },
];

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/dashboard' && href !== '/gym-owner' && pathname.startsWith(`${href}/`));
}

function NavigationLink({
  item,
  pathname,
  onClick,
  compact = false,
}: {
  item: NavItem;
  pathname: string;
  onClick?: () => void;
  compact?: boolean;
}) {
  const Icon = item.icon;
  const active = isActivePath(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center rounded-xl font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D2E] ${
        compact ? 'gap-3 px-3 py-3 text-sm' : 'gap-3.5 px-3.5 py-2.5 text-sm'
      } ${
        active
          ? 'bg-[#0B3D2E] font-semibold text-[#F2F7D9] shadow-sm'
          : 'text-[#5A6660] hover:bg-[#F2F7D9]/70 hover:text-[#14201A]'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#F2F7D9]' : 'text-[#5A6660]'}`} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function Navigation({ userFullName, userRole, onLogout }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    // Close the drawer after browser or link navigation changes the active route.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreOpen]);

  const groups: NavGroup[] =
    userRole === 'member' || userRole === 'admin' || userRole === 'platform_admin'
      ? memberGroups
      : [{ label: userRole === 'trainer' ? 'Coaching workspace' : 'Gym workspace', items: userRole === 'trainer' ? trainerItems : ownerItems }];
  const allItems = groups.flatMap((group) => group.items);
  const primaryItems: NavItem[] =
    userRole === 'member'
      ? [
          memberGroups[0].items[0],
          memberGroups[1].items[0],
          memberGroups[2].items[0],
          memberGroups[0].items[2],
        ]
      : allItems.slice(0, 4);
  const activeItem = allItems.find((item) => isActivePath(pathname, item.href));
  const hasOverflowItems = allItems.some((item) => !primaryItems.includes(item));

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      void fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('urji_user');
      localStorage.removeItem('urji_user_id');
      router.push('/login');
    }
  };

  return (
    <>
      <aside className="hidden h-dvh w-72 shrink-0 flex-col border-r border-[#14201A]/10 bg-[#FCFAF6] px-5 py-6 lg:sticky lg:top-0 lg:flex">
        <div className="flex min-h-0 flex-1 flex-col">
          <Link href={userRole === 'member' ? '/dashboard' : userRole === 'trainer' ? '/trainer' : '/gym-owner'} className="mb-5 flex shrink-0 items-center gap-3 border-b border-[#14201A]/10 px-2 pb-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0B3D2E] text-[#F2F7D9]">
              <Flame className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-serif text-2xl leading-none text-[#0B3D2E]">Urji Fit</span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5A6660]">Your fitness space</span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {groups.map((group) => {
              const groupActive = group.items.some((item) => isActivePath(pathname, item.href));
              return (
                <details key={group.label} className="group/nav rounded-2xl" open={groupActive}>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#5A6660] hover:bg-[#F3EFE5] [&::-webkit-details-marker]:hidden">
                    {group.label}
                    <ChevronDown className="h-4 w-4 text-[#5A6660] transition-transform group-open/nav:rotate-180" />
                  </summary>
                  <div className="mt-1 space-y-1 pb-2">
                    {group.items.map((item) => (
                      <NavigationLink key={item.label} item={item} pathname={pathname} />
                    ))}
                  </div>
                </details>
              );
            })}
            {(userRole === 'admin' || userRole === 'platform_admin') && (
              <div className="border-t border-[#14201A]/10 pt-3">
                <NavigationLink item={{ label: 'Admin surface', href: '/admin', icon: ShieldCheck }} pathname={pathname} />
              </div>
            )}
          </nav>
        </div>

        <div className="mt-4 shrink-0 space-y-3 border-t border-[#14201A]/10 pt-4">
          <ThemeToggle variant="sidebar" />
          <div className="flex items-center gap-3 px-1">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2F7D9] font-semibold text-[#0B3D2E]">
              {userFullName?.trim().charAt(0).toUpperCase() || 'U'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#14201A]">{userFullName || 'User'}</p>
              <p className="truncate text-xs capitalize text-[#5A6660]">{userRole?.replaceAll('_', ' ') || 'Member'}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#5A6660] transition-colors hover:bg-[#FBE9E1] hover:text-[#C1502E]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <nav
        aria-label="App navigation"
        className="member-mobile-nav fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-[#14201A]/10 bg-[#FCFAF6]/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(20,32,26,0.06)] backdrop-blur-xl lg:hidden"
      >
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-w-0 min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors ${
                active ? 'text-[#0B3D2E]' : 'text-[#5A6660]'
              }`}
            >
              <span className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? 'bg-[#F2F7D9]' : ''}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="max-w-full truncate">{item.label === 'Nutrition' ? 'Fuel' : item.label}</span>
            </Link>
          );
        })}
        {hasOverflowItems && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={`flex min-w-0 min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold ${
              moreOpen || (activeItem && !primaryItems.includes(activeItem)) ? 'text-[#0B3D2E]' : 'text-[#5A6660]'
            }`}
          >
            <span className={`flex h-7 w-12 items-center justify-center rounded-full ${moreOpen || (activeItem && !primaryItems.includes(activeItem)) ? 'bg-[#F2F7D9]' : ''}`}>
              {moreOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
            </span>
            More
          </button>
        )}
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="presentation">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-[#14201A]/35 backdrop-blur-[2px]"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-menu-title"
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[28px] border-t border-[#14201A]/10 bg-[#FCFAF6] px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#14201A]/15" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5A6660]">{userFullName || 'Your account'}</p>
                <h2 id="member-menu-title" className="mt-1 font-serif text-2xl text-[#0B3D2E]">Explore Urji Fit</h2>
              </div>
              <button type="button" aria-label="Close navigation menu" onClick={() => setMoreOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F3EFE5] text-[#14201A]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h3 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6660]">{group.label}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => (
                      <NavigationLink key={item.label} item={item} pathname={pathname} onClick={() => setMoreOpen(false)} compact />
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#14201A]/10 pt-4">
              <ThemeToggle variant="pill" />
              <button type="button" onClick={handleLogout} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#C1502E] hover:bg-[#FBE9E1]">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
