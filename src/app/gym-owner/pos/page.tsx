'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';

type Gym = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
};

function formatEtb(value: number): string {
  return `ETB ${value.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function GymPosPage() {
  const { user, loading: sessionLoading } = useUserSession();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadProducts = useCallback(async (selectedGymId: string) => {
    if (!selectedGymId) return;
    setError('');
    try {
      const response = await fetch(`/api/gyms/${selectedGymId}/products`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load inventory.');
      setProducts(result.products ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load inventory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionLoading || !user) return;
    let current = true;
    const loadGyms = async () => {
      try {
        const response = await fetch('/api/payments');
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load gym locations.');
        if (!current) return;
        setGyms(result.gyms ?? []);
        const selected = result.gyms?.[0]?.id ?? '';
        setGymId(selected);
        if (!selected) setLoading(false);
        else await loadProducts(selected);
      } catch (loadError) {
        if (current) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load gym locations.');
          setLoading(false);
        }
      }
    };
    void loadGyms();
    return () => { current = false; };
  }, [loadProducts, sessionLoading, user]);

  const cart = products.filter((product) => (quantities[product.id] ?? 0) > 0);
  const total = cart.reduce((sum, product) => sum + Number(product.price) * quantities[product.id], 0);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/gyms/${gymId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.get('name'),
          sku: values.get('sku'),
          price: Number(values.get('price')),
          cost: values.get('cost') ? Number(values.get('cost')) : undefined,
          stock_quantity: Number(values.get('stock_quantity')),
          low_stock_threshold: Number(values.get('low_stock_threshold')),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not add product.');
      form.reset();
      setNotice('Product added to inventory.');
      await loadProducts(gymId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add product.');
    } finally {
      setSaving(false);
    }
  }

  async function adjustStock(product: Product) {
    const quantity = Number(window.prompt(`Enter stock adjustment for ${product.name} (positive to add, negative to remove):`));
    if (!Number.isInteger(quantity) || quantity === 0) return;
    const reason = window.prompt('Reason for this stock adjustment:')?.trim();
    if (!reason) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/gyms/${gymId}/products`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, quantity_delta: quantity, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not adjust stock.');
      setNotice(`Stock updated: ${result.stock_quantity} units.`);
      await loadProducts(gymId);
    } catch (adjustError) {
      setError(adjustError instanceof Error ? adjustError.message : 'Could not adjust stock.');
    } finally {
      setSaving(false);
    }
  }

  async function checkout() {
    if (!gymId || cart.length === 0) return;
    if (!window.confirm(`Record this cash sale for ${formatEtb(total)}?`)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/gyms/${gymId}/pos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart.map((product) => ({ product_id: product.id, quantity: quantities[product.id] })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not complete sale.');
      setQuantities({});
      setNotice(`Cash sale recorded: ${formatEtb(Number(result.sale.sale_total))}. Receipt ${result.sale.sale_id}.`);
      await loadProducts(gymId);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Could not complete sale.');
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]">Loading point of sale...</main>;
  }

  return (
    <div className="min-h-screen bg-[#F3EFE5] md:flex">
      <Navigation userFullName={user.full_name} userRole={user.role} />
      <main className="min-w-0 flex-1 px-4 py-8 pb-24 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Link href="/gym-owner" className="text-sm font-semibold text-[#0B3D2E] underline">← Gym dashboard</Link>
          <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5A6660]">Retail operations</p>
              <h1 className="mt-2 font-serif text-4xl text-[#0B3D2E]">Point of sale & inventory</h1>
              <p className="mt-2 text-sm text-[#5A6660]">Manage stock and record cash sales. Digital payments still use the receipt-verification workflow.</p>
            </div>
            {gyms.length > 1 && <select value={gymId} onChange={(event) => { setGymId(event.target.value); setLoading(true); void loadProducts(event.target.value); }} className="rounded-xl border border-[#14201A]/15 bg-[#FCFAF6] px-3 py-2.5 text-sm">{gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}</select>}
          </header>
          {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
          {!gymId ? <p className="mt-6 rounded-2xl bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">No gym locations are assigned to this account.</p> : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                <h2 className="font-serif text-2xl text-[#14201A]">Products</h2>
                {loading ? <p className="mt-4 text-sm text-[#5A6660]">Loading inventory...</p> : products.filter((item) => item.is_active).length === 0 ? <p className="mt-4 text-sm text-[#5A6660]">Add products to start selling.</p> : (
                  <ul className="mt-3 divide-y divide-[#14201A]/10">
                    {products.filter((item) => item.is_active).map((product) => (
                      <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div>
                          <p className="font-semibold text-[#14201A]">{product.name} · {formatEtb(Number(product.price))}</p>
                          <p className={`mt-1 text-xs ${product.stock_quantity <= product.low_stock_threshold ? 'font-semibold text-[#C1502E]' : 'text-[#5A6660]'}`}>
                            Stock {product.stock_quantity}{product.sku ? ` · SKU ${product.sku}` : ''}
                            {product.stock_quantity <= product.low_stock_threshold ? ' · Low stock' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => void adjustStock(product)} disabled={saving} className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-xs font-semibold disabled:opacity-60">Adjust stock</button>
                          <input aria-label={`Quantity for ${product.name}`} type="number" min="0" max={product.stock_quantity} value={quantities[product.id] ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: Math.min(product.stock_quantity, Math.max(0, Number(event.target.value) || 0)) }))} className="w-20 rounded-lg border border-[#14201A]/15 px-2 py-2 text-sm" />
                          <button type="button" onClick={() => setQuantities((current) => ({ ...current, [product.id]: Math.min(product.stock_quantity, (current[product.id] ?? 0) + 1) }))} disabled={product.stock_quantity === 0} className="rounded-lg bg-[#0B3D2E] px-3 py-2 text-xs font-semibold text-[#F2F7D9] disabled:opacity-50">Add</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <div className="space-y-6">
                <form onSubmit={createProduct} className="space-y-3 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                  <h2 className="font-serif text-2xl text-[#14201A]">Add product</h2>
                  <input required name="name" maxLength={120} placeholder="Product name" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <input name="sku" maxLength={80} placeholder="SKU (optional)" className="w-full rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <input required name="price" type="number" min="0" max="1000000" step="0.01" placeholder="Price ETB" className="min-w-0 rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                    <input name="cost" type="number" min="0" max="1000000" step="0.01" placeholder="Cost ETB" className="min-w-0 rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input required name="stock_quantity" type="number" min="0" max="1000000" defaultValue="0" placeholder="Opening stock" className="min-w-0 rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                    <input required name="low_stock_threshold" type="number" min="0" max="1000000" defaultValue="5" placeholder="Low stock alert" className="min-w-0 rounded-lg border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm" />
                  </div>
                  <button disabled={saving} className="w-full rounded-xl bg-[#0B3D2E] px-4 py-3 text-sm font-semibold text-[#F2F7D9] disabled:opacity-60">{saving ? 'Saving...' : 'Add to inventory'}</button>
                </form>
                <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                  <h2 className="font-serif text-2xl text-[#14201A]">Cash checkout</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {cart.map((product) => <li key={product.id} className="flex justify-between gap-3"><span>{quantities[product.id]} × {product.name}</span><span>{formatEtb(Number(product.price) * quantities[product.id])}</span></li>)}
                    {cart.length === 0 && <li className="text-[#5A6660]">No products in the cart.</li>}
                  </ul>
                  <p className="mt-4 border-t border-[#14201A]/10 pt-3 font-semibold">Total <span className="float-right">{formatEtb(total)}</span></p>
                  <button type="button" onClick={() => void checkout()} disabled={saving || cart.length === 0} className="mt-4 w-full rounded-xl bg-[#0B3D2E] px-4 py-3 text-sm font-semibold text-[#F2F7D9] disabled:opacity-50">Record cash sale</button>
                </section>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
