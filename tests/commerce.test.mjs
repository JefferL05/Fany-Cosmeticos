import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { escapeHtml, paymentMatchesOrder, verifyWebhook } from '../supabase/functions/_shared/commerce.ts';

test('payment must match the order, currency and total including freight', () => {
  const order = { id: 'order-1', total: '119.90' };
  const payment = { external_reference: 'order-1', currency_id: 'BRL', transaction_amount: 119.9 };
  assert.equal(paymentMatchesOrder(payment, order), true);
  assert.equal(paymentMatchesOrder({ ...payment, transaction_amount: 100 }, order), false);
  assert.equal(paymentMatchesOrder({ ...payment, currency_id: 'USD' }, order), false);
  assert.equal(paymentMatchesOrder({ ...payment, external_reference: 'other' }, order), false);
  assert.equal(paymentMatchesOrder({ ...payment, transaction_amount: NaN }, order), false);
});

test('webhook rejects forged signatures and changed payment or request identifiers', async () => {
  const secret = 'test-only';
  const digest = createHmac('sha256', secret).update('id:123;request-id:request-1;ts:123456789;').digest('hex');
  const signature = `ts=123456789,v1=${digest}`;
  assert.equal(await verifyWebhook(signature, 'request-1', '123', secret), true);
  assert.equal(await verifyWebhook(signature, 'request-2', '123', secret), false);
  assert.equal(await verifyWebhook(signature, 'request-1', '456', secret), false);
  assert.equal(await verifyWebhook(signature, 'request-1', '123', 'other-secret'), false);
  assert.equal(await verifyWebhook('', 'request-1', '123', secret), false);
});

test('customer names cannot inject markup into transactional emails', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)"> & Joana'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Joana');
});
