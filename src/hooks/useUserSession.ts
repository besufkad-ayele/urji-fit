'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { User } from '@/types';

export function useUserSession() {
  const [user, setUser] = useState<User | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const getOrCreateDeviceId = useCallback((): string => {
    if (typeof window === 'undefined') return '';
    let dId = localStorage.getItem('urji_device_id');
    if (!dId) {
      dId = uuidv4();
      localStorage.setItem('urji_device_id', dId);
    }
    return dId;
  }, []);

  const logout = useCallback(async () => {
    const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('urji_user_id') : null;
    if (storedUserId) {
      try {
        await fetch('/api/admin/revoke-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: storedUserId }),
        });
      } catch (e) {
        console.error('Failed to unlink device on logout:', e);
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('urji_user');
      localStorage.removeItem('urji_user_id');
    }
    setUser(null);
    router.push('/login');
  }, [router]);

  const verifySession = useCallback(async (uId: string, dId: string) => {
    try {
      const res = await fetch(`/api/auth/session?userId=${uId}&deviceId=${dId}`);
      const data = await res.json();
      if (res.ok && data.active && data.user) {
        setUser(data.user);
        localStorage.setItem('urji_user', JSON.stringify(data.user));
      } else {
        // Superseded or manually revoked by admin
        alert(data.message || 'Active device lock was revoked or superseded. Please log in again.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('urji_user');
          localStorage.removeItem('urji_user_id');
        }
        setUser(null);
        router.push('/login');
      }
    } catch {
      // Offline fallback: load cached
      const cached = localStorage.getItem('urji_user');
      if (cached) {
        setUser(JSON.parse(cached));
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const dId = getOrCreateDeviceId();
    setDeviceId(dId);

    const storedUser = localStorage.getItem('urji_user');
    const storedUserId = localStorage.getItem('urji_user_id');

    if (storedUser && storedUserId) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        verifySession(storedUserId, dId);
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }

    // Check device lock status on tab focus and every 25 seconds
    const checkActiveLock = () => {
      const uId = localStorage.getItem('urji_user_id');
      const devId = localStorage.getItem('urji_device_id');
      if (uId && devId) {
        verifySession(uId, devId);
      }
    };

    window.addEventListener('focus', checkActiveLock);
    const interval = setInterval(checkActiveLock, 25000);

    return () => {
      window.removeEventListener('focus', checkActiveLock);
      clearInterval(interval);
    };
  }, [getOrCreateDeviceId, verifySession]);


  const refreshUser = (updated: User) => {
    setUser(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('urji_user', JSON.stringify(updated));
      localStorage.setItem('urji_user_id', updated.id);
    }
  };

  return {
    user,
    deviceId,
    loading,
    refreshUser,
    logout,
  };
}
