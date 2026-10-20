'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';

interface PaymentGym {
  id: string;
  name: string;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  mobile_money_provider: string | null;
  mobile_money_account: string | null;
  payment_instructions: string | null;
}

interface Membership {
  id: string;
  gym_id: string;
  membership_type: string;
  price: number;
  status: string;
}

interface Payment {
  id: string;
  gym_id: string;
  membership_id: string | null;
  amount: number;
  currency: string;
  payment_method: 'bank_transfer' | 'mobile_money' | string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_date: string;
  reference_number: string | null;
  rejection_reason: string | null;
  has_receipt: boolean;
}

interface Invoice {
  id: string;
  gym_id: string;
  invoice_number: string;
  membership_id: string | null;
  source: string;
  status: 'draft' | 'open' | 'partially_paid' | 'paid' | 'overdue' | 'void';
  total: number;
  amount_paid: number;
  due_date: string;
  notes: string | null;
  lines: Array<{ id: string; description: string; line_total: number }>;
}

interface PaymentData {
  gyms: PaymentGym[];
  memberships: Membership[];
  payments: Payment[];
  invoices: Invoice[];
}

function formatEtb(amount: number): string {
  return `ETB ${Number(amount).toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PaymentsPage() {
  const { user, loading: sessionLoading } = useUserSession();
  const [data, setData] = useState<PaymentData>({ gyms: [], memberships: [], payments: [], invoices: [] });
  const [selectedGymId, setSelectedGymId] = useState('');
  const [membershipId, setMembershipId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'mobile_money'>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/payments');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load payment information.');
      const paymentData = result as PaymentData;
      setData(paymentData);
      setSelectedGymId((current) => current || paymentData.gyms[0]?.id || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load payment information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) {
      // This effect synchronizes the page with the authenticated payment API.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadPayments();
    }
  }, [loadPayments, sessionLoading]);

  const selectedGym = data.gyms.find((gym) => gym.id === selectedGymId);
  const gymMemberships = useMemo(
    () => data.memberships.filter((membership) => membership.gym_id === selectedGymId),
    [data.memberships, selectedGymId]
  );
  const selectedMembership = gymMemberships.find((membership) => membership.id === membershipId);
  const gymPayments = data.payments.filter((payment) => payment.gym_id === selectedGymId);
  const gymInvoices = data.invoices.filter((invoice) => invoice.gym_id === selectedGymId);
  const selectedInvoice = gymInvoices.find((invoice) => invoice.id === invoiceId);
  const payableInvoices = gymInvoices.filter((invoice) => ['open', 'partially_paid', 'overdue'].includes(invoice.status));
  const methodAvailable =
    paymentMethod === 'bank_transfer'
      ? Boolean(selectedGym?.bank_account_number)
      : Boolean(selectedGym?.mobile_money_provider && selectedGym.mobile_money_account);

  const handleMembershipChange = (value: string) => {
    setMembershipId(value);
    setInvoiceId('');
    const membership = gymMemberships.find((item) => item.id === value);
    if (membership) setAmount(String(membership.price));
  };

  const handleInvoiceChange = (value: string) => {
    setInvoiceId(value);
    setMembershipId('');
    const invoice = gymInvoices.find((item) => item.id === value);
    if (invoice) setAmount((Number(invoice.total) - Number(invoice.amount_paid)).toFixed(2));
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!selectedGym || !receipt) {
      setError('Choose a gym and attach a screenshot of your payment receipt.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.set('gymId', selectedGym.id);
    if (invoiceId) formData.set('invoiceId', invoiceId);
    else if (membershipId) formData.set('membershipId', membershipId);
    formData.set('amount', amount);
    formData.set('paymentMethod', paymentMethod);
    formData.set('referenceNumber', referenceNumber);
    formData.set('receipt', receipt);

    try {
      const response = await fetch('/api/payments', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Payment receipt could not be submitted.');
      setSuccess('Your receipt was submitted. The gym team will review it and update your payment status.');
      setReferenceNumber('');
      setReceipt(null);
      setMembershipId('');
      setAmount('');
      form.reset();
      await loadPayments();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Payment receipt could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-sm text-[var(--text-muted)]">
        Checking your member session…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] md:flex">
      <Navigation userFullName={user.full_name} userRole={user.role} />
      <main className="mx-auto w-full max-w-5xl space-y-7 px-4 pb-28 pt-8 md:px-8 md:pb-12">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C1502E]">Membership payments</p>
          <h1 className="mt-1 font-serif text-4xl text-[#0B3D2E]">Pay by bank or mobile money</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5A6660]">
            Transfer ETB to your gym, then submit a screenshot of the receipt. A staff member must verify the payment.
          </p>
        </header>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}

        {loading ? (
          <div className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">Loading payment options…</div>
        ) : data.gyms.length === 0 ? (
          <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-6">
            <h2 className="font-serif text-2xl text-[#14201A]">No gyms are available</h2>
            <p className="mt-2 text-sm text-[#5A6660]">Ask your gym administrator to connect your account to a gym.</p>
            <Link className="mt-4 inline-block text-sm font-semibold text-[#0B3D2E] underline" href="/dashboard">Return to your dashboard</Link>
          </section>
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm">
                <h2 className="font-serif text-2xl text-[#14201A]">Transfer details</h2>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#5A6660]">
                  Gym
                  <select
                    value={selectedGymId}
                    onChange={(event) => {
                      setSelectedGymId(event.target.value);
                      setMembershipId('');
                      setInvoiceId('');
                      setAmount('');
                    }}
                    className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm font-normal normal-case text-[#14201A]"
                  >
                    {data.gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
                  </select>
                </label>
                {selectedGym && (
                  <div className="mt-4 space-y-3 rounded-xl bg-[#F3EFE5] p-4 text-sm">
                    {selectedGym.bank_account_number && (
                      <div>
                        <p className="font-semibold text-[#14201A]">Bank transfer</p>
                        <p className="mt-1 text-[#5A6660]">{selectedGym.bank_name || 'Bank'} · {selectedGym.bank_account_name || 'Account name not provided'}</p>
                        <p className="mt-0.5 font-mono text-[#0B3D2E]">{selectedGym.bank_account_number}</p>
                      </div>
                    )}
                    {selectedGym.mobile_money_provider && selectedGym.mobile_money_account && (
                      <div>
                        <p className="font-semibold text-[#14201A]">{selectedGym.mobile_money_provider}</p>
                        <p className="mt-0.5 font-mono text-[#0B3D2E]">{selectedGym.mobile_money_account}</p>
                      </div>
                    )}
                    {selectedGym.payment_instructions && <p className="whitespace-pre-wrap border-t border-[#14201A]/10 pt-3 text-[#5A6660]">{selectedGym.payment_instructions}</p>}
                    {!selectedGym.bank_account_number && !selectedGym.mobile_money_account && (
                      <p className="text-[#5A6660]">This gym has not added transfer instructions yet. Contact the gym before sending money.</p>
                    )}
                  </div>
                )}
                <p className="mt-3 text-xs leading-5 text-[#5A6660]">Only transfer to the account details shown here. Urji Fit does not collect or hold your money.</p>
              </div>

              <form onSubmit={submitPayment} className="space-y-4 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm">
                <h2 className="font-serif text-2xl text-[#14201A]">Submit receipt screenshot</h2>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#5A6660]">
                  Open invoice
                  <select
                    value={invoiceId}
                    onChange={(event) => handleInvoiceChange(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm font-normal normal-case text-[#14201A]"
                  >
                    <option value="">Choose invoice (optional)</option>
                    {payableInvoices.map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} · ETB {(Number(invoice.total) - Number(invoice.amount_paid)).toFixed(2)} due · {invoice.status}
                      </option>
                    ))}
                  </select>
                  {selectedInvoice && <span className="mt-1 block font-normal normal-case">Due {new Date(`${selectedInvoice.due_date}T12:00:00`).toLocaleDateString()} · Partial payments are accepted up to the remaining balance.</span>}
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#5A6660]">
                  Membership (only if not paying an invoice)
                  <select
                    value={membershipId}
                    onChange={(event) => handleMembershipChange(event.target.value)}
                    disabled={Boolean(invoiceId)}
                    className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm font-normal normal-case text-[#14201A]"
                  >
                    <option value="">Other membership payment</option>
                    {gymMemberships.map((membership) => (
                      <option key={membership.id} value={membership.id}>
                        {membership.membership_type.replaceAll('_', ' ')} · {membership.status} · {formatEtb(membership.price)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#5A6660]">
                  Amount (ETB)
                  <input
                    required
                    type="number"
                    min="1"
                    max="1000000"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    readOnly={Boolean(selectedMembership)}
                    className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm font-normal normal-case text-[#14201A] read-only:bg-[#F3EFE5]"
                  />
                </label>
                <fieldset className="grid grid-cols-2 gap-3">
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5A6660]">Transfer method</legend>
                  {([
                    ['bank_transfer', 'Bank transfer', Boolean(selectedGym?.bank_account_number)],
                    ['mobile_money', 'Mobile money', Boolean(selectedGym?.mobile_money_provider && selectedGym.mobile_money_account)],
                  ] as const).map(([value, label, available]) => (
                    <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${paymentMethod === value ? 'border-[#0B3D2E] bg-[#F2F7D9]/70 text-[#0B3D2E]' : 'border-[#14201A]/10 text-[#5A6660]'} ${!available ? 'opacity-50' : ''}`}>
                      <input type="radio" name="paymentMethod" value={value} checked={paymentMethod === value} disabled={!available} onChange={() => setPaymentMethod(value)} />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#5A6660]">
                  Transfer reference (optional)
                  <input
                    value={referenceNumber}
                    onChange={(event) => setReferenceNumber(event.target.value)}
                    maxLength={100}
                    className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-3 text-sm font-normal normal-case text-[#14201A]"
                    placeholder="Reference shown by your bank or wallet"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#5A6660]">
                  Receipt image
                  <input
                    required
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
                    className="mt-1.5 block w-full rounded-xl border border-[#14201A]/15 bg-white p-3 text-sm font-normal normal-case text-[#14201A] file:mr-3 file:rounded-lg file:border-0 file:bg-[#F2F7D9] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#0B3D2E]"
                  />
                  <span className="mt-1 block font-normal normal-case">JPG, PNG, or WebP · up to 5 MB</span>
                </label>
                <button
                  type="submit"
                  disabled={submitting || !methodAvailable}
                  className="w-full rounded-xl bg-[#0B3D2E] px-4 py-3 text-sm font-semibold text-[#F2F7D9] transition hover:bg-[#135440] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Submitting receipt…' : 'Send receipt for verification'}
                </button>
                {!methodAvailable && <p className="text-xs text-[#C1502E]">Select a method configured by this gym before submitting.</p>}
              </form>
            </section>

            <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm">
              <h2 className="font-serif text-2xl text-[#14201A]">Invoices</h2>
              {gymInvoices.length === 0 ? (
                <p className="mt-3 text-sm text-[#5A6660]">No invoices for this gym yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-[#14201A]/10">
                  {gymInvoices.map((invoice) => (
                    <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-semibold text-[#14201A]">{invoice.invoice_number} · {formatEtb(invoice.total)}</p>
                        <p className="mt-1 text-xs text-[#5A6660]">
                          {invoice.lines.map((line) => line.description).join(', ') || invoice.notes || invoice.source.replaceAll('_', ' ')}
                          {' · Due '}{new Date(`${invoice.due_date}T12:00:00`).toLocaleDateString()}
                        </p>
                        <p className="mt-1 text-xs text-[#5A6660]">Paid {formatEtb(invoice.amount_paid)} · Balance {formatEtb(Number(invoice.total) - Number(invoice.amount_paid))}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{invoice.status.replaceAll('_', ' ')}</span>
                        {payableInvoices.some((item) => item.id === invoice.id) && (
                          <button type="button" onClick={() => handleInvoiceChange(invoice.id)} className="rounded-lg bg-[#0B3D2E] px-3 py-2 text-xs font-semibold text-[#F2F7D9]">Pay</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-[#5A6660]">Memberships requiring payment become active only after staff verify enough payment to settle the invoice. Transfer money outside Urji Fit and attach the receipt; no card or mobile-wallet processor is connected.</p>
            </section>

            <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm">
              <h2 className="font-serif text-2xl text-[#14201A]">Payment history</h2>
              {gymPayments.length === 0 ? (
                <p className="mt-3 text-sm text-[#5A6660]">No payments submitted to this gym yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-[#14201A]/10">
                  {gymPayments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-semibold text-[#14201A]">{formatEtb(payment.amount)} · {payment.payment_method.replaceAll('_', ' ')}</p>
                        <p className="mt-1 text-xs text-[#5A6660]">{new Date(payment.payment_date).toLocaleString()} {payment.reference_number ? `· Ref ${payment.reference_number}` : ''}</p>
                        {payment.rejection_reason && <p className="mt-1 text-xs text-[#C1502E]">Reason: {payment.rejection_reason}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${payment.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : payment.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{payment.status}</span>
                        {payment.has_receipt && (
                          <a href={`/api/payments/${payment.id}/receipt`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#0B3D2E] underline">View receipt</a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
