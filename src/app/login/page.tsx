'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { KeyRound, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function LoginPage() {
  const [credential, setCredential] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const router = useRouter();

  useEffect(() => {
    let dId = localStorage.getItem('urji_device_id');
    if (!dId) {
      dId = uuidv4();
      localStorage.setItem('urji_device_id', dId);
    }
    setDeviceId(dId);

    // If already logged in, redirect
    if (localStorage.getItem('urji_user')) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = async (e?: React.FormEvent, overrideCred?: string, overrideOtp?: string) => {
    if (e) e.preventDefault();
    const credToUse = overrideCred || credential;
    const otpToUse = overrideOtp || otp;

    if (!credToUse || !otpToUse) {
      setError('Please provide your phone/email and 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: credToUse,
          otp: otpToUse,
          deviceId,
          deviceName: 'Web Browser (' + navigator.userAgent.split(' ')[0] + ')',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed. Please verify your OTP.');
        setLoading(false);
        return;
      }

      // Save user in local storage
      localStorage.setItem('urji_user', JSON.stringify(data.user));
      localStorage.setItem('urji_user_id', data.user.id);

      if (data.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('Network error connecting to Urji Fit servers.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (cred: string, code: string) => {
    setCredential(cred);
    setOtp(code);
    handleLogin(undefined, cred, code);
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

        {/* Form */}
        <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1.5">
              Phone or Email
            </label>
            <input
              type="text"
              required
              placeholder="e.g. +251912345678 or you@domain.com"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              className="w-full px-4 py-3 bg-white/70 border border-[#14201A]/15 rounded-xl text-sm text-[#14201A] focus:outline-none focus:ring-2 focus:ring-[#0B3D2E] focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1.5">
              6-Digit One-Time Passcode (OTP)
            </label>
            <div className="relative">
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-4 py-3 bg-white/70 border border-[#14201A]/15 rounded-xl text-base tracking-widest font-mono text-[#14201A] focus:outline-none focus:ring-2 focus:ring-[#0B3D2E] focus:border-transparent transition-all"
              />
              <KeyRound className="w-5 h-5 text-[rgb(90,102,96)] absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

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
            {loading ? 'Authenticating…' : 'Activate Session & Bind Device'}
          </button>
        </form>

        {/* Device lock notice */}
        <div className="mt-6 p-3.5 bg-[#F2F7D9]/60 border border-[#14201A]/5 rounded-xl flex items-start gap-2.5 text-xs text-[rgb(90,102,96)] leading-snug">
          <ShieldAlert className="w-4 h-4 text-[#0B3D2E] flex-shrink-0 mt-0.5" />
          <span>
            <strong>Single-Device Locked:</strong> Accounts are provisioned by the admin. Entering your OTP binds this device and automatically ends any prior session on other devices.
          </span>
        </div>

        {/* Quick Demo Pre-seeds */}
        <div className="mt-6 pt-5 border-t border-[#14201A]/10 text-center">
          <p className="text-[11px] uppercase tracking-wider text-[rgb(90,102,96)] font-semibold mb-2 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#C1502E]" /> Quick Demo Logins
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('bes@urjifit.com', '123456')}
              className="px-3 py-2 text-xs font-medium bg-white hover:bg-[#F2F7D9]/70 border border-[#14201A]/10 rounded-lg text-[#14201A] transition-colors flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#0B3D2E]" />
              Bes (User)
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('admin@urjifit.com', '999999')}
              className="px-3 py-2 text-xs font-medium bg-white hover:bg-[#F2F7D9]/70 border border-[#14201A]/10 rounded-lg text-[#C1502E] transition-colors flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Admin Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
