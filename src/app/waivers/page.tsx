'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSignature, ShieldCheck } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';

type Waiver = {
  id: string;
  gym_id: string;
  title: string;
  content: string;
  version: number;
  gym: { name: string } | null;
  acceptance: {
    id: string;
    typed_signature: string;
    accepted_at: string;
    waiver_version: number | null;
    content_sha256: string | null;
  } | null;
};

export default function MemberWaiversPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useUserSession();
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingId, setSigningId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadWaivers = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/member/waivers');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load waivers.');
      setWaivers(data.waivers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load waivers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !user) router.replace('/login');
    if (!sessionLoading && user && user.role !== 'member') router.replace(user.role === 'gym_owner' ? '/gym-owner' : '/dashboard');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionLoading && user?.role === 'member') void loadWaivers();
  }, [loadWaivers, router, sessionLoading, user]);

  async function signWaiver(event: FormEvent<HTMLFormElement>, waiver: Waiver) {
    event.preventDefault();
    const signature = new FormData(event.currentTarget).get('typed_signature');
    setSigningId(waiver.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/member/waivers/${waiver.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typed_signature: signature }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not sign this waiver.');
      setNotice(`Signed ${waiver.title} for ${waiver.gym?.name ?? 'your gym'}.`);
      await loadWaivers();
    } catch (signError) {
      setError(signError instanceof Error ? signError.message : 'Could not sign this waiver.');
    } finally {
      setSigningId('');
    }
  }

  if (sessionLoading || loading || !user || user.role !== 'member') {
    return <main className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]">Loading your waivers...</main>;
  }

  return (
    <div className="min-h-screen bg-[#F3EFE5] md:flex">
      <Navigation userFullName={user.full_name} userRole={user.role} />
      <main className="min-w-0 flex-1 px-4 py-8 pb-24 md:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#5A6660]"><FileSignature className="h-4 w-4" /> Member agreements</p>
          <h1 className="mt-2 font-serif text-4xl text-[#0B3D2E]">Waivers & contracts</h1>
          <p className="mt-2 text-sm leading-6 text-[#5A6660]">Read each active waiver in full. Signing records your typed account name, the exact document version, and its content hash with a server timestamp. This is an electronic acknowledgement and is not a substitute for legal advice.</p>
          {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
          <section className="mt-6 space-y-5">
            {waivers.map((waiver) => (
              <article key={waiver.id} className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm sm:p-7">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-2xl text-[#0B3D2E]">{waiver.title}</h2>
                    <p className="mt-1 text-sm text-[#5A6660]">{waiver.gym?.name ?? 'Gym'} · version {waiver.version}</p>
                  </div>
                  {waiver.acceptance && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                      <ShieldCheck className="h-4 w-4" /> Signed {new Date(waiver.acceptance.accepted_at).toLocaleDateString()}
                    </span>
                  )}
                </header>
                <div className="mt-5 max-h-[28rem] overflow-y-auto rounded-xl border border-[#14201A]/10 bg-white p-4 text-sm leading-6 text-[#14201A]">
                  <pre className="whitespace-pre-wrap font-sans">{waiver.content}</pre>
                </div>
                {waiver.acceptance ? (
                  <p className="mt-4 text-sm text-[#5A6660]">
                    Signed as <strong className="text-[#14201A]">{waiver.acceptance.typed_signature}</strong> on {new Date(waiver.acceptance.accepted_at).toLocaleString()}.
                    {waiver.acceptance.waiver_version !== waiver.version && ' A newer version is available and requires a new signature.'}
                  </p>
                ) : (
                  <form onSubmit={(event) => void signWaiver(event, waiver)} className="mt-5 space-y-4">
                    <label className="block space-y-1.5 text-sm font-medium">
                      Type your account name to sign
                      <input required name="typed_signature" maxLength={120} defaultValue={user.full_name} className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5" />
                    </label>
                    <label className="flex items-start gap-3 text-sm leading-5 text-[#5A6660]">
                      <input required type="checkbox" className="mt-1" />
                      <span>I have read the complete document above, understand it, and agree to sign this version electronically.</span>
                    </label>
                    <button disabled={signingId === waiver.id} className="rounded-xl bg-[#0B3D2E] px-5 py-3 text-sm font-semibold text-[#F2F7D9] disabled:opacity-60">
                      {signingId === waiver.id ? 'Signing...' : 'Sign waiver'}
                    </button>
                  </form>
                )}
              </article>
            ))}
            {waivers.length === 0 && <p className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">There are no active waivers for your current gym memberships.</p>}
          </section>
        </div>
      </main>
    </div>
  );
}
