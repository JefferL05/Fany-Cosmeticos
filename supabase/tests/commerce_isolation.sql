-- Self-contained fixtures: never depend on or reset the store's current stock.
begin;
insert into auth.users(id,email) values
('00000000-0000-4000-9000-000000000001','commerce-a@example.invalid'),
('00000000-0000-4000-9000-000000000002','commerce-b@example.invalid');
insert into public.products(id,details,stock) values
('commerce-test-item','{"name":"Fixture","price":100,"pixPrice":95}'::jsonb,2);
set local role anon;
do $$ begin
  begin
    perform * from public.orders;
    raise exception 'Anonymous order access allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into public.orders(id,user_id,customer_name,payment_method,shipping_uf,requested_items)
values('00000000-0000-4000-9000-000000000003','00000000-0000-4000-9000-000000000001','Fixture','pix','SP','[{"id":"commerce-test-item","quantity":1}]');
do $$ begin
  if (select total from public.orders where id='00000000-0000-4000-9000-000000000003') <> 109.90 then raise exception 'Incorrect total with freight'; end if;
  begin
    insert into public.orders(user_id,customer_name,payment_method,shipping_uf,requested_items)
    values('00000000-0000-4000-9000-000000000001','Fixture','pix','SP','[{"id":"commerce-test-item","quantity":3}]');
    raise exception 'Excess quantity allowed';
  exception when raise_exception then if sqlerrm <> 'Product unavailable' then raise; end if; end;
  begin
    update public.orders set payment_status='paid' where id='00000000-0000-4000-9000-000000000003';
    raise exception 'Customer payment update allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.orders(user_id,customer_name,payment_method,shipping_uf,requested_items,total)
    values('00000000-0000-4000-9000-000000000001','Fixture','pix','SP','[{"id":"commerce-test-item","quantity":1}]',0);
    raise exception 'Client total accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.orders where id='00000000-0000-4000-9000-000000000003') then raise exception 'Cross-customer order leak'; end if;
end $$;
reset role;
select 'PASS: pricing, freight, stock limit, anonymous denial, payment protection, customer isolation. Fixtures rolled back.' as verification;
rollback;
