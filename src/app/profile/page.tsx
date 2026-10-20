'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';

type MemberProfile = {
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
  goals: string | null;
  tags: string[];
  date_of_birth: string | null;
  address: string | null;
};
type MemberAccount = {
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

export default function MemberProfilePage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useUserSession();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [account, setAccount] = useState<MemberAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'member') {
      router.replace(user.role === 'gym_owner' ? '/gym-owner' : '/dashboard');
      return;
    }

    let active = true;
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/member/profile');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load your profile.');
        if (active) {
          setAccount(data.account);
          setProfile(data.profile ?? {
            emergency_contact_name: '',
            emergency_contact_phone: '',
            medical_notes: '',
            goals: '',
            tags: [],
            date_of_birth: '',
            address: '',
          });
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load your profile.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProfile();
    return () => {
      active = false;
    };
  }, [router, sessionLoading, user]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/member/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emergency_contact_name: formData.get('emergency_contact_name'),
          emergency_contact_phone: formData.get('emergency_contact_phone'),
          medical_notes: formData.get('medical_notes'),
          goals: formData.get('goals'),
          date_of_birth: formData.get('date_of_birth') || null,
          address: formData.get('address'),
          full_name: formData.get('full_name'),
          email: formData.get('email') || null,
          phone: formData.get('phone') || null,
          avatar_url: formData.get('avatar_url') || null,
          tags: String(formData.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save your profile.');
      setProfile(data.profile);
      setAccount(data.account);
      setNotice('Your profile has been saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || loading || !user || user.role !== 'member') {
    return <main className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]">Loading your profile...</main>;
  }

  return (
    <div className="min-h-screen bg-[#F3EFE5] md:flex">
      <Navigation userFullName={user.full_name} userRole={user.role} />
      <main className="min-w-0 flex-1 px-4 py-8 pb-24 md:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5A6660]">Member account</p>
          <h1 className="mt-2 font-serif text-4xl text-[#0B3D2E]">Your profile</h1>
          <p className="mt-2 text-sm text-[#5A6660]">Keep your contact details, emergency contact, health notes, and training goals up to date. Medical notes are visible to authorized gym owners and managers.</p>

          {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

          <form onSubmit={saveProfile} className="mt-6 space-y-5 rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm sm:p-8">
            <section>
              <h2 className="font-semibold text-[#14201A]">Contact details</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium">
                  Full name
                  <input required name="full_name" maxLength={120} defaultValue={account?.full_name ?? user.full_name} className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Email
                  <input name="email" type="email" maxLength={254} defaultValue={account?.email ?? ''} className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Phone
                  <input name="phone" maxLength={40} defaultValue={account?.phone ?? ''} className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Profile photo URL
                  <input name="avatar_url" type="url" maxLength={2048} defaultValue={account?.avatar_url ?? ''} placeholder="https://..." className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Date of birth
                  <input name="date_of_birth" type="date" defaultValue={profile?.date_of_birth ?? ''} className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Address
                  <input name="address" maxLength={3000} defaultValue={profile?.address ?? ''} className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
                </label>
              </div>
            </section>
            <section>
              <h2 className="font-semibold text-[#14201A]">Emergency contact</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium">
                  Name
                  <input name="emergency_contact_name" maxLength={120} defaultValue={profile?.emergency_contact_name ?? ''} className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Phone
                  <input name="emergency_contact_phone" maxLength={120} defaultValue={profile?.emergency_contact_phone ?? ''} className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
                </label>
              </div>
            </section>
            <label className="block space-y-1.5 text-sm font-medium">
              Medical notes
              <textarea name="medical_notes" maxLength={3000} rows={4} defaultValue={profile?.medical_notes ?? ''} placeholder="Optional notes relevant to your training or safety" className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Fitness goals
              <textarea name="goals" maxLength={3000} rows={3} defaultValue={profile?.goals ?? ''} placeholder="What are you working toward?" className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Personal tags
              <input name="tags" defaultValue={profile?.tags?.join(', ') ?? ''} placeholder="e.g. beginner, strength, mobility" className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
              <span className="block text-xs font-normal text-[#5A6660]">Separate tags with commas.</span>
            </label>
            <button disabled={saving} className="rounded-xl bg-[#0B3D2E] px-5 py-3 text-sm font-semibold text-[#F2F7D9] transition-colors hover:bg-[#135440] disabled:opacity-60">
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
