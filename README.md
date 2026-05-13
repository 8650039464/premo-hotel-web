# 🏨 PREMO Hotel Booking — Web Platform

Flutter app se convert kiya gaya **Next.js 14** web platform.  
Teeno portals ek hi project mein — User, Hotel Admin, Super Admin.

---

## 🚀 Quick Start

```bash
# 1. Dependencies install karo
npm install

# 2. Dev server chalao
npm run dev

# 3. Browser mein kholo
open http://localhost:3000
```

---

## 📁 Project Structure

```
hotel-web/
├── app/
│   ├── page.tsx                    ← Landing (portal selector)
│   │
│   ├── user/                       ← USER PORTAL
│   │   ├── layout.tsx              ← Nav + auth guard
│   │   ├── page.tsx                ← Hotel search & browse
│   │   ├── login/page.tsx          ← Login
│   │   ├── register/page.tsx       ← Register + OTP
│   │   ├── hotel/[id]/page.tsx     ← Hotel detail + booking
│   │   ├── bookings/page.tsx       ← My bookings + OTP
│   │   └── account/page.tsx        ← Profile
│   │
│   ├── hotel-admin/                ← HOTEL ADMIN PANEL
│   │   ├── layout.tsx
│   │   ├── page.tsx                ← Dashboard stats
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx       ← Hotel partner registration
│   │   ├── bookings/page.tsx       ← Bookings + Walk-in booking
│   │   ├── property/page.tsx       ← Hotel & rooms management
│   │   ├── complaints/page.tsx     ← Complaints
│   │   └── account/page.tsx
│   │
│   └── super-admin/                ← SUPER ADMIN PANEL
│       ├── layout.tsx
│       ├── page.tsx                ← Dashboard + pending approvals
│       ├── login/page.tsx
│       ├── hotels/page.tsx         ← Hotels approve/reject
│       ├── bookings/page.tsx       ← All bookings + status update
│       ├── users/page.tsx          ← Users + hotel partners
│       ├── complaints/page.tsx     ← All complaints
│       └── account/page.tsx
│
├── components/
│   └── shared/
│       ├── ui.tsx                  ← Toast, Spinner, Badge, etc.
│       └── LoginForm.tsx           ← Reusable login form
│
└── lib/
    └── api.ts                      ← API config + helpers
```

---

## 🔑 API Configuration

`lib/api.ts` file mein:
```ts
export const API_BASE  = 'https://hotel-api-master.onrender.com';       // bare server (uploads/photos)
export const API_ROOT  = `${API_BASE}/p`;                                // firm-scoped root (Premo = 'p')
export const API_TOKEN = 'premo_hotel_f0eb62d75c7516f4';
```

> **Important:** Premo backend saare routes `/p/api/...` pe mount karta hai (firm prefix `p`). Isliye API calls ke liye `API_ROOT` use karo, aur sirf photo/upload URLs ke liye `API_BASE` (kyunki `/uploads/*` root pe serve hota hai).

> **Production ke liye:** `API_BASE` apne live server URL se replace karo.

---

## 🌐 Portals & Routes

| Portal | Route | Login Role |
|--------|-------|-----------|
| Landing | `/` | — |
| User Portal | `/user` | `user` |
| Hotel Admin | `/hotel-admin` | `hotel` |
| Super Admin | `/super-admin` | `admin` |

---

## ✅ Features — Flutter se Web tak

### 👤 User Portal
- [x] Browse hotels by city / search by name
- [x] Check-in date, time, duration filter
- [x] Check-out time preview
- [x] Hotel detail page with photos
- [x] Room booking with duration/date/time/guests
- [x] My bookings — Active & Past tabs
- [x] Check-in OTP display
- [x] Cancel booking
- [x] Register with phone OTP verification
- [x] Login + Forgot Password

### 🏩 Hotel Admin Panel
- [x] Dashboard — Total rooms, available, booked, revenue
- [x] Active bookings highlight
- [x] All bookings — Active & Past with date filter
- [x] Check-in via OTP verification dialog
- [x] Check-out action
- [x] Walk-in booking (6-step: duration → AC filter → date → time → room → guest)
- [x] Property management — create/edit hotel
- [x] Room add/edit with pricing per duration slot
- [x] Room availability toggle
- [x] Complaints — view & update status

### ⚡ Super Admin Panel
- [x] Dashboard with platform-wide stats
- [x] Pending hotel approvals with approve/reject
- [x] Hotels management — pending/active/rejected tabs
- [x] All bookings with status updates
- [x] Users management — block/unblock
- [x] Hotel partners management
- [x] All complaints with status workflow

---

## 🛠️ Tech Stack

| Tool | Purpose |
|------|---------|
| **Next.js 14** | React framework (App Router) |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling |
| **Native fetch** | API calls (no extra lib needed) |

---

## 📦 Build for Production

```bash
npm run build
npm start
```

### Deploy on Vercel (easiest):
```bash
npx vercel --prod
```

### Deploy on any server:
```bash
npm run build
# .next/ folder serve karo
```

---

## 🔧 Customization

### Brand color change:
`tailwind.config.js` mein:
```js
colors: {
  primary: '#FDC507',        // ← apna color daalo
  'primary-dark': '#E6B000',
}
```

### App name change:
`app/layout.tsx` mein metadata update karo.

### API URL change:
`lib/api.ts` mein `API_BASE` update karo.

---

## 📞 API Endpoints Used

```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/forgot-password
POST /api/auth/google
GET  /api/auth/me
PUT  /api/auth/me/update
GET  /api/auth/pending-hotels
PUT  /api/auth/approve/:userId
GET  /api/auth/all-hotels
GET  /api/auth/all-users

GET  /api/hotels/all
GET  /api/hotels/my
POST /api/hotels/add
PUT  /api/hotels/update/:id
GET  /api/hotels/nearby

GET  /api/rooms/hotel/:hotelId
GET  /api/rooms/available
POST /api/rooms/add
PUT  /api/rooms/update/:id
DELETE /api/rooms/delete/:id

GET  /api/bookings/my
GET  /api/bookings/hotel/:hotelId
GET  /api/bookings/all
POST /api/bookings/add
POST /api/bookings/walkin
PUT  /api/bookings/update/:id
DELETE /api/bookings/delete/:id
POST /api/bookings/verify-checkin/:id

GET  /api/photos/hotel/:hotelId
POST /api/photos/upload
DELETE /api/photos/delete/:id

GET  /api/complaints/all
GET  /api/complaints/hotel/:hotelId
PUT  /api/complaints/status/:id

GET  /api/cities/all
POST /api/otp/send
POST /api/otp/verify
```
