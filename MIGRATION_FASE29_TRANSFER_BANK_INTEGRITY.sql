-- FASE 29: integridad de transferencias y cuentas bancarias
-- Repetible: usa IF NOT EXISTS / CREATE OR REPLACE.
-- Después de aplicar: NOTIFY pgrst, 'reload schema';

ALTER TABLE public.inventory_transfers
  ADD COLUMN IF NOT EXISTS batch_id text;

CREATE INDEX IF NOT EXISTS idx_inventory_transfers_batch_id
  ON public.inventory_transfers(batch_id);

DROP FUNCTION IF EXISTS public.process_inventory_transfer_v2(text,text,text,text,jsonb,text);

CREATE OR REPLACE FUNCTION public.process_inventory_transfer_v2(
  p_operation_id text,
  p_batch_id text,
  p_product_id text,
  p_from_branch_id text,
  p_to_branch_id text,
  p_variants jsonb,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v RECORD;
  src public.inventory%ROWTYPE;
  first_branch text;
  second_branch text;
BEGIN
  IF NULLIF(btrim(p_operation_id),'') IS NULL THEN
    RAISE EXCEPTION 'ID de operación requerido' USING ERRCODE='P0001';
  END IF;
  IF NULLIF(btrim(p_product_id),'') IS NULL THEN
    RAISE EXCEPTION 'Producto requerido' USING ERRCODE='P0001';
  END IF;
  IF p_from_branch_id=p_to_branch_id THEN
    RAISE EXCEPTION 'Origen y destino no pueden coincidir' USING ERRCODE='P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventory_transfers WHERE operation_id=p_operation_id) THEN
    RETURN jsonb_build_object('success',true,'operation_id',p_operation_id,
      'batch_id',p_batch_id,'already_existed',true);
  END IF;

  IF p_from_branch_id<p_to_branch_id THEN
    first_branch:=p_from_branch_id; second_branch:=p_to_branch_id;
  ELSE
    first_branch:=p_to_branch_id; second_branch:=p_from_branch_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('transfer:'||p_product_id||':'||first_branch));
  PERFORM pg_advisory_xact_lock(hashtext('transfer:'||p_product_id||':'||second_branch));

  FOR v IN
    SELECT COALESCE(x.variant_label,'') AS variant_label,SUM(x.quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_variants) AS x(variant_label text,quantity integer)
    GROUP BY COALESCE(x.variant_label,'')
  LOOP
    IF v.quantity<=0 THEN
      RAISE EXCEPTION 'Cantidad inválida en transferencia' USING ERRCODE='P0001';
    END IF;
    SELECT * INTO src FROM public.inventory
    WHERE product_id=p_product_id AND branch_id=p_from_branch_id
      AND COALESCE(variant_label,'')=v.variant_label
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe stock origen para variante %',v.variant_label USING ERRCODE='P0001';
    END IF;
    IF src.quantity<v.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente en origen: disponible %, requerido %',src.quantity,v.quantity USING ERRCODE='P0001';
    END IF;
  END LOOP;

  FOR v IN
    SELECT COALESCE(x.variant_label,'') AS variant_label,SUM(x.quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_variants) AS x(variant_label text,quantity integer)
    GROUP BY COALESCE(x.variant_label,'')
  LOOP
    UPDATE public.inventory SET quantity=quantity-v.quantity
    WHERE product_id=p_product_id AND branch_id=p_from_branch_id
      AND COALESCE(variant_label,'')=v.variant_label;

    INSERT INTO public.inventory_movements(
      product_id,branch_id,variant_label,quantity_delta,movement_type,reference_id,user_id,metadata
    ) VALUES (
      p_product_id,p_from_branch_id,v.variant_label,-v.quantity,'TRANSFER_OUT',
      p_operation_id,NULLIF(p_user_id,'system'),jsonb_build_object('batch_id',p_batch_id)
    );

    UPDATE public.inventory SET quantity=quantity+v.quantity
    WHERE product_id=p_product_id AND branch_id=p_to_branch_id
      AND COALESCE(variant_label,'')=v.variant_label;

    IF NOT FOUND THEN
      INSERT INTO public.inventory(product_id,branch_id,variant_label,quantity,min_quantity,id)
      VALUES(p_product_id,p_to_branch_id,v.variant_label,v.quantity,5,gen_random_uuid()::text);
    END IF;

    INSERT INTO public.inventory_movements(
      product_id,branch_id,variant_label,quantity_delta,movement_type,reference_id,user_id,metadata
    ) VALUES (
      p_product_id,p_to_branch_id,v.variant_label,v.quantity,'TRANSFER_IN',
      p_operation_id,NULLIF(p_user_id,'system'),jsonb_build_object('batch_id',p_batch_id)
    );
  END LOOP;

  INSERT INTO public.inventory_transfers(
    id,operation_id,batch_id,product_id,product_name,
    from_branch_id,from_branch_name,to_branch_id,to_branch_name,
    variant_label,quantity,variants,date,user_id,status
  )
  SELECT
    p_operation_id,p_operation_id,NULLIF(btrim(p_batch_id),''),
    p_product_id,p.name,p_from_branch_id,bf.name,p_to_branch_id,bt.name,
    COALESCE((
      SELECT string_agg(
        CASE WHEN COALESCE(x.variant_label,'')='' THEN 'Producto Base' ELSE x.variant_label END
        || ': ' || x.quantity, ', '
        ORDER BY CASE WHEN COALESCE(x.variant_label,'')='' THEN 0 ELSE 1 END,x.variant_label
      )
      FROM (
        SELECT COALESCE(y.variant_label,'') variant_label,SUM(y.quantity)::integer quantity
        FROM jsonb_to_recordset(p_variants) y(variant_label text,quantity integer)
        GROUP BY COALESCE(y.variant_label,'')
      ) x
    ),'Producto Base'),
    (SELECT COALESCE(SUM(quantity),0)
     FROM jsonb_to_recordset(p_variants) AS x(variant_label text,quantity integer)),
    p_variants,NOW(),NULLIF(p_user_id,'system'),'completed'
  FROM public.products p
  JOIN public.branches bf ON bf.id=p_from_branch_id
  JOIN public.branches bt ON bt.id=p_to_branch_id
  WHERE p.id=p_product_id;

  RETURN jsonb_build_object('success',true,'operation_id',p_operation_id,'batch_id',p_batch_id);
END
$function$;

CREATE OR REPLACE FUNCTION public.process_bank_internal_transfer_v2(
  p_operation_id text,
  p_from_card_id text,
  p_to_card_id text,
  p_amount numeric,
  p_target_amount numeric,
  p_date timestamptz,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_from public.bank_cards%ROWTYPE;
  v_to public.bank_cards%ROWTYPE;
  v_out_id text;
  v_in_id text;
BEGIN
  IF NULLIF(btrim(p_operation_id),'') IS NULL THEN
    RAISE EXCEPTION 'ID de operación requerido' USING ERRCODE='P0001';
  END IF;
  IF p_from_card_id IS NULL OR p_to_card_id IS NULL OR p_from_card_id=p_to_card_id THEN
    RAISE EXCEPTION 'Las cuentas bancaria de origen y destino deben ser diferentes' USING ERRCODE='P0001';
  END IF;
  IF COALESCE(p_amount,0)<=0 OR COALESCE(p_target_amount,0)<=0 THEN
    RAISE EXCEPTION 'El monto de transferencia debe ser mayor que 0' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_from FROM public.bank_cards WHERE id=p_from_card_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe la cuenta bancaria de origen' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_to FROM public.bank_cards WHERE id=p_to_card_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe la cuenta bancaria de destino' USING ERRCODE='P0001'; END IF;

  SELECT id INTO v_out_id FROM public.bank_transactions
  WHERE reference=p_operation_id AND card_id=p_from_card_id AND id=p_operation_id||':OUT' LIMIT 1;
  SELECT id INTO v_in_id FROM public.bank_transactions
  WHERE reference=p_operation_id AND card_id=p_to_card_id AND id=p_operation_id||':IN' LIMIT 1;

  IF v_out_id IS NOT NULL AND v_in_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'operation_id',p_operation_id,'already_existed',true,
      'from_balance',v_from.balance,'to_balance',v_to.balance);
  END IF;
  IF v_out_id IS NOT NULL OR v_in_id IS NOT NULL THEN
    RAISE EXCEPTION 'La transferencia bancaria % quedó incompleta y no se puede repetir automáticamente',p_operation_id USING ERRCODE='P0001';
  END IF;

  IF v_from.balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente en la cuenta de origen: disponible %, requerido %',v_from.balance,p_amount USING ERRCODE='P0001';
  END IF;

  UPDATE public.bank_cards SET balance=balance-p_amount WHERE id=p_from_card_id;
  UPDATE public.bank_cards SET balance=balance+p_target_amount WHERE id=p_to_card_id;

  v_out_id := p_operation_id||':OUT';
  v_in_id := p_operation_id||':IN';

  INSERT INTO public.bank_transactions(id,card_id,type,amount,date,reference,description,transaction_id)
  VALUES(v_out_id,p_from_card_id,'withdrawal',p_amount,COALESCE(p_date,NOW()),p_operation_id,
    'Transferencia bancaria a '||COALESCE(v_to.name,v_to.bank_name,'Cuenta destino')||
      CASE WHEN NULLIF(btrim(COALESCE(p_reason,'')),'') IS NOT NULL THEN ': '||p_reason ELSE '' END,
    p_operation_id);

  INSERT INTO public.bank_transactions(id,card_id,type,amount,date,reference,description,transaction_id)
  VALUES(v_in_id,p_to_card_id,'deposit',p_target_amount,COALESCE(p_date,NOW()),p_operation_id,
    'Transferencia bancaria desde '||COALESCE(v_from.name,v_from.bank_name,'Cuenta origen')||
      CASE WHEN NULLIF(btrim(COALESCE(p_reason,'')),'') IS NOT NULL THEN ': '||p_reason ELSE '' END,
    p_operation_id);

  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,new_data,meta)
  VALUES (
    NULLIF(current_setting('request.jwt.claim.sub', true),''),
    'BANK_INTERNAL_TRANSFER','bank_transfer',p_operation_id,
    jsonb_build_object('from_card_id',p_from_card_id,'to_card_id',p_to_card_id,'amount',p_amount,'target_amount',p_target_amount),
    jsonb_build_object('reason',p_reason)
  );

  RETURN jsonb_build_object('success',true,'operation_id',p_operation_id,
    'from_balance',v_from.balance-p_amount,'to_balance',v_to.balance+p_target_amount);
END
$function$;

CREATE OR REPLACE FUNCTION public.delete_bank_internal_transfer_v2(p_operation_id text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_out public.bank_transactions%ROWTYPE;
  v_in public.bank_transactions%ROWTYPE;
  v_from public.bank_cards%ROWTYPE;
  v_to public.bank_cards%ROWTYPE;
BEGIN
  IF NULLIF(btrim(p_operation_id),'') IS NULL THEN
    RAISE EXCEPTION 'ID de operación requerido' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_out
  FROM public.bank_transactions
  WHERE (transaction_id=p_operation_id OR id=p_operation_id||':OUT')
    AND type='withdrawal'
  ORDER BY created_at DESC LIMIT 1
  FOR UPDATE;

  SELECT * INTO v_in
  FROM public.bank_transactions
  WHERE (transaction_id=p_operation_id OR id=p_operation_id||':IN')
    AND type='deposit'
  ORDER BY created_at DESC LIMIT 1
  FOR UPDATE;

  IF v_out.id IS NULL AND v_in.id IS NULL THEN
    RETURN jsonb_build_object('success',true,'operation_id',p_operation_id,'already_deleted',true);
  END IF;
  IF v_out.id IS NULL OR v_in.id IS NULL THEN
    RAISE EXCEPTION 'No se puede eliminar una transferencia bancaria incompleta: %',p_operation_id USING ERRCODE='P0001';
  END IF;

  IF v_out.card_id < v_in.card_id THEN
    SELECT * INTO v_from FROM public.bank_cards WHERE id=v_out.card_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No existe la cuenta origen de la transferencia' USING ERRCODE='P0001'; END IF;
    SELECT * INTO v_to FROM public.bank_cards WHERE id=v_in.card_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No existe la cuenta destino de la transferencia' USING ERRCODE='P0001'; END IF;
  ELSE
    SELECT * INTO v_to FROM public.bank_cards WHERE id=v_in.card_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No existe la cuenta destino de la transferencia' USING ERRCODE='P0001'; END IF;
    SELECT * INTO v_from FROM public.bank_cards WHERE id=v_out.card_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No existe la cuenta origen de la transferencia' USING ERRCODE='P0001'; END IF;
  END IF;

  IF v_to.balance < v_in.amount THEN
    RAISE EXCEPTION 'No se puede revertir la transferencia: el saldo destino (%) es menor que el crédito a revertir (%)',v_to.balance,v_in.amount USING ERRCODE='P0001';
  END IF;

  UPDATE public.bank_cards SET balance=balance+v_out.amount WHERE id=v_from.id;
  UPDATE public.bank_cards SET balance=balance-v_in.amount WHERE id=v_to.id;

  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,old_data,new_data)
  VALUES (
    NULLIF(current_setting('request.jwt.claim.sub', true),''),
    'BANK_INTERNAL_TRANSFER_DELETE','bank_transfer',p_operation_id,
    jsonb_build_object('out',to_jsonb(v_out),'in',to_jsonb(v_in)),
    jsonb_build_object('from_balance',v_from.balance+v_out.amount,'to_balance',v_to.balance-v_in.amount)
  );

  DELETE FROM public.bank_transactions WHERE id IN (v_out.id,v_in.id);

  RETURN jsonb_build_object('success',true,'operation_id',p_operation_id,
    'from_card_id',v_from.id,'to_card_id',v_to.id,
    'from_balance',v_from.balance+v_out.amount,'to_balance',v_to.balance-v_in.amount);
END
$function$;

CREATE OR REPLACE FUNCTION public.delete_bank_transaction_v2(p_transaction_id text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_tx public.bank_transactions%ROWTYPE;
  v_card public.bank_cards%ROWTYPE;
  v_new_balance numeric;
BEGIN
  IF NULLIF(btrim(p_transaction_id),'') IS NULL THEN
    RAISE EXCEPTION 'ID de movimiento requerido' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_tx FROM public.bank_transactions WHERE id=p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',true,'transaction_id',p_transaction_id,'already_deleted',true);
  END IF;

  IF v_tx.transaction_id IS NOT NULL OR v_tx.id LIKE '%:OUT' OR v_tx.id LIKE '%:IN' THEN
    RETURN public.delete_bank_internal_transfer_v2(COALESCE(v_tx.transaction_id, regexp_replace(v_tx.id, ':(OUT|IN)$', '')));
  END IF;

  SELECT * INTO v_card FROM public.bank_cards WHERE id=v_tx.card_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cuenta bancaria del movimiento no existe' USING ERRCODE='P0001';
  END IF;

  IF v_tx.type IN ('withdrawal','supplier_payment') THEN
    v_new_balance := v_card.balance + v_tx.amount;
  ELSIF v_tx.type IN ('deposit','payment_received') THEN
    IF v_card.balance < v_tx.amount THEN
      RAISE EXCEPTION 'No se puede revertir el crédito: saldo actual % menor que %',v_card.balance,v_tx.amount USING ERRCODE='P0001';
    END IF;
    v_new_balance := v_card.balance - v_tx.amount;
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento no soporta eliminación automática: %',v_tx.type USING ERRCODE='P0001';
  END IF;

  UPDATE public.bank_cards SET balance=v_new_balance WHERE id=v_card.id;

  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,old_data,new_data)
  VALUES (
    NULLIF(current_setting('request.jwt.claim.sub', true),''),
    'BANK_TRANSACTION_DELETE','bank_transaction',v_tx.id,
    to_jsonb(v_tx),
    jsonb_build_object('card_id',v_card.id,'balance_before',v_card.balance,'balance_after',v_new_balance)
  );

  DELETE FROM public.bank_transactions WHERE id=v_tx.id;

  RETURN jsonb_build_object('success',true,'transaction_id',v_tx.id,'card_id',v_card.id,'balance',v_new_balance);
END
$function$;

CREATE OR REPLACE FUNCTION public.delete_bank_card_safe_v2(p_card_id text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_card public.bank_cards%ROWTYPE;
  v_count integer;
BEGIN
  SELECT * INTO v_card FROM public.bank_cards WHERE id=p_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',true,'already_deleted',true,'card_id',p_card_id);
  END IF;

  SELECT count(*) INTO v_count FROM public.bank_transactions WHERE card_id=p_card_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar la cuenta: conserva % movimiento(s) bancario(s). Desactívala en lugar de borrarla.',v_count USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.audit_log(user_id,action,entity_type,entity_id,old_data)
  VALUES (
    NULLIF(current_setting('request.jwt.claim.sub', true),''),
    'BANK_CARD_DELETE','bank_card',v_card.id,to_jsonb(v_card)
  );

  DELETE FROM public.bank_cards WHERE id=p_card_id;
  RETURN jsonb_build_object('success',true,'card_id',p_card_id);
END
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_transactions_card_reference
  ON public.bank_transactions(card_id,reference)
  WHERE reference IS NOT NULL AND btrim(reference)<>'';

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_cards_account_number
  ON public.bank_cards(account_number)
  WHERE account_number IS NOT NULL AND btrim(account_number)<>'';

ALTER TABLE public.bank_cards DROP CONSTRAINT IF EXISTS bank_cards_balance_nonnegative;
ALTER TABLE public.bank_cards ADD CONSTRAINT bank_cards_balance_nonnegative CHECK (balance >= 0);

ALTER TABLE public.bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_amount_positive;
ALTER TABLE public.bank_transactions ADD CONSTRAINT bank_transactions_amount_positive CHECK (amount > 0);

CREATE OR REPLACE FUNCTION public.process_bank_transaction_v2(
  p_id text,
  p_card_id text,
  p_type text,
  p_amount numeric,
  p_date timestamptz,
  p_reference text,
  p_description text,
  p_transaction_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_card public.bank_cards%ROWTYPE;
  v_existing public.bank_transactions%ROWTYPE;
  v_new_balance numeric;
BEGIN
  IF NULLIF(btrim(p_id),'') IS NULL THEN RAISE EXCEPTION 'ID de movimiento requerido' USING ERRCODE='P0001'; END IF;
  IF p_card_id IS NULL THEN RAISE EXCEPTION 'Cuenta bancaria requerida' USING ERRCODE='P0001'; END IF;
  IF COALESCE(p_amount,0)<=0 THEN RAISE EXCEPTION 'El importe debe ser mayor que 0' USING ERRCODE='P0001'; END IF;
  IF p_type NOT IN ('deposit','withdrawal','payment_received','supplier_payment') THEN
    RAISE EXCEPTION 'Tipo de movimiento bancario no soportado: %',p_type USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_existing FROM public.bank_transactions WHERE id=p_id FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object('success',true,'already_existed',true,'transaction_id',v_existing.id,
      'card_id',v_existing.card_id,'balance',(SELECT balance FROM public.bank_cards WHERE id=v_existing.card_id));
  END IF;

  SELECT * INTO v_card FROM public.bank_cards WHERE id=p_card_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta bancaria no existe' USING ERRCODE='P0001'; END IF;

  IF p_reference IS NOT NULL AND btrim(p_reference)<>'' THEN
    SELECT * INTO v_existing FROM public.bank_transactions
    WHERE card_id=p_card_id AND reference=p_reference
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      RETURN jsonb_build_object('success',true,'already_existed',true,'transaction_id',v_existing.id,
        'card_id',v_existing.card_id,'balance',v_card.balance);
    END IF;
  END IF;

  IF p_type IN ('withdrawal','supplier_payment') THEN
    IF v_card.balance < p_amount THEN
      RAISE EXCEPTION 'Saldo insuficiente en la cuenta: disponible %, requerido %',v_card.balance,p_amount USING ERRCODE='P0001';
    END IF;
    v_new_balance := v_card.balance-p_amount;
  ELSE
    v_new_balance := v_card.balance+p_amount;
  END IF;

  UPDATE public.bank_cards SET balance=v_new_balance WHERE id=p_card_id;

  INSERT INTO public.bank_transactions(
    id,card_id,type,amount,date,reference,description,transaction_id
  ) VALUES (
    p_id,p_card_id,p_type,p_amount,COALESCE(p_date,NOW()),NULLIF(btrim(p_reference),''),
    COALESCE(p_description,''),NULLIF(btrim(p_transaction_id),'')
  );

  RETURN jsonb_build_object('success',true,'transaction_id',p_id,'card_id',p_card_id,'balance',v_new_balance);
END
$function$;

NOTIFY pgrst,'reload schema';
