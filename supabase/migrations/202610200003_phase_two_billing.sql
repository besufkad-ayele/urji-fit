CREATE TABLE IF NOT EXISTS public.gym_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  member_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  household_id UUID REFERENCES public.gym_households(id) ON DELETE RESTRICT,
  membership_id UUID REFERENCES public.gym_memberships(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('membership', 'renewal', 'manual', 'household', 'pos')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'partially_paid', 'paid', 'overdue', 'void')),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  due_date DATE NOT NULL,
  period_start DATE,
  period_end DATE,
  promo_code_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gym_id, invoice_number),
  CHECK (discount_amount <= subtotal),
  CHECK (total = subtotal - discount_amount),
  CHECK (amount_paid <= total)
);

CREATE TABLE IF NOT EXISTS public.gym_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.gym_invoices(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  membership_id UUID REFERENCES public.gym_memberships(id) ON DELETE SET NULL,
  product_id UUID,
  period_start DATE,
  period_end DATE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (line_total = round(quantity * unit_price, 2))
);

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.gym_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gym_invoices_member_status
  ON public.gym_invoices(member_id, status, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_gym_invoices_gym_status
  ON public.gym_invoices(gym_id, status, due_date);
DROP INDEX IF EXISTS public.idx_gym_invoices_membership_period;
CREATE UNIQUE INDEX idx_gym_invoices_membership_period
  ON public.gym_invoices(gym_id, membership_id, period_end)
  WHERE source = 'renewal' AND membership_id IS NOT NULL AND period_end IS NOT NULL AND status <> 'void';
CREATE INDEX IF NOT EXISTS idx_gym_invoice_lines_invoice
  ON public.gym_invoice_lines(invoice_id);

CREATE TABLE IF NOT EXISTS public.gym_promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemption_count INTEGER NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gym_id, code),
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.gym_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  cost NUMERIC(12, 2) CHECK (cost IS NULL OR cost >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gym_id, sku)
);

CREATE TABLE IF NOT EXISTS public.gym_pos_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cashier_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'void')),
  payment_method TEXT NOT NULL CHECK (payment_method = 'cash'),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gym_pos_sale_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.gym_pos_sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.gym_products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total = quantity * unit_price)
);

CREATE TABLE IF NOT EXISTS public.gym_inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.gym_products(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('initial_stock', 'sale', 'adjustment', 'return')),
  quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
  sale_id UUID REFERENCES public.gym_pos_sales(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gym_invoices
  DROP CONSTRAINT IF EXISTS gym_invoices_promo_code_id_fkey;
ALTER TABLE public.gym_invoices
  ADD CONSTRAINT gym_invoices_promo_code_id_fkey
  FOREIGN KEY (promo_code_id) REFERENCES public.gym_promo_codes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gym_promo_codes_active
  ON public.gym_promo_codes(gym_id, code)
  WHERE is_active = true;

ALTER TABLE public.gym_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_pos_sale_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gym_products_inventory
  ON public.gym_products(gym_id, is_active, stock_quantity);
CREATE INDEX IF NOT EXISTS idx_gym_pos_sales_gym_date
  ON public.gym_pos_sales(gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gym_inventory_movements_product
  ON public.gym_inventory_movements(product_id, created_at DESC);

ALTER TABLE public.gym_invoice_lines
  DROP CONSTRAINT IF EXISTS gym_invoice_lines_product_id_fkey;
ALTER TABLE public.gym_invoice_lines
  ADD CONSTRAINT gym_invoice_lines_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.gym_products(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.adjust_gym_product_stock(
  p_gym_id UUID,
  p_product_id UUID,
  p_quantity_delta INTEGER,
  p_reason TEXT,
  p_actor_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_quantity INTEGER;
BEGIN
  IF p_quantity_delta = 0 OR abs(p_quantity_delta) > 100000 THEN
    RAISE EXCEPTION 'Stock adjustment must be between -100,000 and 100,000, excluding zero.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 2 AND 200 THEN
    RAISE EXCEPTION 'Provide a stock adjustment reason between 2 and 200 characters.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.gym_products
  SET stock_quantity = stock_quantity + p_quantity_delta, updated_at = now()
  WHERE id = p_product_id AND gym_id = p_gym_id
    AND stock_quantity + p_quantity_delta >= 0
  RETURNING stock_quantity INTO next_quantity;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or adjustment would make stock negative.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.gym_inventory_movements (
    gym_id, product_id, actor_id, movement_type, quantity_delta, reason
  )
  VALUES (p_gym_id, p_product_id, p_actor_id, 'adjustment', p_quantity_delta, btrim(p_reason));
  RETURN next_quantity;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_gym_pos_sale(
  p_gym_id UUID,
  p_member_id UUID,
  p_actor_id UUID,
  p_items JSONB
)
RETURNS TABLE(sale_id UUID, sale_total NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  target_product public.gym_products%ROWTYPE;
  requested_id UUID;
  requested_quantity INTEGER;
  subtotal_value NUMERIC(12, 2) := 0;
  created_sale_id UUID;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 40 THEN
    RAISE EXCEPTION 'A sale must contain between 1 and 40 product lines.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item(value)
    GROUP BY value->>'product_id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Combine duplicate product lines before checkout.' USING ERRCODE = '22023';
  END IF;
  IF p_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gym_memberships
    WHERE gym_id = p_gym_id AND member_id = p_member_id
      AND status = 'active' AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  ) THEN
    RAISE EXCEPTION 'Choose an active gym member or leave the customer blank.' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.gyms WHERE id = p_gym_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gym not found.' USING ERRCODE = 'P0002';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF NOT (item ? 'product_id') OR NOT (item ? 'quantity') THEN
      RAISE EXCEPTION 'Each sale line must include a product and quantity.' USING ERRCODE = '22023';
    END IF;
    requested_id := (item->>'product_id')::UUID;
    requested_quantity := (item->>'quantity')::INTEGER;
    IF requested_quantity < 1 OR requested_quantity > 10000 THEN
      RAISE EXCEPTION 'Each quantity must be between 1 and 10,000.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO target_product FROM public.gym_products
    WHERE id = requested_id AND gym_id = p_gym_id AND is_active = true
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A selected product is unavailable.' USING ERRCODE = '22023';
    END IF;
    IF target_product.stock_quantity < requested_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for %.', target_product.name USING ERRCODE = '22023';
    END IF;
    subtotal_value := subtotal_value + (target_product.price * requested_quantity);
  END LOOP;

  INSERT INTO public.gym_pos_sales (
    gym_id, member_id, cashier_id, payment_method, subtotal, total
  )
  VALUES (p_gym_id, p_member_id, p_actor_id, 'cash', subtotal_value, subtotal_value)
  RETURNING id INTO created_sale_id;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    requested_id := (item->>'product_id')::UUID;
    requested_quantity := (item->>'quantity')::INTEGER;
    SELECT * INTO target_product FROM public.gym_products
    WHERE id = requested_id AND gym_id = p_gym_id
    FOR UPDATE;
    UPDATE public.gym_products
    SET stock_quantity = stock_quantity - requested_quantity, updated_at = now()
    WHERE id = requested_id AND gym_id = p_gym_id;
    INSERT INTO public.gym_pos_sale_lines (
      sale_id, product_id, product_name, quantity, unit_price, line_total
    )
    VALUES (
      created_sale_id, requested_id, target_product.name, requested_quantity,
      target_product.price, target_product.price * requested_quantity
    );
    INSERT INTO public.gym_inventory_movements (
      gym_id, product_id, actor_id, movement_type, quantity_delta, sale_id, reason
    )
    VALUES (p_gym_id, requested_id, p_actor_id, 'sale', -requested_quantity, created_sale_id, 'POS cash sale');
  END LOOP;

  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    p_gym_id, p_actor_id, 'pos_sale_completed', 'pos_sale', created_sale_id,
    jsonb_build_object('member_id', p_member_id, 'total_etb', subtotal_value)
  );
  sale_id := created_sale_id;
  sale_total := subtotal_value;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_gym_product_stock(UUID, UUID, INTEGER, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_gym_pos_sale(UUID, UUID, UUID, JSONB) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_manual_gym_invoice(
  p_gym_id UUID,
  p_member_id UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_due_date DATE,
  p_actor_id UUID,
  p_promo_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_invoice_id UUID;
  invoice_code TEXT;
  target_promo public.gym_promo_codes%ROWTYPE;
  discount_value NUMERIC(12, 2) := 0;
  final_total NUMERIC(12, 2);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.gym_memberships
    WHERE gym_id = p_gym_id AND member_id = p_member_id
      AND status IN ('active', 'suspended')
  ) THEN
    RAISE EXCEPTION 'Member must have a current membership at this gym.' USING ERRCODE = '22023';
  END IF;
  IF p_description IS NULL OR length(btrim(p_description)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Invoice description must be 1 to 200 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'Invoice amount must be between ETB 0.01 and ETB 1,000,000.' USING ERRCODE = '22023';
  END IF;
  IF p_due_date IS NULL OR p_due_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Invoice due date cannot be in the past.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_promo_code), '') IS NOT NULL THEN
    SELECT * INTO target_promo FROM public.gym_promo_codes
    WHERE gym_id = p_gym_id AND code = upper(btrim(p_promo_code)) AND is_active = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_redemptions IS NULL OR redemption_count < max_redemptions)
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Promo code is invalid, expired, or fully redeemed.' USING ERRCODE = '22023';
    END IF;
    IF target_promo.discount_type = 'percentage' THEN
      IF target_promo.discount_value > 100 THEN
        RAISE EXCEPTION 'Percentage discount cannot exceed 100.' USING ERRCODE = '22023';
      END IF;
      discount_value := round(p_amount * target_promo.discount_value / 100, 2);
    ELSE
      discount_value := LEAST(p_amount, target_promo.discount_value);
    END IF;
  END IF;
  final_total := p_amount - discount_value;
  invoice_code := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.gym_invoices (
    gym_id, invoice_number, member_id, source, status, subtotal,
    discount_amount, total, amount_paid, due_date, created_by, notes, promo_code_id
  )
  VALUES (
    p_gym_id, invoice_code, p_member_id, 'manual',
    CASE WHEN final_total = 0 THEN 'paid' ELSE 'open' END,
    p_amount, discount_value, final_total,
    CASE WHEN final_total = 0 THEN final_total ELSE 0 END,
    p_due_date, p_actor_id, btrim(p_description), target_promo.id
  )
  RETURNING id INTO new_invoice_id;
  INSERT INTO public.gym_invoice_lines (invoice_id, member_id, description, quantity, unit_price, line_total)
  VALUES (new_invoice_id, p_member_id, btrim(p_description), 1, p_amount, p_amount);
  IF target_promo.id IS NOT NULL THEN
    UPDATE public.gym_promo_codes
    SET redemption_count = redemption_count + 1
    WHERE id = target_promo.id;
  END IF;
  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    p_gym_id, p_actor_id, 'invoice_created', 'invoice', new_invoice_id,
    jsonb_build_object('member_id', p_member_id, 'subtotal_etb', p_amount, 'discount_etb', discount_value, 'total_etb', final_total, 'source', 'manual')
  );
  RETURN new_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_membership_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.auto_renew := false;
  IF NEW.price > 0 THEN
    NEW.status := 'suspended';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_household_gym_invoice(
  p_gym_id UUID,
  p_household_id UUID,
  p_description TEXT,
  p_due_date DATE,
  p_actor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_household public.gym_households%ROWTYPE;
  new_invoice_id UUID;
  invoice_code TEXT;
  invoice_total NUMERIC(12, 2);
BEGIN
  SELECT * INTO target_household FROM public.gym_households
  WHERE id = p_household_id AND gym_id = p_gym_id AND is_active = true
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active household not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_description IS NULL OR length(btrim(p_description)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Invoice description must be 1 to 200 characters.' USING ERRCODE = '22023';
  END IF;
  IF p_due_date IS NULL OR p_due_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Invoice due date cannot be in the past.' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.gym_invoices i
  JOIN public.gym_household_members hm ON hm.member_id = i.member_id
  WHERE hm.household_id = p_household_id AND i.gym_id = p_gym_id
    AND i.source IN ('membership', 'renewal') AND i.status IN ('open', 'partially_paid', 'overdue')
  FOR UPDATE OF i;
  IF EXISTS (
    SELECT 1 FROM public.payment_transactions pt
    JOIN public.gym_invoices i ON i.id = pt.invoice_id
    JOIN public.gym_household_members hm ON hm.member_id = i.member_id
    WHERE hm.household_id = p_household_id AND i.gym_id = p_gym_id
      AND i.source IN ('membership', 'renewal')
      AND i.status IN ('open', 'partially_paid', 'overdue')
      AND pt.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Review pending receipts before consolidating household invoices.' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(SUM(i.total - i.amount_paid), 0) INTO invoice_total
  FROM public.gym_invoices i
  JOIN public.gym_household_members hm ON hm.member_id = i.member_id
  WHERE hm.household_id = p_household_id AND i.gym_id = p_gym_id
    AND i.source IN ('membership', 'renewal') AND i.status IN ('open', 'partially_paid', 'overdue');
  IF invoice_total <= 0 THEN
    RAISE EXCEPTION 'This household has no unpaid membership invoices.' USING ERRCODE = '22023';
  END IF;
  invoice_code := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.gym_invoices (
    gym_id, invoice_number, member_id, household_id, source, status,
    subtotal, discount_amount, total, amount_paid, due_date, created_by, notes
  )
  VALUES (
    p_gym_id, invoice_code, target_household.primary_member_id, p_household_id,
    'household', 'open', invoice_total, 0, invoice_total, 0, p_due_date,
    p_actor_id, btrim(p_description)
  )
  RETURNING id INTO new_invoice_id;

  INSERT INTO public.gym_invoice_lines (
    invoice_id, member_id, membership_id, period_start, period_end, description, quantity, unit_price, line_total
  )
  SELECT new_invoice_id, i.member_id, i.membership_id, i.period_start, i.period_end,
    'Membership balance · ' || replace(gm.membership_type, '_', ' '),
    1, i.total - i.amount_paid, i.total - i.amount_paid
  FROM public.gym_invoices i
  JOIN public.gym_household_members hm ON hm.member_id = i.member_id
  JOIN public.gym_memberships gm ON gm.id = i.membership_id
  WHERE hm.household_id = p_household_id AND i.gym_id = p_gym_id
    AND i.source IN ('membership', 'renewal') AND i.status IN ('open', 'partially_paid', 'overdue');

  UPDATE public.gym_invoices i SET status = 'void', updated_at = now()
  FROM public.gym_household_members hm
  WHERE hm.household_id = p_household_id AND i.member_id = hm.member_id
    AND i.gym_id = p_gym_id AND i.source IN ('membership', 'renewal')
    AND i.status IN ('open', 'partially_paid', 'overdue');

  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    p_gym_id, p_actor_id, 'household_invoice_created', 'invoice', new_invoice_id,
    jsonb_build_object('household_id', p_household_id, 'total_etb', invoice_total)
  );
  RETURN new_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_membership_renewal_invoice(
  p_gym_id UUID,
  p_membership_id UUID,
  p_due_date DATE,
  p_actor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_membership public.gym_memberships%ROWTYPE;
  target_plan public.gym_membership_plans%ROWTYPE;
  renewal_start DATE;
  renewal_end DATE;
  new_invoice_id UUID;
  invoice_code TEXT;
BEGIN
  SELECT * INTO target_membership FROM public.gym_memberships
  WHERE id = p_membership_id AND gym_id = p_gym_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found.' USING ERRCODE = 'P0002';
  END IF;
  IF target_membership.status = 'canceled' THEN
    RAISE EXCEPTION 'Canceled memberships cannot be renewed.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target_plan FROM public.gym_membership_plans
  WHERE id = target_membership.plan_id AND gym_id = p_gym_id;
  IF NOT FOUND OR target_plan.duration_days IS NULL OR target_plan.duration_days < 1 THEN
    RAISE EXCEPTION 'Choose a dated membership plan before creating a renewal invoice.' USING ERRCODE = '22023';
  END IF;
  IF p_due_date IS NULL OR p_due_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Invoice due date cannot be in the past.' USING ERRCODE = '22023';
  END IF;
  renewal_start := GREATEST(CURRENT_DATE, COALESCE(target_membership.end_date + 1, CURRENT_DATE));
  renewal_end := renewal_start + target_plan.duration_days - 1;
  IF EXISTS (
    SELECT 1 FROM public.gym_invoices
    WHERE gym_id = p_gym_id AND membership_id = p_membership_id
      AND source = 'renewal' AND period_end = renewal_end
      AND status IN ('open', 'partially_paid', 'overdue', 'paid')
  ) THEN
    RAISE EXCEPTION 'A renewal invoice already exists for this membership period.' USING ERRCODE = '23505';
  END IF;
  invoice_code := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.gym_invoices (
    gym_id, invoice_number, member_id, membership_id, source, status,
    subtotal, discount_amount, total, amount_paid, due_date, period_start, period_end,
    created_by, notes
  )
  VALUES (
    p_gym_id, invoice_code, target_membership.member_id, p_membership_id, 'renewal',
    CASE WHEN target_plan.price = 0 THEN 'paid' ELSE 'open' END,
    target_plan.price, 0, target_plan.price, CASE WHEN target_plan.price = 0 THEN target_plan.price ELSE 0 END,
    p_due_date, renewal_start, renewal_end,
    p_actor_id, 'Membership renewal'
  )
  RETURNING id INTO new_invoice_id;
  INSERT INTO public.gym_invoice_lines (
    invoice_id, member_id, membership_id, period_start, period_end, description, quantity, unit_price, line_total
  )
  VALUES (
    new_invoice_id, target_membership.member_id, p_membership_id, renewal_start, renewal_end,
    'Renewal: ' || target_plan.name, 1, target_plan.price, target_plan.price
  );
  INSERT INTO public.gym_audit_logs (gym_id, actor_id, action, target_type, target_id, details)
  VALUES (
    p_gym_id, p_actor_id, 'membership_renewal_invoiced', 'membership', p_membership_id,
    jsonb_build_object('invoice_id', new_invoice_id, 'period_start', renewal_start, 'period_end', renewal_end, 'total_etb', target_plan.price)
  );
  IF target_plan.price = 0 THEN
    UPDATE public.gym_memberships
    SET status = 'active', end_date = renewal_end, updated_at = now()
    WHERE id = p_membership_id AND gym_id = p_gym_id AND status <> 'canceled';
  END IF;
  RETURN new_invoice_id;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_membership_invoice ON public.gym_memberships;
CREATE TRIGGER trg_prepare_membership_invoice
BEFORE INSERT ON public.gym_memberships
FOR EACH ROW EXECUTE FUNCTION public.prepare_membership_invoice();

CREATE OR REPLACE FUNCTION public.create_membership_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice_id UUID;
  invoice_code TEXT;
BEGIN
  invoice_code := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  INSERT INTO public.gym_invoices (
    gym_id, invoice_number, member_id, membership_id, source, status,
    subtotal, discount_amount, total, amount_paid, due_date, period_start, period_end
  )
  VALUES (
    NEW.gym_id, invoice_code, NEW.member_id, NEW.id, 'membership',
    CASE WHEN NEW.price = 0 THEN 'paid' ELSE 'open' END,
    NEW.price, 0, NEW.price, CASE WHEN NEW.price = 0 THEN NEW.price ELSE 0 END,
    CURRENT_DATE + 7, NEW.start_date, NEW.end_date
  )
  RETURNING id INTO invoice_id;
  INSERT INTO public.gym_invoice_lines (
    invoice_id, member_id, membership_id, period_start, period_end, description, quantity, unit_price, line_total
  )
  VALUES (
    invoice_id, NEW.member_id, NEW.id, NEW.start_date, NEW.end_date,
    'Membership: ' || replace(NEW.membership_type, '_', ' '),
    1, NEW.price, NEW.price
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_membership_invoice ON public.gym_memberships;
CREATE TRIGGER trg_create_membership_invoice
AFTER INSERT ON public.gym_memberships
FOR EACH ROW EXECUTE FUNCTION public.create_membership_invoice();

CREATE OR REPLACE FUNCTION public.apply_verified_invoice_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_invoice public.gym_invoices%ROWTYPE;
  next_paid NUMERIC(12, 2);
BEGIN
  IF NEW.status = 'completed'
    AND OLD.status IS DISTINCT FROM 'completed'
    AND NEW.invoice_id IS NOT NULL THEN
    SELECT * INTO target_invoice
    FROM public.gym_invoices
    WHERE id = NEW.invoice_id
      AND gym_id = NEW.gym_id
      AND member_id = NEW.member_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice does not belong to this member and gym.' USING ERRCODE = '23503';
    END IF;
    IF target_invoice.status IN ('void', 'paid') THEN
      RAISE EXCEPTION 'Invoice is no longer payable.' USING ERRCODE = '22023';
    END IF;
    next_paid := target_invoice.amount_paid + NEW.amount;
    IF next_paid > target_invoice.total THEN
      RAISE EXCEPTION 'Verified payment would exceed the invoice balance.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.gym_invoices
    SET amount_paid = next_paid,
        status = CASE WHEN next_paid = total THEN 'paid' ELSE 'partially_paid' END,
        updated_at = now()
    WHERE id = target_invoice.id;
    IF next_paid = target_invoice.total AND target_invoice.source = 'household' THEN
      UPDATE public.gym_memberships gm
      SET status = 'active',
          end_date = COALESCE(il.period_end, gm.end_date),
          updated_at = now()
      FROM (
        SELECT membership_id, MAX(period_end) AS period_end
        FROM public.gym_invoice_lines
        WHERE invoice_id = target_invoice.id AND membership_id IS NOT NULL
        GROUP BY membership_id
      ) il
      WHERE il.membership_id = gm.id
        AND gm.gym_id = target_invoice.gym_id
        AND gm.status <> 'canceled';
    ELSIF next_paid = target_invoice.total AND target_invoice.membership_id IS NOT NULL THEN
      UPDATE public.gym_memberships
      SET status = 'active',
          end_date = CASE
            WHEN target_invoice.source = 'renewal' AND target_invoice.period_end IS NOT NULL
              THEN target_invoice.period_end
            ELSE end_date
          END,
          updated_at = now()
      WHERE id = target_invoice.membership_id
        AND gym_id = target_invoice.gym_id
        AND status <> 'canceled';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_verified_invoice_payment ON public.payment_transactions;
CREATE TRIGGER trg_apply_verified_invoice_payment
AFTER UPDATE OF status ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_verified_invoice_payment();

CREATE TABLE IF NOT EXISTS public.gym_invoice_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.gym_invoices(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('upcoming', 'due', 'overdue')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'dismissed')),
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, reminder_type)
);

ALTER TABLE public.gym_invoice_reminders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.queue_invoice_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.gym_invoices
  SET status = 'overdue', updated_at = now()
  WHERE status IN ('open', 'partially_paid') AND due_date < CURRENT_DATE;

  INSERT INTO public.gym_invoice_reminders (invoice_id, reminder_type, due_at)
  SELECT i.id,
    CASE WHEN i.due_date < CURRENT_DATE THEN 'overdue'
         WHEN i.due_date = CURRENT_DATE THEN 'due'
         ELSE 'upcoming' END,
    now()
  FROM public.gym_invoices i
  WHERE i.status IN ('open', 'partially_paid', 'overdue')
    AND i.due_date <= CURRENT_DATE + 7
  ON CONFLICT (invoice_id, reminder_type) DO NOTHING;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_membership_renewal_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  membership RECORD;
  renewal_start DATE;
  renewal_end DATE;
  invoice_id UUID;
  invoice_code TEXT;
  queued_count INTEGER := 0;
BEGIN
  UPDATE public.gym_memberships
  SET status = 'expired', updated_at = now()
  WHERE status = 'active' AND end_date < CURRENT_DATE;

  FOR membership IN
    SELECT gm.id, gm.gym_id, gm.member_id, gm.end_date, plan.name AS plan_name,
      plan.price, plan.duration_days
    FROM public.gym_memberships gm
    JOIN public.gym_membership_plans plan ON plan.id = gm.plan_id
    WHERE gm.status IN ('active', 'expired')
      AND gm.end_date IS NOT NULL
      AND gm.end_date <= CURRENT_DATE + 7
      AND plan.duration_days > 0
    ORDER BY gm.end_date, gm.id
  LOOP
    renewal_start := GREATEST(CURRENT_DATE, membership.end_date + 1);
    renewal_end := renewal_start + membership.duration_days - 1;
    invoice_code := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    invoice_id := NULL;
    INSERT INTO public.gym_invoices (
      gym_id, invoice_number, member_id, membership_id, source, status,
      subtotal, discount_amount, total, amount_paid, due_date, period_start,
      period_end, notes
    )
    VALUES (
      membership.gym_id, invoice_code, membership.member_id, membership.id,
      'renewal', CASE WHEN membership.price = 0 THEN 'paid' ELSE 'open' END,
      membership.price, 0, membership.price, CASE WHEN membership.price = 0 THEN membership.price ELSE 0 END,
      GREATEST(CURRENT_DATE, LEAST(membership.end_date, CURRENT_DATE + 7)),
      renewal_start, renewal_end, 'Automated renewal invoice · manual payment required'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO invoice_id;
    IF invoice_id IS NOT NULL THEN
      INSERT INTO public.gym_invoice_lines (
        invoice_id, member_id, membership_id, period_start, period_end, description, quantity, unit_price, line_total
      )
      VALUES (
        invoice_id, membership.member_id, membership.id, renewal_start, renewal_end,
        'Renewal: ' || membership.plan_name, 1, membership.price, membership.price
      );
      queued_count := queued_count + 1;
      IF membership.price = 0 THEN
        UPDATE public.gym_memberships
        SET status = 'active', end_date = renewal_end, updated_at = now()
        WHERE id = membership.id AND gym_id = membership.gym_id;
      END IF;
    END IF;
  END LOOP;
  RETURN queued_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_class_booking(
  p_class_id UUID,
  p_member_id UUID,
  p_old_date DATE,
  p_new_date DATE
)
RETURNS TABLE(booking_id UUID, booking_status TEXT, waitlist_position INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_class public.classes%ROWTYPE;
  source_booking public.class_bookings%ROWTYPE;
  destination_booking public.class_bookings%ROWTYPE;
  next_waitlisted_id UUID;
  active_count INTEGER;
  next_status TEXT;
BEGIN
  SELECT * INTO target_class FROM public.classes
  WHERE id = p_class_id AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class is not available.' USING ERRCODE = 'P0002';
  END IF;
  IF p_old_date <= CURRENT_DATE OR p_new_date <= CURRENT_DATE OR p_old_date = p_new_date
    OR EXTRACT(DOW FROM p_new_date)::INTEGER <> target_class.day_of_week THEN
    RAISE EXCEPTION 'Choose a different future date that matches this class schedule.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO source_booking FROM public.class_bookings
  WHERE class_id = p_class_id AND member_id = p_member_id
    AND booking_date = p_old_date AND status IN ('booked', 'waitlisted')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active future booking was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gym_memberships gm
    WHERE gm.gym_id = target_class.gym_id AND gm.member_id = p_member_id
      AND gm.status = 'active' AND gm.start_date <= p_new_date
      AND (gm.end_date IS NULL OR gm.end_date >= p_new_date)
  ) THEN
    RAISE EXCEPTION 'An active membership is required on the new class date.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO destination_booking FROM public.class_bookings
  WHERE class_id = p_class_id AND member_id = p_member_id
    AND booking_date = p_new_date
  FOR UPDATE;
  IF FOUND AND destination_booking.status <> 'canceled' THEN
    RAISE EXCEPTION 'You already have a booking for that class date.' USING ERRCODE = '23505';
  ELSIF FOUND THEN
    DELETE FROM public.class_bookings WHERE id = destination_booking.id;
  END IF;

  SELECT COUNT(*)::INTEGER INTO active_count FROM public.class_bookings
  WHERE class_id = p_class_id AND booking_date = p_new_date
    AND status IN ('booked', 'attended', 'no_show');
  next_status := CASE
    WHEN active_count < COALESCE(target_class.capacity, 500000) THEN 'booked'
    ELSE 'waitlisted'
  END;
  UPDATE public.class_bookings
  SET booking_date = p_new_date, status = next_status, created_at = now()
  WHERE id = source_booking.id
  RETURNING id INTO booking_id;
  IF source_booking.status = 'booked' THEN
    SELECT id INTO next_waitlisted_id FROM public.class_bookings
    WHERE class_id = p_class_id AND booking_date = p_old_date AND status = 'waitlisted'
    ORDER BY created_at, id
    LIMIT 1
    FOR UPDATE;
    IF next_waitlisted_id IS NOT NULL THEN
      UPDATE public.class_bookings SET status = 'booked'
      WHERE id = next_waitlisted_id;
    END IF;
  END IF;
  booking_status := next_status;
  IF next_status = 'waitlisted' THEN
    SELECT COUNT(*)::INTEGER INTO waitlist_position FROM public.class_bookings
    WHERE class_id = p_class_id AND booking_date = p_new_date
      AND status = 'waitlisted'
      AND (created_at, id) <= (
        SELECT created_at, id FROM public.class_bookings WHERE id = booking_id
      );
  ELSE
    waitlist_position := NULL;
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_membership_invoice() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_membership_invoice() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_verified_invoice_payment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_invoice_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_membership_renewal_invoices() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_manual_gym_invoice(UUID, UUID, TEXT, NUMERIC, DATE, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_household_gym_invoice(UUID, UUID, TEXT, DATE, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_membership_renewal_invoice(UUID, UUID, DATE, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reschedule_class_booking(UUID, UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_gym_product_stock(UUID, UUID, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_gym_pos_sale(UUID, UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_invoice_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_membership_renewal_invoices() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_manual_gym_invoice(UUID, UUID, TEXT, NUMERIC, DATE, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_household_gym_invoice(UUID, UUID, TEXT, DATE, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_membership_renewal_invoice(UUID, UUID, DATE, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_class_booking(UUID, UUID, DATE, DATE) TO service_role;
