# BillByte — React Frontend

Restaurant OS built with Vite + React + TailwindCSS + React Query + Zustand.

## Stack

| Layer         | Tech                          |
|---------------|-------------------------------|
| Framework     | React 18 + Vite               |
| Styling       | Tailwind CSS + CSS variables  |
| State         | Zustand (auth + cart + UI)    |
| Server state  | TanStack React Query          |
| Charts        | Recharts                      |
| Icons         | Lucide React                  |
| HTTP          | Axios                         |
| Toasts        | React Hot Toast               |
| Routing       | React Router v6               |

## Project structure

```
src/
├── api/           API modules (auth, menu, orders, inventory, customers, staff, reports)
├── components/
│   ├── ui/        Primitives (Button, Card, Input, Modal, Badge, Toggle…)
│   └── layout/    Sidebar, Topbar, AppLayout, AIAssistant
├── pages/         Dashboard, Billing, Menu, Inventory, CRM, Staff, Reports, Settings, OnlineOrders, Login
├── store/         Zustand stores (auth, cart, ui)
└── utils/         formatINR, timeAgo, initials, statusColor, avatarColor
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Set your API URL
cp .env.example .env
# Edit .env → VITE_API_URL=http://localhost:8000/api

# 3. Start dev server
npm run dev
# → http://localhost:3000
```

## Connect to FastAPI backend

Make sure your FastAPI backend is running on port 8000:

```bash
cd billbyte-backend
uvicorn app.main:app --reload --port 8000
```

Then open http://localhost:3000, register your restaurant, and the full app is live.

## Build for production

```bash
npm run build
# Output in dist/ — deploy to Vercel, Netlify, or any static host
```

## Deploy to Vercel (free)

```bash
npm i -g vercel
vercel --prod
# Set VITE_API_URL to your Render backend URL in Vercel environment variables
```
