# ShopGH — Mobile-First E-Commerce Platform

A full-featured Temu-style e-commerce platform built with vanilla HTML/JS, Supabase, and Vercel.

## 🚀 Quick Deploy

### 1. Run the Database Schema

Go to your Supabase project → SQL Editor → paste and run `schema.sql`.

This creates all tables, RLS policies, realtime subscriptions, and seeds sample products + an admin account.

**Admin credentials (after you set up auth):**
- Email: `admin@shopgh.com`
- Password: Set via Supabase Auth → Users → Invite / set manually

### 2. Configure Supabase Auth

In Supabase dashboard:
- Authentication → Providers → Email: Enable
- Authentication → URL Configuration → Site URL: `https://your-vercel-domain.vercel.app`

### 3. Update Keys in `public/index.html`

Find and replace:
```js
const PAYSTACK_PUBLIC = 'pk_live_your_paystack_public_key';
```
With your actual Paystack public key.

The Supabase URL and anon key are already set.

### 4. Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Set environment variables in Vercel dashboard:
- `SUPABASE_URL` = your Supabase URL
- `SUPABASE_SERVICE_KEY` = your Supabase service role key
- `PAYSTACK_SECRET_KEY` = your Paystack secret key

### 5. Set Up Paystack Webhook

In Paystack dashboard → Settings → Webhooks:
- URL: `https://your-vercel-domain.vercel.app/api/webhook`
- Events: `charge.success`, `charge.failed`

---

## 🏗️ Architecture

```
├── public/
│   └── index.html       # Full SPA (HTML + CSS + JS)
├── api/
│   └── webhook.js       # Paystack webhook handler (Vercel serverless)
├── schema.sql           # Full DB schema with RLS & seed data
├── vercel.json          # Vercel routing config
└── package.json
```

## ✨ Features

### Customer
- Register / Login (Supabase Auth)
- Browse products by category + search
- Product detail modal
- Shopping cart (localStorage)
- Paystack checkout (GHS)
- Order history with real-time status
- Retry payment on failed orders
- Notifications (real-time)
- Profile management

### Admin
- Analytics dashboard (revenue, orders, customers, products)
- Product management (CRUD)
- Create orders and assign to customers
- Update order status with tracking messages
- Customer list
- Real-time order sync

### Order Status Flow
```
Pending Payment → Processing → Packed → Shipped → In Transit → Delivered
                                                              ↘ Cancelled
```

### Real-Time
- Order status updates push instantly to customer dashboard
- Notifications appear in real-time via Supabase Realtime
- Admin order list updates live

---

## 🔐 Security Notes

- Replace the Paystack public key in `index.html`
- Never expose `SUPABASE_SERVICE_KEY` in frontend code
- Rotate keys after development/testing with live credentials
- RLS policies ensure customers only see their own data

---

## 🛠️ Local Development

```bash
# Install Vercel CLI
npm install -g vercel

# Copy env template
cp .env.example .env.local

# Run locally
vercel dev
```

Access at `http://localhost:3000`

---

## 📱 Mobile-First Design

- Bottom navigation bar (iOS/Android style)
- Safe area inset support
- Touch-optimized card interactions
- No horizontal scroll overflow
- Paystack inline iframe works on mobile
