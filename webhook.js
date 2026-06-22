// api/webhook.js — Paystack Webhook Handler
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const { reference, metadata } = event.data;
    const orderId = metadata?.order_id;

    if (!orderId) return res.status(200).json({ received: true });

    // Update order payment & status
    const { error: orderErr } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        order_status: 'processing',
        paystack_reference: reference,
        paystack_transaction_id: String(event.data.id),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (orderErr) {
      console.error('Order update error:', orderErr);
      return res.status(500).json({ error: 'Order update failed' });
    }

    // Add tracking entry
    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status: 'processing',
      message: 'Payment confirmed. Your order is now being processed.'
    });

    // Fetch order for notification
    const { data: order } = await supabase
      .from('orders')
      .select('customer_id')
      .eq('id', orderId)
      .single();

    if (order) {
      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        title: 'Payment Confirmed! 🎉',
        message: `Your payment for order #${orderId.slice(-8).toUpperCase()} was successful. We're processing your order now.`,
        type: 'success',
        order_id: orderId
      });
    }
  }

  if (event.event === 'charge.failed') {
    const { reference, metadata } = event.data;
    const orderId = metadata?.order_id;
    if (!orderId) return res.status(200).json({ received: true });

    await supabase
      .from('orders')
      .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    const { data: order } = await supabase
      .from('orders')
      .select('customer_id')
      .eq('id', orderId)
      .single();

    if (order) {
      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        title: 'Payment Failed',
        message: `Payment for order #${orderId.slice(-8).toUpperCase()} failed. Please try again.`,
        type: 'error',
        order_id: orderId
      });
    }
  }

  return res.status(200).json({ received: true });
}
