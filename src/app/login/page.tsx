'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import {
  Building2,
  Dumbbell,
  KeyRound,
  ShieldAlert,
  Sparkles,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const DEMO_LOGINS: {
  credential: string;
  otp: string;
  label: string;
  icon: LucideIcon;
  colorClass: string;
}[] = [
  {
    credential: 'bes@urjifit.com',
    otp: '123456',
    label: 'Member',
    icon: UserCheck,
    colorClass: 'text-[#0B3D2E]',
  },
  {
    credential: 'owner@gymone.com',
    otp: '666666',
    label: 'Gym Owner',
    icon: Building2,
    colorClass: 'text-[#0B3D2E]',
  },
  {
    credential: 'coach@urjifit.com',
    otp: '222222',
    label: 'Trainer',
    icon: Dumbbell,
    colorClass: 'text-[#0B3D2E]',
  },
  {
    credential: 'admin@urjifit.com',
    otp: '999999',
    label: 'Admin',
    icon: KeyRound,
    colorClass: 'text-[#C1502E]',
  },
];

const getOrCreateDeviceId = () => {
  let id = localStorage.getItem('urji_device_id');
  if (!id) {
    id = uuidv4();
    localStorage.setItem('urji_device_id', id);
  }
  return id;
};

export default function LoginPage() {
  const [authMode, setAuthMode] = useState<'otp' | 'admin-password'>('otp');
  const [credential, setCredential] = useState('');
  const [otp, setOtp] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    getOrCreateDeviceId();

    // If already logged in, redirect
    if (localStorage.getItem('urji_user')) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = async (
    e?: React.FormEvent,
    overrideCred?: string,
    overrideOtp?: string,
    overrideMode?: 'otp' | 'admin-password'
  ) => {
    if (e) e.preventDefault();
    const credToUse = overrideCred || credential;
    const otpToUse = overrideOtp || otp;
    const mode = overrideMode || authMode;

    if (!credToUse) {
      setError('Enter your administrator email or account phone/email.');
      return;
    }
    if (mode === 'otp' && !otpToUse) {
      setError('Enter your 6-digit OTP code.');
      return;
    }
    if (mode !== 'otp' && !adminPassword) {
      setError('Enter your administrator password.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'otp'
        ? '/api/auth/otp'
        : '/api/auth/admin-password';
      const body = mode === 'otp'
        ? {
            credential: credToUse,
            otp: otpToUse,
            deviceId: getOrCreateDeviceId(),
            deviceName: 'Web Browser (' + navigator.userAgent.split(' ')[0] + ')',
          }
        : {
              email: credToUse,
              password: adminPassword,
              deviceId: getOrCreateDeviceId(),
              deviceName: 'Web Browser (' + navigator.userAgent.split(' ')[0] + ')',
            };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed. Please verify your OTP.');
        return;
      }

      // Save user in local storage
      localStorage.setItem('urji_user', JSON.stringify(data.user));
      localStorage.setItem('urji_user_id', data.user.id);

      console.log('Login successful - User role:', data.user.role);
      console.log('Full user object:', data.user);

      // Route based on role
      if (data.user.role === 'admin' || data.user.role === 'platform_admin') {
        console.log('Redirecting to /admin');
        router.push('/admin');
      } else if (data.user.role === 'gym_owner') {
        console.log('Redirecting to /gym-owner');
        router.push('/gym-owner');
      } else if (data.user.role === 'trainer') {
        console.log('Redirecting to /trainer');
        router.push('/trainer');
      } else {
        // member or default
        console.log('Redirecting to /dashboard');
        router.push('/dashboard');
      }
    } catch {
      setError('Network error connecting to Urji Fit servers.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoLogin: (typeof DEMO_LOGINS)[number]) => {
    setAuthMode('otp');
    setCredential(demoLogin.credential);
    setOtp(demoLogin.otp);
    void handleLogin(undefined, demoLogin.credential, demoLogin.otp, 'otp');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F3EFE5] relative">
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle variant="pill" />
      </div>
      <div className="w-full max-w-md bg-[#FCFAF6] border border-[#14201A]/10 rounded-3xl p-8 md:p-10 shadow-xl">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0B3D2E] text-[#F2F7D9] mb-3 shadow-md">
            <span className="font-serif text-3xl font-bold">U</span>
          </div>
          <h1 className="font-serif text-3xl text-[#0B3D2E] font-medium tracking-tight">
            Urji Fit
          </h1>
          <p className="text-xs uppercase tracking-widest text-[rgb(90,102,96)] font-semibold mt-1">
            Personal Fitness, Nutrition & Habit Planner
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-[#F3EFE5] p-1">
          {([
            ['otp', 'Account OTP'],
            ['admin-password', 'Admin password'],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setAuthMode(mode);
                setError('');
              }}
              className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                authMode === mode
                  ? 'bg-[#0B3D2E] text-[#F2F7D9]'
                  : 'text-[rgb(90,102,96)] hover:bg-white/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1.5">
              {authMode === 'otp' ? 'Phone or Email' : 'Administrator Email'}
            </label>
            <input
              type={authMode === 'otp' ? 'text' : 'email'}
              required
              placeholder={authMode === 'otp' ? 'e.g. +251912345678 or you@domain.com' : 'admin@yourdomain.com'}
              autoComplete={authMode === 'otp' ? 'username' : 'email'}
              autoCapitalize="none"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              className="w-full px-4 py-3 bg-white/70 border border-[#14201A]/15 rounded-xl text-sm text-[#14201A] focus:outline-none focus:ring-2 focus:ring-[#0B3D2E] focus:border-transparent transition-all"
            />
          </div>

          {authMode === 'otp' ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1.5">
                6-Digit One-Time Passcode (OTP)
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-4 py-3 bg-white/70 border border-[#14201A]/15 rounded-xl text-base tracking-widest font-mono text-[#14201A] focus:outline-none focus:ring-2 focus:ring-[#0B3D2E] focus:border-transparent transition-all"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)]">
                Admin Password
              </label>
              <input
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                className="w-full rounded-xl border border-[#14201A]/15 bg-white/70 px-4 py-3 text-sm text-[#14201A] focus:outline-none focus:ring-2 focus:ring-[#0B3D2E]"
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#0B3D2E] hover:bg-[#135440] disabled:opacity-50 text-[#F2F7D9] rounded-xl font-medium text-sm transition-all shadow-md flex items-center justify-center gap-2"
          >
            {loading
              ? 'Authenticating…'
              : authMode === 'admin-password'
                ? 'Sign in as Administrator'
                : 'Activate Session & Bind Device'}
          </button>
        </form>

        {/* Device lock notice */}
        <div className="mt-6 p-3.5 bg-[#F2F7D9]/60 border border-[#14201A]/5 rounded-xl flex items-start gap-2.5 text-xs text-[rgb(90,102,96)] leading-snug">
          <ShieldAlert className="w-4 h-4 text-[#0B3D2E] flex-shrink-0 mt-0.5" />
          <span>
            <strong>Single-Device Locked:</strong> Accounts are provisioned by the admin. Signing in binds this device and automatically ends any prior session on other devices.
          </span>
        </div>

        {authMode === 'otp' && process.env.NODE_ENV !== 'production' && (
          <>
            {/* Quick Demo Pre-seeds */}
            <div className="mt-6 pt-5 border-t border-[#14201A]/10 text-center">
              <p className="text-[11px] uppercase tracking-wider text-[rgb(90,102,96)] font-semibold mb-2 flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#C1502E]" /> Quick Demo Logins
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_LOGINS.map((demoLogin) => {
                  const Icon = demoLogin.icon;

                  return (
                    <button
                      key={demoLogin.label}
                      type="button"
                      disabled={loading}
                      onClick={() => handleQuickDemo(demoLogin)}
                      className="px-3 py-2 text-xs font-medium bg-white hover:bg-[#F2F7D9]/70 disabled:opacity-50 border border-[#14201A]/10 rounded-lg text-[#14201A] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Icon className={`w-3.5 h-3.5 ${demoLogin.colorClass}`} />
                      {demoLogin.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
