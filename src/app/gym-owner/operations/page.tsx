'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BriefcaseBusiness, Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';

type Gym = { id: string; name: string };
type MembershipPlan = {
  id: string;
  name: string;
  membership_type: string;
  price: number;
  duration_days: number | null;
  sessions_included: number | null;
  description: string | null;
  is_active: boolean;
};
type GymMember = {
  id: string;
  member_id: string;
  membership_type: string;
  price: number;
  status: string;
  end_date: string | null;
  plan_id?: string | null;
  frozen_at?: string | null;
  member?: { id: string; full_name: string; email: string | null; phone: string | null };
};
type Lead = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: 'inquiry' | 'trial' | 'converted' | 'lost';
  trial_at: string | null;
  notes: string | null;
};
type Household = {
  id: string;
  name: string;
  primary_member_id: string;
  is_active: boolean;
  primary_member: { id: string; full_name: string; email: string | null; phone: string | null };
  members: Array<{
    member_id: string;
    relationship: string | null;
    member: { id: string; full_name: string; email: string | null; phone: string | null };
  }>;
};
type MemberRecord = {
  id: string;
  member_id: string;
  membership_type: string;
  plan_id: string | null;
  price: number;
  start_date: string;
  end_date: string | null;
  status: string;
  auto_renew: boolean;
  sessions_remaining: number | null;
  frozen_at: string | null;
  household_id: string | null;
  member: { id: string; full_name: string; email: string | null; phone: string | null; avatar_url: string | null; created_at: string };
  profile: {
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    medical_notes: string | null;
    goals: string | null;
    tags: string[];
    date_of_birth: string | null;
    address: string | null;
    updated_at: string | null;
  } | null;
};
type MemberLookup = { id: string; full_name: string; email: string | null; phone: string | null };
type Waiver = {
  id: string;
  title: string;
  content: string;
  version: number;
  is_active: boolean;
  acceptances: Array<{
    id: string;
    typed_signature: string;
    accepted_at: string;
    waiver_version: number | null;
    member: { full_name: string; email: string | null; phone: string | null };
  }>;
};
type AuditEvent = {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor: { id: string; full_name: string; email: string | null } | null;
};

const MEMBERSHIP_TYPES = [
  'monthly',
  'quarterly',
  'annual',
  'day_pass',
  'family',
  'corporate',
  'student',
  'couple',
  'pay_per_visit',
  'class_pack',
];

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data as T;
}

export default function GymOperationsPage() {
  const router = useRouter();
  const [gym, setGym] = useState<Gym | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGymId, setSelectedGymId] = useState('');
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'plans' | 'members' | 'households' | 'leads' | 'waivers' | 'audit'>('plans');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberDetails, setMemberDetails] = useState<MemberRecord | null>(null);
  const [memberLookup, setMemberLookup] = useState<MemberLookup | null>(null);
  const [householdEditId, setHouseholdEditId] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [householdPrimaryId, setHouseholdPrimaryId] = useState('');
  const [householdMemberIds, setHouseholdMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOperations = useCallback(async () => {
    setError('');
    try {
      const storedUser = localStorage.getItem('urji_user');
      if (!storedUser) {
        router.replace('/login');
        return;
      }
      const user: unknown = JSON.parse(storedUser);
      if (
        typeof user !== 'object' ||
        user === null ||
        !('id' in user) ||
        typeof user.id !== 'string' ||
        !('role' in user) ||
        user.role !== 'gym_owner'
      ) {
        router.replace('/dashboard');
        return;
      }

      const gymResponse = await fetch(`/api/gyms?userId=${encodeURIComponent(user.id)}&role=gym_owner`);
      const gymData = await readResponse<{ gyms: Gym[] }>(gymResponse);
      const preferredGymId = selectedGymId || localStorage.getItem('urji_selected_gym') || '';
      const selectedGym = gymData.gyms.find((item) => item.id === preferredGymId) ?? gymData.gyms[0];
      setGyms(gymData.gyms);
      if (!selectedGym) {
        setGym(null);
        return;
      }
      if (selectedGymId !== selectedGym.id) {
        setSelectedGymId(selectedGym.id);
        localStorage.setItem('urji_selected_gym', selectedGym.id);
      }
      setGym(selectedGym);

      const [planResponse, memberResponse, leadResponse, householdResponse, waiverResponse, auditResponse] = await Promise.all([
        fetch(`/api/gyms/${selectedGym.id}/plans`),
        fetch(`/api/gyms/${selectedGym.id}/members`),
        fetch(`/api/gyms/${selectedGym.id}/leads`),
        fetch(`/api/gyms/${selectedGym.id}/households`),
        fetch(`/api/gyms/${selectedGym.id}/waivers`),
        fetch(`/api/gyms/${selectedGym.id}/audit`),
      ]);
      const [planData, memberData, leadData, householdData, waiverData, auditData] = await Promise.all([
        readResponse<{ plans: MembershipPlan[] }>(planResponse),
        readResponse<{ memberships: GymMember[] }>(memberResponse),
        readResponse<{ leads: Lead[] }>(leadResponse),
        readResponse<{ households: Household[] }>(householdResponse),
        readResponse<{ waivers: Waiver[] }>(waiverResponse),
        readResponse<{ events: AuditEvent[] }>(auditResponse),
      ]);
      setPlans(planData.plans);
      setMembers(memberData.memberships);
      setLeads(leadData.leads);
      setHouseholds(householdData.households);
      setWaivers(waiverData.waivers);
      setAuditEvents(auditData.events);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load gym operations.');
    } finally {
      setLoading(false);
    }
  }, [router, selectedGymId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOperations();
  }, [loadOperations]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'members') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab('members');
    }
  }, []);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gym) return;
    setSaving(true);
    setNotice('');
    setError('');
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    try {
      await readResponse(await fetch(`/api/gyms/${gym.id}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          membership_type: form.get('membership_type'),
          price: Number(form.get('price')),
          duration_days: form.get('duration_days') ? Number(form.get('duration_days')) : null,
          sessions_included: form.get('sessions_included') ? Number(form.get('sessions_included')) : null,
          description: form.get('description'),
        }),
      }));
      formElement.reset();
      setNotice('Membership plan created.');
      await loadOperations();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not create membership plan.');
    } finally {
      setSaving(false);
    }
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gym) return;
    setSaving(true);
    setNotice('');
    setError('');
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    try {
      await readResponse(await fetch(`/api/gyms/${gym.id}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.get('full_name'),
          phone: form.get('phone'),
          email: form.get('email'),
          source: form.get('source'),
          notes: form.get('notes'),
        }),
      }));
      formElement.reset();
      setNotice('Lead added to the pipeline.');
      await loadOperations();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add lead.');
    } finally {
      setSaving(false);
    }
  }

  async function updateLead(lead: Lead, status: Lead['status']) {
    if (!gym) return;
    setError('');
    setNotice('');
    try {
      await readResponse(await fetch(`/api/gyms/${gym.id}/leads`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, status }),
      }));
      setNotice(`${lead.full_name}'s lead status was updated.`);
      await loadOperations();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update lead.');
    }
  }

  async function scheduleTrial(event: FormEvent<HTMLFormElement>, lead: Lead) {
    event.preventDefault();
    if (!gym) return;
    const form = new FormData(event.currentTarget);
    setError('');
    setNotice('');
    try {
      await readResponse(await fetch(`/api/gyms/${gym.id}/leads`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, trial_at: form.get('trial_at') }),
      }));
      setNotice(`Trial scheduled for ${lead.full_name}.`);
      await loadOperations();
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : 'Could not schedule trial.');
    }
  }

  async function convertLead(event: FormEvent<HTMLFormElement>, lead: Lead) {
      event.preventDefault();
      if (!gym) return;
      const form = new FormData(event.currentTarget);
      setSaving(true);
      setError('');
      setNotice('');
      try {
        await readResponse(await fetch(`/api/gyms/${gym.id}/leads/${lead.id}/convert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: form.get('plan_id'),
            start_date: form.get('start_date'),
          }),
        }));
        setNotice(`${lead.full_name} was converted and a membership was created. Collect/verify payment separately.`);
        await loadOperations();
      } catch (convertError) {
        setError(convertError instanceof Error ? convertError.message : 'Could not convert lead.');
      } finally {
        setSaving(false);
      }
    }

  async function loadMemberDetails(membershipId: string) {
      if (!gym) return;
      setError('');
      try {
        const response = await fetch(`/api/gyms/${gym.id}/members/${membershipId}`);
        const data = await readResponse<{ membership: MemberRecord }>(response);
        setMemberDetails(data.membership);
      } catch (detailsError) {
        setError(detailsError instanceof Error ? detailsError.message : 'Could not load private member details.');
      }
    }

    async function lookupMember(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!gym) return;
      const form = new FormData(event.currentTarget);
      const email = String(form.get('email') || '').trim();
      const phone = String(form.get('phone') || '').trim();
      setError('');
      setMemberLookup(null);
      try {
        const response = await fetch(`/api/gyms/${gym.id}/members/lookup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(email ? { email } : { phone }),
        });
        const data = await readResponse<{ member: MemberLookup }>(response);
        setMemberLookup(data.member);
      } catch (lookupError) {
        setError(lookupError instanceof Error ? lookupError.message : 'Could not find member account.');
      }
    }

    async function enrollMember(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!gym || !memberLookup) return;
      const form = new FormData(event.currentTarget);
      setSaving(true);
      setError('');
      setNotice('');
      try {
        await readResponse(await fetch(`/api/gyms/${gym.id}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_id: memberLookup.id,
            plan_id: form.get('plan_id'),
            start_date: form.get('start_date'),
            auto_renew: false,
          }),
        }));
        setNotice(`${memberLookup.full_name} was enrolled. Use the Ethiopia payment receipt workflow to verify payment.`);
        setMemberLookup(null);
        await loadOperations();
      } catch (enrollError) {
        setError(enrollError instanceof Error ? enrollError.message : 'Could not enroll member.');
      } finally {
        setSaving(false);
      }
    }

  async function saveMemberDetails(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!gym || !memberDetails) return;
      const form = new FormData(event.currentTarget);
      setSaving(true);
      setError('');
      setNotice('');
      try {
        const response = await fetch(`/api/gyms/${gym.id}/members/${memberDetails.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: form.get('full_name'),
            email: form.get('email') || null,
            phone: form.get('phone') || null,
            avatar_url: form.get('avatar_url') || null,
            emergency_contact_name: form.get('emergency_contact_name') || null,
            emergency_contact_phone: form.get('emergency_contact_phone') || null,
            date_of_birth: form.get('date_of_birth') || null,
            address: form.get('address') || null,
            medical_notes: form.get('medical_notes') || null,
            goals: form.get('goals') || null,
            tags: String(form.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean),
          }),
        });
        const data = await readResponse<{ membership: MemberRecord }>(response);
        setMemberDetails(data.membership);
        setNotice('Member record saved.');
        await loadOperations();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Could not save member record.');
      } finally {
        setSaving(false);
      }
    }

  async function saveHousehold(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!gym) return;
      setSaving(true);
      setError('');
      setNotice('');
      try {
        const response = await fetch(
          householdEditId
            ? `/api/gyms/${gym.id}/households/${householdEditId}`
            : `/api/gyms/${gym.id}/households`,
          {
            method: householdEditId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: householdName,
              primary_member_id: householdPrimaryId,
              member_ids: householdMemberIds,
            }),
          }
        );
        await readResponse(response);
        setHouseholdEditId('');
        setHouseholdName('');
        setHouseholdPrimaryId('');
        setHouseholdMemberIds([]);
        setNotice('Household account saved. Billing remains a Phase 2 integration.');
        await loadOperations();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Could not save household.');
      } finally {
        setSaving(false);
      }
    }

  async function dissolveHousehold(household: Household) {
      if (!gym || !window.confirm(`Dissolve ${household.name}? Member accounts and memberships remain; only household links are removed.`)) return;
      setError('');
      setNotice('');
      try {
        await readResponse(await fetch(`/api/gyms/${gym.id}/households/${household.id}`, { method: 'DELETE' }));
        setNotice('Household dissolved; memberships were retained.');
        await loadOperations();
      } catch (dissolveError) {
        setError(dissolveError instanceof Error ? dissolveError.message : 'Could not dissolve household.');
      }
    }

  async function createWaiver(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!gym) return;
      const form = new FormData(event.currentTarget);
      const formElement = event.currentTarget;
      setSaving(true);
      setError('');
      setNotice('');
      try {
        await readResponse(await fetch(`/api/gyms/${gym.id}/waivers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: form.get('title'), content: form.get('content') }),
        }));
        formElement.reset();
        setNotice('New waiver version published. Members must sign the active version.');
        await loadOperations();
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : 'Could not publish waiver.');
      } finally {
        setSaving(false);
      }
    }

    const filteredMembers = members.filter((membership) => {
      const search = memberSearch.trim().toLowerCase();
      if (!search) return true;
      return [
        membership.member?.full_name,
        membership.member?.email,
        membership.member?.phone,
        membership.membership_type,
        membership.status,
      ].some((value) => value?.toLowerCase().includes(search));
    });
    const householdCandidates = [...new Map(
      members
        .filter((membership) => membership.status !== 'canceled' && membership.member)
        .map((membership) => [membership.member_id, membership.member!])
    ).values()];

    async function updateMembership(member: GymMember, action: string, planId?: string) {
    if (!gym) return;
    setError('');
    setNotice('');
    try {
      await readResponse(await fetch(`/api/gyms/${gym.id}/memberships/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(planId ? { plan_id: planId } : {}) }),
      }));
      setNotice('Membership updated.');
      await loadOperations();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update membership.');
    }
  }

  async function invoiceRenewal(member: GymMember) {
    if (!gym) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/gyms/${gym.id}/memberships/${member.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }),
      });
      await readResponse(response);
      setNotice('Renewal invoice created. Membership dates extend after the staff verifies full payment.');
      await loadOperations();
    } catch (renewError) {
      setError(renewError instanceof Error ? renewError.message : 'Could not create renewal invoice.');
    }
  }

  async function setPlanAvailability(plan: MembershipPlan) {
    if (!gym) return;
    setError('');
    setNotice('');
    try {
      await readResponse(await fetch(`/api/gyms/${gym.id}/plans`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id, is_active: !plan.is_active }),
      }));
      setNotice(`Plan ${plan.is_active ? 'archived' : 'activated'}.`);
      await loadOperations();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update plan.');
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]">Loading gym operations...</main>;
  }

  return (
    <main className="min-h-screen bg-[#F3EFE5] px-4 py-8 text-[#14201A] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/gym-owner" className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B3D2E] hover:text-[#135440]">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#5A6660]">
              <BriefcaseBusiness className="h-4 w-4" /> Gym operations
            </p>
            <h1 className="mt-2 font-serif text-4xl text-[#0B3D2E]">{gym?.name ?? 'Operations'}</h1>
            <p className="mt-2 text-sm text-[#5A6660]">Manage membership products, member status, and inquiry-to-trial follow-up.</p>
          </div>
          <button type="button" onClick={() => void loadOperations()} className="inline-flex items-center gap-2 rounded-xl border border-[#14201A]/15 bg-[#FCFAF6] px-4 py-2.5 text-sm font-semibold text-[#0B3D2E]">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </header>
        {gyms.length > 1 && (
          <label className="mt-5 block max-w-sm space-y-1.5 text-sm font-medium">
            Gym location
            <select
              value={gym?.id ?? ''}
              onChange={(event) => {
                localStorage.setItem('urji_selected_gym', event.target.value);
                setSelectedGymId(event.target.value);
                setLoading(true);
              }}
              className="w-full rounded-xl border border-[#14201A]/15 bg-[#FCFAF6] px-3 py-2.5"
            >
              {gyms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
        {!gym ? (
          <p className="mt-8 rounded-2xl bg-[#FCFAF6] p-6 text-[#5A6660]">No gym is assigned to this owner account.</p>
        ) : (
          <>
            <nav className="mt-8 flex gap-2 border-b border-[#14201A]/10" aria-label="Gym operations">
              {(['plans', 'members', 'households', 'leads', 'waivers', 'audit'] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`border-b-2 px-4 py-3 text-sm font-semibold capitalize ${activeTab === tab ? 'border-[#0B3D2E] text-[#0B3D2E]' : 'border-transparent text-[#5A6660]'}`}>
                  {tab === 'leads' ? `Lead pipeline (${leads.length})` : tab === 'members' ? `Members (${members.length})` : tab === 'households' ? `Households (${households.filter((item) => item.is_active).length})` : tab === 'waivers' ? `Waivers (${waivers.length})` : tab === 'audit' ? `Audit (${auditEvents.length})` : `Plans (${plans.length})`}
                </button>
              ))}
            </nav>

            {activeTab === 'plans' && (
              <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-3">
                  {plans.length === 0 && <p className="rounded-2xl bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">No plans created yet.</p>}
                  {plans.map((plan) => (
                    <article key={plan.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                      <div>
                        <h2 className="font-semibold text-[#14201A]">{plan.name}</h2>
                        <p className="mt-1 text-xs capitalize text-[#5A6660]">{plan.membership_type.replaceAll('_', ' ')}{plan.duration_days ? ` · ${plan.duration_days} days` : ''}{plan.sessions_included ? ` · ${plan.sessions_included} sessions` : ''}</p>
                        {plan.description && <p className="mt-2 text-sm text-[#5A6660]">{plan.description}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-[#0B3D2E]">ETB {plan.price.toLocaleString()}</span>
                        <button type="button" onClick={() => void setPlanAvailability(plan)} className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-xs font-semibold text-[#0B3D2E]">
                          {plan.is_active ? 'Archive' : 'Activate'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <form onSubmit={createPlan} className="h-fit space-y-3 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                  <h2 className="flex items-center gap-2 font-semibold text-[#0B3D2E]"><Plus className="h-4 w-4" /> Create a membership plan</h2>
                  <input required name="name" maxLength={100} placeholder="Plan name" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <select required name="membership_type" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm">
                    {MEMBERSHIP_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
                  </select>
                  <input required name="price" type="number" min="0" max="1000000" step="0.01" placeholder="Price (ETB)" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input name="duration_days" type="number" min="1" max="3650" placeholder="Duration days" className="min-w-0 rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                    <input name="sessions_included" type="number" min="1" max="10000" placeholder="Sessions" className="min-w-0 rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  </div>
                  <textarea name="description" maxLength={1000} rows={3} placeholder="Description (optional)" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <button disabled={saving} className="w-full rounded-xl bg-[#0B3D2E] px-4 py-3 text-sm font-semibold text-[#F2F7D9] disabled:opacity-60">{saving ? 'Saving...' : 'Create plan'}</button>
                </form>
              </section>
            )}

            {activeTab === 'members' && (
              <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
                <div className="space-y-3">
                  <details className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                    <summary className="cursor-pointer font-semibold text-[#0B3D2E]">Enroll an Admin-created member account</summary>
                    <p className="mt-3 text-xs leading-5 text-[#5A6660]">Urji Fit keeps account creation restricted to administrators. Find the existing account with its exact phone or email, then assign a plan. Enrollment does not collect or verify payment.</p>
                    <form onSubmit={lookupMember} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input name="email" type="email" placeholder="Exact member email" className="min-w-0 rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                      <input name="phone" placeholder="Or exact phone number" className="min-w-0 rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                      <button className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-xs font-semibold">Find account</button>
                    </form>
                    {memberLookup && (
                      <form onSubmit={enrollMember} className="mt-4 space-y-3 rounded-xl bg-[#F3EFE5] p-4">
                        <p className="text-sm font-semibold">{memberLookup.full_name} <span className="font-normal text-[#5A6660]">{memberLookup.email ?? memberLookup.phone}</span></p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <select required name="plan_id" className="rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm">
                            <option value="">Select membership plan</option>
                            {plans.filter((plan) => plan.is_active).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · ETB {plan.price}</option>)}
                          </select>
                          <input required name="start_date" type="date" min={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                        </div>
                        <div className="flex gap-2">
                          <button disabled={saving} className="rounded-lg bg-[#0B3D2E] px-4 py-2 text-xs font-semibold text-[#F2F7D9] disabled:opacity-60">Create membership</button>
                          <button type="button" onClick={() => setMemberLookup(null)} className="rounded-lg border border-[#14201A]/15 px-4 py-2 text-xs font-semibold">Clear</button>
                        </div>
                      </form>
                    )}
                  </details>
                  <input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Search name, email, phone, membership, or status"
                    aria-label="Search members"
                    className="w-full rounded-xl border border-[#14201A]/15 bg-[#FCFAF6] px-4 py-3 text-sm"
                  />
                  {filteredMembers.length === 0 && <p className="rounded-2xl bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">No matching memberships found.</p>}
                  {filteredMembers.map((member) => (
                    <article key={member.id} className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">{member.member?.full_name ?? 'Member'}</h2>
                          <p className="mt-1 text-xs text-[#5A6660]">{member.member?.email ?? member.member?.phone ?? 'No contact details'}</p>
                          <p className="mt-1 text-xs capitalize text-[#5A6660]">{member.membership_type.replaceAll('_', ' ')} · {member.status}{member.end_date ? ` · Ends ${new Date(`${member.end_date}T00:00:00`).toLocaleDateString()}` : ''}</p>
                        </div>
                        <button type="button" onClick={() => void loadMemberDetails(member.id)} className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-xs font-semibold text-[#0B3D2E]">Member record</button>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {member.status === 'active' && <button type="button" onClick={() => void updateMembership(member, 'freeze')} className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-xs font-semibold">Freeze</button>}
                        {member.status === 'suspended' && member.frozen_at && <button type="button" onClick={() => void updateMembership(member, 'resume')} className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-xs font-semibold">Resume</button>}
                        {member.status !== 'canceled' && <button type="button" onClick={() => window.confirm('Cancel this membership?') && void updateMembership(member, 'cancel')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Cancel</button>}
                        {member.status !== 'canceled' && member.plan_id && <button type="button" onClick={() => void invoiceRenewal(member)} className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-xs font-semibold text-[#0B3D2E]">Invoice renewal</button>}
                        {member.status !== 'canceled' && householdCandidates.some((candidate) => candidate.id !== member.member_id) && (
                          <select
                            aria-label={`Transfer ${member.member?.full_name ?? 'membership'} to another member`}
                            defaultValue=""
                            onChange={(event) => {
                              const destination = householdCandidates.find((candidate) => candidate.id === event.target.value);
                              if (destination && window.confirm(`Transfer this membership to ${destination.full_name}?`)) {
                                void updateMembership(member, 'transfer', destination.id);
                              }
                              event.target.value = '';
                            }}
                            className="max-w-44 rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-xs"
                          >
                            <option value="">Transfer to...</option>
                            {householdCandidates.filter((candidate) => candidate.id !== member.member_id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>)}
                          </select>
                        )}
                        <select
                          aria-label={`Change ${member.member?.full_name ?? 'member'} plan`}
                          defaultValue=""
                          onChange={(event) => {
                            const selectedPlan = plans.find((plan) => plan.id === event.target.value);
                            if (selectedPlan && window.confirm(`Switch to ${selectedPlan.name} at ETB ${selectedPlan.price.toLocaleString()} now? This updates the membership price but does not collect payment automatically.`)) {
                              void updateMembership(member, 'change_plan', selectedPlan.id);
                            }
                            event.target.value = '';
                          }}
                          className="max-w-44 rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-xs"
                        >
                          <option value="">Change plan...</option>
                          {plans.filter((plan) => plan.is_active).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · ETB {plan.price}</option>)}
                        </select>
                      </div>
                    </article>
                  ))}
                </div>

                <aside className="h-fit rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                  {!memberDetails ? (
                    <p className="text-sm text-[#5A6660]">Select a member record to review contact information, emergency contacts, goals, medical notes, and membership details. Private health information is restricted to gym owners and managers.</p>
                  ) : (
                    <form key={`${memberDetails.id}:${memberDetails.profile?.updated_at ?? ''}`} onSubmit={saveMemberDetails} className="space-y-3">
                      <div>
                        <h2 className="font-semibold text-[#0B3D2E]">{memberDetails.member.full_name}</h2>
                        <p className="mt-1 text-xs capitalize text-[#5A6660]">{memberDetails.membership_type.replaceAll('_', ' ')} · {memberDetails.status}</p>
                      </div>
                      <input required name="full_name" defaultValue={memberDetails.member.full_name} placeholder="Full name" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                      <input name="email" type="email" defaultValue={memberDetails.member.email ?? ''} placeholder="Email" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                      <input name="phone" defaultValue={memberDetails.member.phone ?? ''} placeholder="Phone" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                      <input name="avatar_url" type="url" defaultValue={memberDetails.member.avatar_url ?? ''} placeholder="Photo URL (https://...)" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <input name="emergency_contact_name" defaultValue={memberDetails.profile?.emergency_contact_name ?? ''} placeholder="Emergency name" className="min-w-0 rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                        <input name="emergency_contact_phone" defaultValue={memberDetails.profile?.emergency_contact_phone ?? ''} placeholder="Emergency phone" className="min-w-0 rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                      </div>
                      <input name="date_of_birth" type="date" defaultValue={memberDetails.profile?.date_of_birth ?? ''} className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                      <input name="address" defaultValue={memberDetails.profile?.address ?? ''} placeholder="Address" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                      <textarea name="medical_notes" rows={3} defaultValue={memberDetails.profile?.medical_notes ?? ''} placeholder="Medical notes (restricted)" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                      <textarea name="goals" rows={2} defaultValue={memberDetails.profile?.goals ?? ''} placeholder="Fitness goals" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                      <input name="tags" defaultValue={memberDetails.profile?.tags?.join(', ') ?? ''} placeholder="Tags, comma-separated" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-sm" />
                      <button disabled={saving} className="w-full rounded-lg bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9] disabled:opacity-60">{saving ? 'Saving...' : 'Save member record'}</button>
                    </form>
                  )}
                </aside>
              </section>
            )}

            {activeTab === 'households' && (
              <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-3">
                  {households.filter((household) => household.is_active).map((household) => (
                    <article key={household.id} className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h2 className="font-semibold text-[#14201A]">{household.name}</h2>
                          <p className="mt-1 text-sm text-[#5A6660]">Primary payer: {household.primary_member?.full_name ?? 'Unknown'}</p>
                          <p className="mt-2 text-xs text-[#5A6660]">{household.members.map((item) => item.member?.full_name ?? 'Member').join(', ')}</p>
                          <p className="mt-2 text-xs text-[#5A6660]">Shared billing will be connected in Phase 2.</p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => {
                            setHouseholdEditId(household.id);
                            setHouseholdName(household.name);
                            setHouseholdPrimaryId(household.primary_member_id);
                            setHouseholdMemberIds(household.members.map((item) => item.member_id));
                          }} className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-xs font-semibold">Edit</button>
                          <button type="button" onClick={() => void dissolveHousehold(household)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Dissolve</button>
                        </div>
                      </div>
                    </article>
                  ))}
                  {households.filter((household) => household.is_active).length === 0 && <p className="rounded-2xl bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">No household accounts yet.</p>}
                </div>
                <form onSubmit={saveHousehold} className="h-fit space-y-3 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                  <h2 className="font-semibold text-[#0B3D2E]">{householdEditId ? 'Edit household' : 'Create household'}</h2>
                  <input required maxLength={120} value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="Household name" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <p className="text-xs text-[#5A6660]">Select at least two existing members. Each must have a non-canceled membership at this gym.</p>
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-[#14201A]/10 bg-white p-3">
                    {householdCandidates.map((candidate) => (
                      <label key={candidate.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={householdMemberIds.includes(candidate.id)}
                          onChange={(event) => {
                            const selected = event.target.checked
                              ? [...householdMemberIds, candidate.id]
                              : householdMemberIds.filter((id) => id !== candidate.id);
                            setHouseholdMemberIds(selected);
                            if (!selected.includes(householdPrimaryId)) setHouseholdPrimaryId(selected[0] ?? '');
                          }}
                        />
                        <span>{candidate.full_name}</span>
                        <span className="ml-auto truncate text-xs text-[#5A6660]">{candidate.email ?? candidate.phone}</span>
                      </label>
                    ))}
                  </div>
                  <select required value={householdPrimaryId} onChange={(event) => setHouseholdPrimaryId(event.target.value)} className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm">
                    <option value="">Select primary payer</option>
                    {householdCandidates.filter((candidate) => householdMemberIds.includes(candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>)}
                  </select>
                  <button disabled={saving || householdMemberIds.length < 2} className="w-full rounded-xl bg-[#0B3D2E] px-4 py-3 text-sm font-semibold text-[#F2F7D9] disabled:opacity-60">{saving ? 'Saving...' : householdEditId ? 'Save household' : 'Create household'}</button>
                  {householdEditId && <button type="button" onClick={() => {
                    setHouseholdEditId('');
                    setHouseholdName('');
                    setHouseholdPrimaryId('');
                    setHouseholdMemberIds([]);
                  }} className="w-full rounded-lg border border-[#14201A]/15 px-4 py-2 text-sm font-semibold">Cancel edit</button>}
                </form>
              </section>
            )}

            {activeTab === 'leads' && (
              <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-3">
                  {leads.length === 0 && <p className="rounded-2xl bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">No leads yet. Add an inquiry to begin tracking conversion.</p>}
                  {leads.map((lead) => (
                    <article key={lead.id} className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">{lead.full_name}</h2>
                          <p className="mt-1 text-sm text-[#5A6660]">{lead.phone || lead.email} {lead.source ? `· ${lead.source}` : ''}</p>
                          {lead.notes && <p className="mt-2 text-sm text-[#5A6660]">{lead.notes}</p>}
                          {lead.trial_at && <p className="mt-2 text-xs text-[#5A6660]">Trial: {new Date(lead.trial_at).toLocaleString()}</p>}
                        </div>
                        <span className="rounded-full bg-[#F2F7D9] px-3 py-1 text-xs font-semibold capitalize text-[#0B3D2E]">{lead.status}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(['inquiry', 'trial', 'lost'] as const).filter((status) => status !== lead.status).map((status) => (
                          <button key={status} type="button" onClick={() => void updateLead(lead, status)} className="rounded-lg border border-[#14201A]/15 px-3 py-1.5 text-xs font-medium capitalize">{status}</button>
                        ))}
                      </div>
                      {lead.status !== 'converted' && (
                        <div className="mt-4 grid gap-3 border-t border-[#14201A]/10 pt-4 sm:grid-cols-2">
                          <form onSubmit={(event) => void scheduleTrial(event, lead)} className="flex gap-2">
                            <input required name="trial_at" type="datetime-local" aria-label={`Trial date for ${lead.full_name}`} className="min-w-0 flex-1 rounded-lg border border-[#14201A]/15 bg-white px-2 py-2 text-xs" />
                            <button className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-xs font-semibold">Schedule trial</button>
                          </form>
                          <form onSubmit={(event) => void convertLead(event, lead)} className="flex flex-wrap gap-2">
                            <select required name="plan_id" className="min-w-0 flex-1 rounded-lg border border-[#14201A]/15 bg-white px-2 py-2 text-xs">
                              <option value="">Membership plan</option>
                              {plans.filter((plan) => plan.is_active).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · ETB {plan.price}</option>)}
                            </select>
                            <input required name="start_date" type="date" min={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} aria-label={`Membership start date for ${lead.full_name}`} className="rounded-lg border border-[#14201A]/15 bg-white px-2 py-2 text-xs" />
                            <button disabled={saving} className="rounded-lg bg-[#0B3D2E] px-3 py-2 text-xs font-semibold text-[#F2F7D9] disabled:opacity-60">Convert</button>
                            <p className="w-full text-xs text-[#5A6660]">Requires an Admin-created member account using this lead’s exact phone or email. Conversion creates a membership; it does not collect payment.</p>
                          </form>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                <form onSubmit={createLead} className="h-fit space-y-3 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                  <h2 className="flex items-center gap-2 font-semibold text-[#0B3D2E]"><Plus className="h-4 w-4" /> Add lead</h2>
                  <input required name="full_name" maxLength={120} placeholder="Full name" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <input name="phone" maxLength={40} placeholder="Phone" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <input name="email" type="email" maxLength={254} placeholder="Email" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <input name="source" maxLength={100} placeholder="Source (walk-in, referral...)" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <textarea name="notes" maxLength={3000} rows={3} placeholder="Follow-up notes" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <button disabled={saving} className="w-full rounded-xl bg-[#0B3D2E] px-4 py-3 text-sm font-semibold text-[#F2F7D9] disabled:opacity-60">{saving ? 'Saving...' : 'Add lead'}</button>
                </form>
              </section>
            )}

            {activeTab === 'waivers' && (
              <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-4">
                  {waivers.map((waiver) => (
                    <article key={waiver.id} className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">{waiver.title} <span className="text-sm font-normal text-[#5A6660]">v{waiver.version}</span></h2>
                          <p className="mt-1 text-xs text-[#5A6660]">{waiver.is_active ? 'Active version' : 'Archived version'} · {waiver.acceptances.length} signature(s)</p>
                        </div>
                        {waiver.is_active && <span className="rounded-full bg-[#F2F7D9] px-3 py-1 text-xs font-semibold text-[#0B3D2E]">Current</span>}
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[#0B3D2E]">View waiver text and signatures</summary>
                        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-[#14201A]">{waiver.content}</pre>
                        <ul className="mt-3 space-y-2">
                          {waiver.acceptances.map((acceptance) => (
                            <li key={acceptance.id} className="flex flex-wrap justify-between gap-2 border-t border-[#14201A]/10 pt-2 text-xs">
                              <span>{acceptance.member.full_name} · “{acceptance.typed_signature}”</span>
                              <span className="text-[#5A6660]">Signed {new Date(acceptance.accepted_at).toLocaleString()} · v{acceptance.waiver_version ?? waiver.version}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </article>
                  ))}
                  {waivers.length === 0 && <p className="rounded-2xl bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">No waiver has been published yet.</p>}
                </div>
                <form onSubmit={createWaiver} className="h-fit space-y-3 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                  <h2 className="font-semibold text-[#0B3D2E]">Publish a waiver version</h2>
                  <p className="text-xs leading-5 text-[#5A6660]">Publishing makes this the active version and retires the previous one. Members must re-sign. Obtain legal review before using as a binding agreement.</p>
                  <input required name="title" maxLength={120} placeholder="Waiver title" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <textarea required name="content" minLength={1} maxLength={30000} rows={15} placeholder="Paste the complete waiver terms..." className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <button disabled={saving} className="w-full rounded-xl bg-[#0B3D2E] px-4 py-3 text-sm font-semibold text-[#F2F7D9] disabled:opacity-60">{saving ? 'Publishing...' : 'Publish new version'}</button>
                </form>
              </section>
            )}

            {activeTab === 'audit' && (
              <section className="mt-6 space-y-3">
                {auditEvents.map((event) => (
                  <article key={event.id} className="flex flex-wrap justify-between gap-3 rounded-xl border border-[#14201A]/10 bg-[#FCFAF6] p-4">
                    <div>
                      <p className="text-sm font-semibold capitalize text-[#14201A]">{event.action.replaceAll('_', ' ')}</p>
                      <p className="mt-1 text-xs text-[#5A6660]">
                        {event.actor?.full_name ?? 'System'} · {event.target_type}
                        {event.details.changed_fields && Array.isArray(event.details.changed_fields)
                          ? ` · changed ${event.details.changed_fields.join(', ')}`
                          : ''}
                      </p>
                    </div>
                    <time className="text-xs text-[#5A6660]" dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
                  </article>
                ))}
                {auditEvents.length === 0 && <p className="rounded-2xl bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">No auditable Phase 1 changes recorded yet.</p>}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
