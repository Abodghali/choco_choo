-- Add preparation estimates. Does not modify menu, settings or existing orders.
begin;
create or replace function public.choco_update_order(p_id text, p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_order jsonb; result jsonb;
begin
  if jsonb_typeof(p_patch) is distinct from 'object' or
     (p_patch - 'status' - 'paymentStatus' - 'sumupCheckoutId' - 'prepMinutes') <> '{}'::jsonb then
    raise exception 'Invalid update';
  end if;
  select value into current_order from public.choco_orders where id = p_id for update;
  if not found then return null; end if;
  if p_patch ? 'status' and (p_patch->>'status' is null or p_patch->>'status' not in ('pending','preparing','completed','cancelled')) then raise exception 'Invalid status'; end if;
  if p_patch ? 'paymentStatus' and (p_patch->>'paymentStatus' is null or p_patch->>'paymentStatus' not in ('paid','unpaid','failed')) then raise exception 'Invalid payment status'; end if;
  if p_patch ? 'sumupCheckoutId' and (jsonb_typeof(p_patch->'sumupCheckoutId') is distinct from 'string' or length(p_patch->>'sumupCheckoutId') = 0) then raise exception 'Invalid checkout'; end if;
  if p_patch ? 'prepMinutes' then
    if p_patch->>'status' is distinct from 'preparing' or (p_patch->>'prepMinutes')::numeric not in (10,15,20,25,30) or p_patch->>'prepMinutes' is null or current_order->>'status' not in ('pending','preparing') then raise exception 'Invalid preparation time'; end if;
    p_patch := p_patch || jsonb_build_object('acceptedAt',coalesce(current_order->>'acceptedAt',now()::text),'readyAt',now() + make_interval(mins => (p_patch->>'prepMinutes')::integer));
  end if;
  if p_patch->>'status' = 'preparing' and not (current_order ? 'readyAt') and not (p_patch ? 'prepMinutes') then raise exception 'Choose preparation time'; end if;
  if current_order->>'paymentStatus' = 'paid' then p_patch := p_patch - 'paymentStatus'; end if;
  if current_order ? 'sumupCheckoutId' and p_patch ? 'sumupCheckoutId' and current_order->>'sumupCheckoutId' <> p_patch->>'sumupCheckoutId' then raise exception 'Checkout already attached'; end if;
  result := current_order || p_patch;
  if result->>'paymentMethod' <> 'cash' and result->>'paymentStatus' <> 'paid' and result->>'status' in ('preparing','completed') then raise exception 'Payment not verified'; end if;
  update public.choco_orders set value = result where id = p_id;
  return result;
end;
$$;
revoke all on function public.choco_create_order(jsonb), public.choco_update_order(text,jsonb) from public, anon, authenticated;
grant execute on function public.choco_create_order(jsonb), public.choco_update_order(text,jsonb) to service_role;
commit;
