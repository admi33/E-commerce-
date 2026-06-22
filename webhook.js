// api/webhook.js — Paystack Webhook Handler
// Vercel serverless function (Node.js runtime)
// Required env vars: PAYSTACK_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 1. Verify HMAC-SHA512 signature ─────────────────────────
  const signature = req.headers['x-paystack-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing signature' });
  }

  const rawBody = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  if (hash !== signature) {
    console.error('ShopGH webhook: invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  const { event: eventType, data } = event;

  console.log(`ShopGH webhook: received ${eventType}`, data?.reference);

  // ── 2. Handle charge.success ─────────────────────────────────
  if (eventType === 'charge.success') {
    const reference = data.reference;

    // Find the order by paystack_reference
    const { data: orders, error: findError } = await supabase
      .from('orders')
      .select('id, customer_id')
      .eq('paystack_reference', reference)
      .limit(1);

    if (findError || !orders?.length) {
      console.error('ShopGH webhook: order not found for reference', reference);
      return res.status(200).json({ received: true }); // Always 200 to Paystack
    }

    const order = orders[0];

    // Update order
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        order_status: 'processing',
        paystack_transaction_id: String(data.id),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('ShopGH webhook: failed to update order', updateError);
    }

    // Insert tracking entry
    await supabase.from('order_tracking').insert({
      order_id: order.id,
      status: 'processing',
      message: 'Payment confirmed. Your order is now being processed.'
    });

    // Notify customer
    await supabase.from('notifications').insert({
      user_id: order.customer_id,
      title: 'Payment Confirmed! 🎉',
      message: `Your payment was successful. We're now processing your order.`,
      type: 'success',
      order_id: order.id
    });

    console.log(`ShopGH webhook: order ${order.id} marked paid`);
  }

  // ── 3. Handle charge.failed ──────────────────────────────────
  else if (eventType === 'charge.failed') {
    const reference = data.reference;

    const { data: orders } = await supabase
      .from('orders')
      .select('id, customer_id')
      .eq('paystack_reference', reference)
      .limit(1);

    if (orders?.length) {
      const order = orders[0];

      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        title: 'Payment Failed',
        message: 'Your payment could not be completed. Please try again.',
        type: 'error',
        order_id: order.id
      });

      console.log(`ShopGH webhook: order ${order.id} marked failed`);
    }
  }

  // Always return 200 to Paystack
  return res.status(200).json({ received: true });
};
