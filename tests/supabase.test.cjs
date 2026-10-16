/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
test('Supabase schema: repeatable setup, restricted access, atomic counters and independent updates', async () => {
 const db = new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const sql=fs.readFileSync('supabase/setup.sql','utf8');
  await db.exec(sql); await db.exec(sql);
  await db.query("update public.choco_store set value=$1::jsonb where key='menu'",[JSON.stringify([{category:'Custom menu',items:[]}])]);
  await db.exec(fs.readFileSync('supabase/migrations/20261016_order_preparation.sql','utf8'));
  assert.equal((await db.query("select value from public.choco_store where key='menu'")).rows[0].value[0].category,'Custom menu');

  for(const role of ['anon','authenticated']) {
   const privileges=await db.query("select has_table_privilege($1,'public.choco_orders','SELECT') as read, has_function_privilege($1,'public.choco_create_order(jsonb)','EXECUTE') as create",[role]);
   assert.equal(privileges.rows[0].read,false); assert.equal(privileges.rows[0].create,false);
  }
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from public.choco_orders'),/permission denied/);
  await db.exec('reset role; set role service_role');
  const input={items:[{id:'nutella',price:150,quantity:1}],totalPrice:150,paymentMethod:'credit',tableOrName:'test',paymentStatus:'paid',status:'completed'};
  const results=await Promise.all(Array.from({length:12},()=>db.query('select public.choco_create_order($1::jsonb) as value',[JSON.stringify(input)])));
  const orders=results.map(r=>r.rows[0].value);
  assert.equal(new Set(orders.map(o=>o.id)).size,12); assert.equal(new Set(orders.map(o=>o.customerNumber)).size,12);
  assert.ok(orders.every(o=>o.paymentStatus==='unpaid' && o.status==='pending'));
  const id=orders[0].id;
  const patch=async value=>(await db.query('select public.choco_update_order($1,$2::jsonb) as value',[id,JSON.stringify(value)])).rows[0].value;
  await assert.rejects(patch({status:'completed'}),/Payment not verified/);
  await assert.rejects(patch({totalPrice:1}),/Invalid update/);
  await patch({sumupCheckoutId:'checkout-1'});
  await patch({paymentStatus:'paid'});
  await assert.rejects(patch({status:'preparing',prepMinutes:12}),/Invalid preparation time/);
  const accepted=await patch({status:'preparing',prepMinutes:20});
  assert.equal(accepted.prepMinutes,20);assert.ok(Math.abs(Date.parse(accepted.readyAt)-Date.now()-1200000)<5000);
  await assert.rejects(patch({readyAt:'2030-01-01'}),/Invalid update/);
  const complete=await patch({status:'completed'});
  assert.equal(complete.sumupCheckoutId,'checkout-1'); assert.equal(complete.paymentStatus,'paid');
  assert.equal((await patch({paymentStatus:'failed'})).paymentStatus,'paid');
  await assert.rejects(patch({sumupCheckoutId:'other'}),/already attached/);
  await db.query('delete from public.choco_orders where id=$1',[id]);
  assert.equal(await patch({status:'pending'}),null);
  const another=(await db.query('select public.choco_create_order($1::jsonb) as value',[JSON.stringify(input)])).rows[0].value;
  assert.equal(another.customerNumber,13);
 } finally { await db.close(); }
});
test('server storage uses Supabase RPC on Vercel without local locks or fallback', async () => {
 const path=require('node:path'); const ts=require('typescript');
 const originalFetch=global.fetch;
 const old={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY,legacy:process.env.SUPABASE_SERVICE_ROLE_KEY,vercel:process.env.VERCEL};
 const pg=new PGlite();
 try {
  await pg.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await pg.exec(fs.readFileSync('supabase/setup.sql','utf8'));
  require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
  const storage=require(path.resolve('src/lib/db.ts'));
  process.env.VERCEL='1'; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await assert.rejects(storage.getOrders(),/Supabase is required/);
  process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test_only';
  let failed=false; const calls=[];
  global.fetch=async(input,options)=>{
   const url=new URL(typeof input==='string'?input:input.url); calls.push(url.pathname);
   if(failed) return Response.json({message:'Database unavailable'},{status:503});
   const body=options?.body?JSON.parse(options.body):{};
   if(url.pathname.endsWith('/rpc/choco_create_order')) return Response.json((await pg.query('select public.choco_create_order($1::jsonb) as value',[JSON.stringify(body.p_order)])).rows[0].value);
   if(url.pathname.endsWith('/rpc/choco_update_order')) return Response.json((await pg.query('select public.choco_update_order($1,$2::jsonb) as value',[body.p_id,JSON.stringify(body.p_patch)])).rows[0].value);
   if(url.pathname.endsWith('/choco_orders')) {
    const id=url.searchParams.get('id')?.replace(/^eq\./,'');
    const rows=(await pg.query('select value from public.choco_orders where id=$1',[id])).rows;
    return Response.json(rows);
   }
   throw new Error('Unexpected remote operation');
  };
  const order=await storage.withOrderLock(()=>storage.createNewOrder({items:[{id:'nutella',name:'Nutella',price:150,quantity:1}],totalPrice:150,paymentMethod:'cash'}));
  assert.ok(order.id.startsWith('ORD-'));
  await storage.updateOrder(order.id,{status:'completed'});
  assert.equal((await storage.getOrder(order.id)).status,'completed');
  await assert.rejects(storage.saveOrders([]),/Bulk replacement/);
  failed=true;
  await assert.rejects(storage.getOrder(order.id),/Unable to load order/);
  assert.ok(calls.includes('/rest/v1/rpc/choco_create_order'));
 } finally {
  global.fetch=originalFetch;
  for(const [name,val] of Object.entries({SUPABASE_URL:old.url,SUPABASE_SECRET_KEY:old.key,SUPABASE_SERVICE_ROLE_KEY:old.legacy,VERCEL:old.vercel})) { if(val===undefined) delete process.env[name]; else process.env[name]=val; }
  await pg.close();
 }
});
