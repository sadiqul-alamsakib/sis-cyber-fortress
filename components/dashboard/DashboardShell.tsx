'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getRoleLabel } from '@/lib/auth/roles';
import type { UserProfile } from '@/types/security';
import {
  ActivityIcon,
  CloseIcon,
  DashboardGridIcon,
  FirewallIcon,
  LockNodesIcon,
  LogOutIcon,
  MenuIcon,
  ShieldAlertIcon,
  TerminalIcon,
  UsersShieldIcon,
} from './SecurityIcons';

interface DashboardShellProps {
  profile: UserProfile;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function getInitials(name: string | null, email: string): string {
  const source = (name && name.trim()) || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function DashboardShell({
  profile,
  title,
  subtitle,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    {
      href: '/dashboard',
      label: 'Command Center',
      icon: <DashboardGridIcon className="w-4 h-4" />,
      exact: true,
    },
    {
      href: '/dashboard/control',
      label: 'App & Web Control',
      icon: <ActivityIcon className="w-4 h-4" />,
      exact: false,
    },
    {
      href: '/dashboard/modules',
      label: '12 Security Modules',
      icon: <ShieldAlertIcon className="w-4 h-4" />,
      exact: false,
    },
    {
      href: '/dashboard/incidents',
      label: 'SOC & Incidents',
      icon: <TerminalIcon className="w-4 h-4" />,
      exact: false,
    },
    {
      href: '/dashboard/assets',
      label: 'Authorized Assets',
      icon: <FirewallIcon className="w-4 h-4" />,
      exact: false,
    },
    {
      href: '/dashboard/users',
      label: 'Users & RBAC',
      icon: <UsersShieldIcon className="w-4 h-4" />,
      exact: false,
    },
    {
      href: '/dashboard/audit',
      label: 'Audit Logs',
      icon: <LockNodesIcon className="w-4 h-4" />,
      exact: false,
    },
    {
      href: '/dashboard/reports',
      label: 'Reports & Analytics',
      icon: <ActivityIcon className="w-4 h-4" />,
      exact: false,
    },
    {
      href: '/dashboard/settings',
      label: 'System & API Health',
      icon: <FirewallIcon className="w-4 h-4" />,
      exact: false,
    },
  ];

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[#090b0f] border-r border-zinc-800/80">
      <div className="flex items-center justify-between px-5 h-16 border-b border-zinc-800/80">
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sis-logo.jpg"
            alt="SIS Cyber Fortress"
            className="w-11 h-8 object-cover rounded-md border border-amber-500/30 shrink-0"
          />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wider text-zinc-100">
              SIS <span className="text-amber-400">CYBER</span>
            </p>
            <p className="text-[10px] font-mono font-medium tracking-[0.22em] text-zinc-400 uppercase">
              Fortress 12-in-1
            </p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          aria-label="Close navigation menu"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Main navigation">
        <p className="px-3 mb-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500">
          Super Admin Console
        </p>
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-[0_0_24px_-8px_rgba(245,158,11,0.4)]'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 border border-transparent'
              }`}
            >
              <span className={isActive ? 'text-amber-400' : 'text-zinc-500'}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800/80 bg-[#07080b]">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0d0f14] border border-zinc-800/90">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.full_name ?? profile.email}
              className="w-9 h-9 rounded-lg object-cover border border-amber-500/30"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/25 border border-amber-500/35 flex items-center justify-center text-xs font-bold text-amber-300">
              {getInitials(profile.full_name, profile.email)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zinc-100 truncate">
              {profile.full_name || 'Security Operator'}
            </p>
            <p className="text-[11px] text-zinc-400 truncate">{profile.email}</p>
            <span className="inline-flex items-center mt-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider rounded bg-amber-500/12 text-amber-300 border border-amber-500/25">
              {getRoleLabel(profile.role)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-zinc-300 bg-[#0d0f14] hover:bg-rose-500/10 hover:text-rose-300 border border-zinc-800 hover:border-rose-500/35 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <LogOutIcon className="w-4 h-4" />
          {signingOut ? 'Terminating Session...' : 'Sign Out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#07080b] bg-tactical-grid text-zinc-100 flex">
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between bg-[#07080b]/85 backdrop-blur-md border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-zinc-800"
              aria-label="Open navigation menu"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-zinc-100">
                {title}
              </h1>
              <p className="hidden sm:block text-xs text-zinc-400">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/modules"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            >
              12 Modules
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-medium bg-[#0d0f14] border border-zinc-800">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-zinc-300 tracking-wide">POSTGRES LIVE</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
