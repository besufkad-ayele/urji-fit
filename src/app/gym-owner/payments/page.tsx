'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';

interface GymOption {
  id: string;
  name: string;
}

interface PaymentSettings {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  mobile_money_provider: string;
  mobile_money_account: string;
  payment_instructions: string;
}

interface GymPayment {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  payment_date: string;
  reference_number: string | null;
  has_receipt: boolean;
  rejection_reason: string | null;
  member: { id: string; full_name: string; email: string | null; phone: string | null } | null;
}

interface GymInvoice {
  id: string;
  invoice_number: string;
  member_id: string;
  status: string;
  total: number;
  amount_paid: number;
  due_date: string;
  source: string;
  notes: string | null;
  reminders: Array<{ id: string; reminder_type: string; status: string; due_at: string }>;
}
interface GymMemberOption {
  member_id: string;
  status: string;
  member: { id: string; full_name: string; email: string | null; phone: string | null } | null;
}
interface HouseholdOption {
  id: string;
  name: string;
  is_active: boolean;
}
interface PromoCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  redemption_count: number;
  max_redemptions: number | null;
  is_active: boolean;
}

const EMPTY_SETTINGS: PaymentSettings = {
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
  mobile_money_provider: '',
  mobile_money_account: '',
  payment_instructions: '',
};

function formatEtb(amount: number): string {
  return `ETB ${Number(amount).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function GymOwnerPaymentsPage() {
  const [gyms, setGyms] = useState<GymOption[]>([]);
  const [selectedGymId, setSelectedGymId] = useState('');
  const [settings, setSettings] = useState<PaymentSettings>(EMPTY_SETTINGS);
  const [payments, setPayments] = useState<GymPayment[]>([]);
  const [invoices, setInvoices] = useState<GymInvoice[]>([]);
  const [members, setMembers] = useState<GymMemberOption[]>([]);
  const [households, setHouseholds] = useState<HouseholdOption[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [invoiceDateRange, setInvoiceDateRange] = useState({ min: '', dueDate: '' });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function initializeInvoiceDueDate() {
    if (invoiceDateRange.dueDate) return;
    const today = new Date();
    const min = today.toISOString().slice(0, 10);
    const dueDate = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    setInvoiceDateRange({ min, dueDate });
  }

  const loadGyms = useCallback(async () => {
    try {
      const response = await fetch('/api/payments');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load your gyms.');
      const availableGyms = result.gyms as GymOption[];
      setGyms(availableGyms);
      setSelectedGymId((current) => current || availableGyms[0]?.id || '');
      if (availableGyms.length === 0) setLoading(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your gyms.');
      setLoading(false);
    }
  }, []);

  const loadGymData = useCallback(async (gymId: string) => {
    setLoading(true);
    setError('');
    try {
      const [paymentResponse, settingsResponse, memberResponse, householdResponse, promoResponse, invoiceResponse] = await Promise.all([
        fetch(`/api/payments?gymId=${encodeURIComponent(gymId)}`),
        fetch(`/api/gyms/${encodeURIComponent(gymId)}/payment-settings`),
        fetch(`/api/gyms/${encodeURIComponent(gymId)}/members`),
        fetch(`/api/gyms/${encodeURIComponent(gymId)}/households`),
        fetch(`/api/gyms/${encodeURIComponent(gymId)}/promos`),
        fetch(`/api/invoices?gymId=${encodeURIComponent(gymId)}`),
      ]);
      const [paymentResult, settingsResult, memberResult, householdResult, promoResult, invoiceResult] = await Promise.all([
        paymentResponse.json(),
        settingsResponse.json(),
        memberResponse.json(),
        householdResponse.json(),
        promoResponse.json(),
        invoiceResponse.json(),
      ]);
      if (!paymentResponse.ok) throw new Error(paymentResult.error || 'Could not load payments.');
      if (!settingsResponse.ok) throw new Error(settingsResult.error || 'Could not load payment settings.');
      if (!memberResponse.ok) throw new Error(memberResult.error || 'Could not load gym members.');
      if (!householdResponse.ok) throw new Error(householdResult.error || 'Could not load households.');
      if (!promoResponse.ok) throw new Error(promoResult.error || 'Could not load promo codes.');
      if (!invoiceResponse.ok) throw new Error(invoiceResult.error || 'Could not load invoices.');
      setPayments(paymentResult.payments ?? []);
      setInvoices(invoiceResult.invoices ?? []);
      setMembers(memberResult.memberships ?? []);
      setHouseholds(householdResult.households ?? []);
      setPromoCodes(promoResult.promo_codes ?? []);
      setSettings({
        bank_name: settingsResult.settings.bank_name ?? '',
        bank_account_name: settingsResult.settings.bank_account_name ?? '',
        bank_account_number: settingsResult.settings.bank_account_number ?? '',
        mobile_money_provider: settingsResult.settings.mobile_money_provider ?? '',
        mobile_money_account: settingsResult.settings.mobile_money_account ?? '',
        payment_instructions: settingsResult.settings.payment_instructions ?? '',
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load payments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // This effect loads the authorized locations available to the current session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGyms();
  }, [loadGyms]);

  useEffect(() => {
    if (selectedGymId) {
      // This effect synchronizes the selected location with its protected API data.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadGymData(selectedGymId);
    }
  }, [loadGymData, selectedGymId]);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedGymId) return;
    setSavingSettings(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/gyms/${encodeURIComponent(selectedGymId)}/payment-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save payment settings.');
      setNotice('Transfer instructions saved. Members can now see these details on their Payments page.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save payment settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const reviewPayment = async (paymentId: string, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? window.prompt('Enter a reason for rejecting this receipt:')?.trim() : '';
    if (action === 'reject' && !reason) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not review this payment.');
      setNotice(action === 'approve' ? 'Payment marked as verified.' : 'Receipt rejected with a reason.');
      await loadGymData(selectedGymId);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not review this payment.');
    }
  };

  const updateSetting = (field: keyof PaymentSettings, value: string) => {
    setSettings((current) => ({ ...current, [field]: value }));
  };

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gym_id: selectedGymId,
          description: form.get('description'),
          due_date: form.get('due_date'),
          ...(form.get('household_id')
            ? { household_id: form.get('household_id') }
            : {
                member_id: form.get('member_id'),
                amount: Number(form.get('amount')),
                promo_code: form.get('promo_code') || null,
              }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create invoice.');
      setNotice('Invoice created. The member can view it and submit a transfer receipt.');
      formElement.reset();
      await loadGymData(selectedGymId);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create invoice.');
    }
  }

  async function createPromo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/gyms/${selectedGymId}/promos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: values.get('code'),
          discount_type: values.get('discount_type'),
          discount_value: Number(values.get('discount_value')),
          max_redemptions: values.get('max_redemptions') ? Number(values.get('max_redemptions')) : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create promo code.');
      setNotice('Promo code created.');
      form.reset();
      await loadGymData(selectedGymId);
    } catch (promoError) {
      setError(promoError instanceof Error ? promoError.message : 'Could not create promo code.');
    }
  }

  async function setPromoAvailability(promo: PromoCode) {
    try {
      const response = await fetch(`/api/gyms/${selectedGymId}/promos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promo.id, is_active: !promo.is_active }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update promo code.');
      setNotice(`Promo code ${promo.is_active ? 'deactivated' : 'activated'}.`);
      await loadGymData(selectedGymId);
    } catch (promoError) {
      setError(promoError instanceof Error ? promoError.message : 'Could not update promo code.');
    }
  }

  async function updateReminder(reminderId: string, action: 'complete' | 'dismiss') {
    try {
      const response = await fetch('/api/invoices/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_id: reminderId, action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update reminder.');
      setNotice(action === 'complete' ? 'Invoice follow-up marked complete.' : 'Invoice reminder dismissed.');
      await loadGymData(selectedGymId);
    } catch (reminderError) {
      setError(reminderError instanceof Error ? reminderError.message : 'Could not update reminder.');
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/gym-owner" className="text-sm font-semibold text-[#0B3D2E] underline">← Gym dashboard</Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#C1502E]">Gym operations · billing</p>
            <h1 className="mt-1 font-serif text-4xl text-[#0B3D2E]">Transfer receipts</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5A6660]">Set the official transfer details members should use and review receipt screenshots. Approval records a payment; it does not automatically create or renew a membership.</p>
          </div>
          {gyms.length > 1 && (
            <label className="text-xs font-semibold uppercase tracking-wide text-[#5A6660]">
              Location
              <select value={selectedGymId} onChange={(event) => setSelectedGymId(event.target.value)} className="mt-1 block min-w-52 rounded-xl border border-[#14201A]/15 bg-[#FCFAF6] px-3 py-2.5 text-sm font-normal normal-case text-[#14201A]">
                {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
              </select>
            </label>
          )}
        </header>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {!loading && gyms.length === 0 && (
          <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">
            No gym locations are assigned to your account.
          </section>
        )}

        {selectedGymId && (
          <>
            <form onSubmit={saveSettings} className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm sm:p-7">
              <h2 className="font-serif text-2xl text-[#14201A]">Member transfer instructions</h2>
              <p className="mt-1 text-sm text-[#5A6660]">Members see these details before they upload a screenshot. Double-check account numbers before saving.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {([
                  ['bank_name', 'Bank name', 'e.g. Commercial Bank of Ethiopia'],
                  ['bank_account_name', 'Bank account holder', 'Account holder name'],
                  ['bank_account_number', 'Bank account number', 'Account number'],
                  ['mobile_money_provider', 'Mobile money provider', 'Provider name'],
                  ['mobile_money_account', 'Mobile money number', 'Wallet or phone number'],
                ] as const).map(([field, label, placeholder]) => (
                  <label key={field} className="text-xs font-semibold uppercase tracking-wide text-[#5A6660]">
                    {label}
                    <input value={settings[field]} onChange={(event) => updateSetting(field, event.target.value)} maxLength={500} className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm font-normal normal-case text-[#14201A]" placeholder={placeholder} />
                  </label>
                ))}
                <label className="text-xs font-semibold uppercase tracking-wide text-[#5A6660] sm:col-span-2">
                  Additional instructions
                  <textarea value={settings.payment_instructions} onChange={(event) => updateSetting('payment_instructions', event.target.value)} maxLength={500} rows={3} className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm font-normal normal-case text-[#14201A]" placeholder="Include any required transfer note or confirmation timing." />
                </label>
              </div>
              <button type="submit" disabled={savingSettings || loading} className="mt-5 rounded-xl bg-[#0B3D2E] px-5 py-3 text-sm font-semibold text-[#F2F7D9] transition hover:bg-[#135440] disabled:opacity-50">
                {savingSettings ? 'Saving…' : 'Save transfer details'}
              </button>
            </form>

            <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl text-[#14201A]">Payment submissions</h2>
                  <p className="mt-1 text-sm text-[#5A6660]">Verify the amount and transaction reference against your bank or wallet before approval.</p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
                  {payments.filter((payment) => payment.status === 'pending').length} awaiting review
                </span>
              </div>
              {loading ? (
                <p className="mt-5 text-sm text-[#5A6660]">Loading receipts…</p>
              ) : payments.length === 0 ? (
                <p className="mt-5 text-sm text-[#5A6660]">No receipts have been submitted to this gym.</p>
              ) : (
                <ul className="mt-4 divide-y divide-[#14201A]/10">
                  {payments.map((payment) => (
                    <li key={payment.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-[#14201A]">{payment.member?.full_name || 'Member'} · {formatEtb(payment.amount)}</p>
                        <p className="mt-1 text-xs text-[#5A6660]">
                          {payment.payment_method.replaceAll('_', ' ')}
                          {payment.reference_number ? ` · Ref ${payment.reference_number}` : ''}
                          {' · '}{new Date(payment.payment_date).toLocaleString()}
                        </p>
                        {payment.member?.phone && <p className="mt-1 text-xs text-[#5A6660]">{payment.member.phone}</p>}
                        {payment.rejection_reason && <p className="mt-1 text-xs text-[#C1502E]">Rejection reason: {payment.rejection_reason}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${payment.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : payment.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{payment.status}</span>
                        {payment.has_receipt && (
                          <a href={`/api/payments/${payment.id}/receipt`} target="_blank" rel="noreferrer" className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-xs font-semibold text-[#0B3D2E] underline">Open receipt</a>
                        )}
                        {payment.status === 'pending' && (
                          <>
                            <button type="button" onClick={() => void reviewPayment(payment.id, 'approve')} className="rounded-lg bg-[#0B3D2E] px-3 py-2 text-xs font-semibold text-[#F2F7D9] hover:bg-[#135440]">Verify payment</button>
                            <button type="button" onClick={() => void reviewPayment(payment.id, 'reject')} className="rounded-lg border border-[#C1502E]/30 px-3 py-2 text-xs font-semibold text-[#C1502E] hover:bg-[#FBE9E1]">Reject</button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm sm:p-7">
                <h2 className="font-serif text-2xl text-[#14201A]">Invoices</h2>
                <p className="mt-1 text-sm text-[#5A6660]">Issued ETB balances, payment progress, and due dates.</p>
                <ul className="mt-4 divide-y divide-[#14201A]/10">
                  {invoices.map((invoice) => {
                    const member = members.find((item) => item.member_id === invoice.member_id)?.member;
                    return (
                      <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div>
                          <p className="font-semibold text-[#14201A]">{invoice.invoice_number} · {member?.full_name ?? 'Member'} · {formatEtb(invoice.total)}</p>
                          <p className="mt-1 text-xs text-[#5A6660]">{invoice.notes ?? invoice.source.replaceAll('_', ' ')} · Due {new Date(`${invoice.due_date}T12:00:00`).toLocaleDateString()} · Paid {formatEtb(invoice.amount_paid)}</p>
                          {invoice.reminders?.filter((reminder) => reminder.status === 'open').map((reminder) => (
                            <p key={reminder.id} className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#C1502E]">
                              {reminder.reminder_type.replaceAll('_', ' ')} follow-up
                              <button type="button" onClick={() => void updateReminder(reminder.id, 'complete')} className="font-semibold underline">Complete</button>
                              <button type="button" onClick={() => void updateReminder(reminder.id, 'dismiss')} className="font-semibold underline">Dismiss</button>
                            </p>
                          ))}
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{invoice.status.replaceAll('_', ' ')}</span>
                      </li>
                    );
                  })}
                  {invoices.length === 0 && <li className="py-4 text-sm text-[#5A6660]">No invoices issued.</li>}
                </ul>
              </div>
              <form onSubmit={createInvoice} className="h-fit space-y-3 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm">
                <h2 className="font-serif text-2xl text-[#14201A]">Create invoice</h2>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#5A6660]">
                  Household payer (optional)
                  <select name="household_id" defaultValue="" className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm font-normal normal-case text-[#14201A]">
                    <option value="">Invoice one member</option>
                    {households.filter((household) => household.is_active).map((household) => <option key={household.id} value={household.id}>{household.name} · consolidate unpaid memberships</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#5A6660]">
                  Member
                  <select name="member_id" defaultValue="" className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm font-normal normal-case text-[#14201A]">
                    <option value="">Select a current member</option>
                    {[...new Map(members.filter((item) => ['active', 'suspended'].includes(item.status) && item.member).map((item) => [item.member_id, item.member!])).values()].map((member) => (
                      <option key={member.id} value={member.id}>{member.full_name} · {member.email ?? member.phone ?? member.id}</option>
                    ))}
                  </select>
                </label>
                <input required name="description" maxLength={200} placeholder="Invoice description" className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm" />
                <input name="amount" type="number" min="0.01" max="1000000" step="0.01" placeholder="Amount ETB (member invoice)" className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm" />
                <input name="promo_code" maxLength={40} placeholder="Promo code (member invoice)" className="w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm uppercase" />
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#5A6660]">Due date
                  <input required name="due_date" type="date" min={invoiceDateRange.min || undefined} value={invoiceDateRange.dueDate} onFocus={initializeInvoiceDueDate} onChange={(event) => setInvoiceDateRange((current) => ({ ...current, dueDate: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm font-normal normal-case text-[#14201A]" />
                </label>
                <button type="submit" className="w-full rounded-xl bg-[#0B3D2E] px-4 py-3 text-sm font-semibold text-[#F2F7D9]">Issue invoice</button>
                <p className="text-xs leading-5 text-[#5A6660]">A household invoice consolidates its unpaid membership invoices and goes to the primary payer. It does not charge a payment method; staff still verify a transfer receipt.</p>
              </form>
            </section>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm">
                <h2 className="font-serif text-2xl text-[#14201A]">Promo codes</h2>
                <ul className="mt-3 divide-y divide-[#14201A]/10">
                  {promoCodes.map((promo) => (
                    <li key={promo.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-semibold text-[#14201A]">{promo.code} · {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : formatEtb(promo.discount_value)}</p>
                        <p className="mt-1 text-xs text-[#5A6660]">{promo.redemption_count}{promo.max_redemptions ? ` / ${promo.max_redemptions}` : ''} redemptions</p>
                      </div>
                      <button type="button" onClick={() => void setPromoAvailability(promo)} className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-xs font-semibold">{promo.is_active ? 'Deactivate' : 'Activate'}</button>
                    </li>
                  ))}
                  {promoCodes.length === 0 && <li className="py-4 text-sm text-[#5A6660]">No promo codes configured.</li>}
                </ul>
              </div>
              <form onSubmit={createPromo} className="space-y-3 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm">
                <h2 className="font-serif text-2xl text-[#14201A]">Create promo</h2>
                <input required name="code" maxLength={40} placeholder="Code (e.g. WELCOME10)" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm uppercase" />
                <select name="discount_type" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm"><option value="percentage">Percentage</option><option value="fixed">Fixed ETB</option></select>
                <input required name="discount_value" type="number" min="0.01" max="1000000" step="0.01" placeholder="Discount value" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                <input name="max_redemptions" type="number" min="1" max="1000000" placeholder="Maximum redemptions (optional)" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                <button className="w-full rounded-xl bg-[#0B3D2E] px-4 py-3 text-sm font-semibold text-[#F2F7D9]">Create promo code</button>
              </form>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
