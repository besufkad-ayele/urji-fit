import { NextRequest, NextResponse } from 'next/server';
import { canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { recordGymAuditEvent } from '@/lib/gym-audit';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view inventory.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canManageGym(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to view this gym inventory.' }, { status: 403 });
    }
    const { data: products, error } = await getSupabaseAdmin()
      .from('gym_products')
      .select('id, gym_id, sku, name, description, price, cost, stock_quantity, low_stock_threshold, is_active, created_at, updated_at')
      .eq('gym_id', gymId)
      .order('name');
    if (error) throw new Error(`Failed to load inventory: ${error.message}`);
    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load inventory.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin inventory changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to create an inventory product.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canManageGym(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage this gym inventory.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.name !== 'string' || typeof body.price !== 'number') {
      return NextResponse.json({ error: 'Product name and price are required.' }, { status: 400 });
    }
    const name = body.name.trim();
    if (!name || name.length > 120) return NextResponse.json({ error: 'Product name must be 1 to 120 characters.' }, { status: 400 });
    if (!Number.isFinite(body.price) || body.price < 0 || body.price > 1000000 || Math.round(body.price * 100) !== body.price * 100) {
      return NextResponse.json({ error: 'Price must be a valid ETB amount.' }, { status: 400 });
    }
    const stock = body.stock_quantity ?? 0;
    const threshold = body.low_stock_threshold ?? 5;
    if (!Number.isInteger(stock) || Number(stock) < 0 || Number(stock) > 1000000 ||
      !Number.isInteger(threshold) || Number(threshold) < 0 || Number(threshold) > 1000000) {
      return NextResponse.json({ error: 'Stock and low-stock threshold must be valid non-negative quantities.' }, { status: 400 });
    }
    let cost: number | null = null;
    if (body.cost !== undefined && body.cost !== null) {
      if (typeof body.cost !== 'number' || !Number.isFinite(body.cost) || body.cost < 0 ||
        body.cost > 1000000 || Math.round(body.cost * 100) !== body.cost * 100) {
        return NextResponse.json({ error: 'Cost must be a valid non-negative ETB amount.' }, { status: 400 });
      }
      cost = body.cost;
    }
    const { data: product, error } = await getSupabaseAdmin()
      .from('gym_products')
      .insert({
        gym_id: gymId,
        sku: typeof body.sku === 'string' ? body.sku.trim() || null : null,
        name,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        price: body.price,
        cost,
        stock_quantity: Number(stock),
        low_stock_threshold: Number(threshold),
      })
      .select('id, gym_id, sku, name, description, price, cost, stock_quantity, low_stock_threshold, is_active')
      .single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'That product SKU already exists at this gym.' }, { status: 409 });
      throw new Error(`Failed to create product: ${error.message}`);
    }
    if (Number(stock) > 0) {
      const { error: movementError } = await getSupabaseAdmin().from('gym_inventory_movements').insert({
        gym_id: gymId,
        product_id: product.id,
        actor_id: user.id,
        movement_type: 'initial_stock',
        quantity_delta: Number(stock),
        reason: 'Initial product stock',
      });
      if (movementError) throw new Error(`Product was created but initial stock history could not be recorded: ${movementError.message}`);
    }
    await recordGymAuditEvent({
      gymId,
      actorId: user.id,
      action: 'inventory_product_created',
      targetType: 'product',
      targetId: product.id,
      details: { name, stock_quantity: Number(stock), price_etb: body.price },
    });
    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create product.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin inventory changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to update inventory.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canManageGym(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage this gym inventory.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.product_id !== 'string') {
      return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });
    }
    if ('quantity_delta' in body) {
      if (!Number.isInteger(body.quantity_delta) || typeof body.reason !== 'string') {
        return NextResponse.json({ error: 'A whole-number stock adjustment and reason are required.' }, { status: 400 });
      }
      const { data: stockQuantity, error } = await getSupabaseAdmin().rpc('adjust_gym_product_stock', {
        p_gym_id: gymId,
        p_product_id: body.product_id,
        p_quantity_delta: body.quantity_delta,
        p_reason: body.reason.trim(),
        p_actor_id: user.id,
      });
      if (error) {
        const status = error.code === '22023' ? 400 : error.code === 'P0002' ? 404 : 500;
        return NextResponse.json({ error: error.message }, { status });
      }
      await recordGymAuditEvent({
        gymId,
        actorId: user.id,
        action: 'inventory_stock_adjusted',
        targetType: 'product',
        targetId: body.product_id,
        details: { quantity_delta: body.quantity_delta, stock_quantity: stockQuantity, reason: body.reason.trim() },
      });
      return NextResponse.json({ success: true, stock_quantity: stockQuantity });
    }
    const updates: Record<string, unknown> = {};
    if ('name' in body) {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) {
        return NextResponse.json({ error: 'Product name must be 1 to 120 characters.' }, { status: 400 });
      }
      updates.name = body.name.trim();
    }
    if ('price' in body) {
      if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0 || body.price > 1000000 || Math.round(body.price * 100) !== body.price * 100) {
        return NextResponse.json({ error: 'Price must be a valid ETB amount.' }, { status: 400 });
      }
      updates.price = body.price;
    }
    if ('is_active' in body) {
      if (typeof body.is_active !== 'boolean') return NextResponse.json({ error: 'Product availability must be true or false.' }, { status: 400 });
      updates.is_active = body.is_active;
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No product changes were provided.' }, { status: 400 });
    updates.updated_at = new Date().toISOString();
    const { data: product, error } = await getSupabaseAdmin()
      .from('gym_products')
      .update(updates)
      .eq('id', body.product_id)
      .eq('gym_id', gymId)
      .select('id, name, price, stock_quantity, is_active')
      .maybeSingle();
    if (error) throw new Error(`Failed to update product: ${error.message}`);
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    await recordGymAuditEvent({ gymId, actorId: user.id, action: 'inventory_product_updated', targetType: 'product', targetId: product.id, details: updates });
    return NextResponse.json({ success: true, product });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update inventory.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
