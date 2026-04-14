# 🌿 Agrolytix — Frontend

**Agrolytix** is a modern agribusiness inventory management system built with **Angular 21** and **Tailwind CSS**. It provides a dual-role interface (Admin + Worker) for managing retail and wholesale inventory, point-of-sale operations, client debts, and financial reporting.

> **Backend**: Paired with [`agrolytix-api`](../agrolytix-api) — Laravel 11 REST API.

---

## 🛠 Tech Stack

| | |
|---|---|
| Framework | Angular 21 (standalone components) |
| Styling | Tailwind CSS v4 + custom agro design tokens |
| Auth | JWT via Laravel Sanctum (token stored in `localStorage`) |
| Cart | Client-side (`localStorage`) — no server round-trips |
| API | `http://localhost:8001/api` |

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 20
- Angular CLI 21

### Install & Run
```bash
npm install
npm start          # serves at http://localhost:4200
```

### Build for Production
```bash
npm run build      # output in dist/agrolytix/
```

---

## 👤 Roles

| Role | Access |
|---|---|
| **Admin** | Full system access — inventory, POS, sales, reports, workers, clients |
| **Worker** | POS (retail + wholesale) and sales history only |

---

## 📋 Feature Status

## 📋 Feature Status

### ✅ Built & Functional
| Feature | Status | Notes |
|---|---|---|
| Project scaffold (core/layout/shared) | ✅ Complete | Guards, interceptors, services, layout shell |
| Auth module (login, guard, interceptor) | ✅ Complete | Beautiful branded login page |
| Dashboard | ✅ Complete | 6 KPI cards, live stats from API |
| Sidebar (role-aware) | ✅ Complete | Admin sees all; Workers see POS + Sales only |
| Header | ✅ Complete | User chip, initials, logout button |
| Toast notifications | ✅ Complete | Success/error/warning/info |
| Shared KPI card component | ✅ Complete | Reusable across views |
| Confirm modal | ✅ Complete | Reusable delete/action dialog |
| Retail Inventory | ✅ Complete | Product list, add/edit, restock, categories, SVG sort/filter |
| Wholesale Inventory | ✅ Complete | Product list, add/edit, restock, categories, SVG sort/filter |

### 🔧 In Progress / Next Steps
| Feature | Route | Next Step |
|---|---|---|
| **Wholesale POS** | `/pos/wholesale` | Client selector + cart + debt **(NEXT)** |
| Retail POS | `/pos/retail` | Product grid + localStorage cart |
| Retail Sales | `/sales/retail` | Table + date filter + reversal |
| Wholesale Sales | `/sales/wholesale` | Table + pay debt modal |
| Reversals | `/reversals` | Log of reversed sales |
| Clients | `/clients` | Wholesale customer CRUD |
| Workers | `/admin/workers` | Worker account management |
| Reports | `/reports` | Date-range financial summary |

> **Development Rule**: From this point forward, all newly generated Angular components must separate their template and styles into dedicated `.html` and `.css`/`.scss` files (using `templateUrl` and `styleUrl`). No inline templates in `.ts` files allowed.

| Feature | Route | Admin | Worker |
|---|---|:---:|:---:|
| Login | `/auth` | ✅ | ✅ |
| Dashboard | `/dashboard` | ✅ | ✅ |
| Retail Inventory | `/inventory/retail` | ✅ | — |
| Wholesale Inventory | `/inventory/wholesale` | ✅ | — |
| Retail POS | `/pos/retail` | ✅ | ✅ |
| Wholesale POS | `/pos/wholesale` | ✅ | ✅ |
| Retail Sales History | `/sales/retail` | ✅ | ✅ |
| Wholesale Sales History | `/sales/wholesale` | ✅ | ✅ |
| Reversals | `/reversals` | ✅ | — |
| Clients (Wholesale) | `/clients` | ✅ | — |
| Workers | `/admin/workers` | ✅ | — |
| Reports | `/reports` | ✅ | — |

---

## 🏗 Project Structure

```
src/
└── app/
    ├── core/
    │   ├── guards/          # Auth + role guards
    │   ├── interceptors/    # HTTP auth token injector
    │   └── services/        # Auth, layout, toast services
    ├── layout/
    │   ├── app-layout/      # Shell wrapper (sidebar + header + router-outlet)
    │   ├── sidebar/         # Role-aware navigation
    │   └── header/          # Page title + user chip + mobile toggle
    ├── features/
    │   ├── auth/            # Login page
    │   ├── dashboard/       # KPI summary cards
    │   ├── inventory/       # Retail & wholesale stock management
    │   ├── pos/             # Retail & wholesale point-of-sale
    │   ├── sales/           # Retail & wholesale sales history
    │   ├── reversals/       # Reversed sales log (Admin)
    │   ├── clients/         # Wholesale client management (Admin)
    │   ├── admin/           # Worker management (Admin)
    │   └── reports/         # Financial reports (Admin)
    └── shared/
        ├── confirm-modal/   # Delete/action confirmation dialog
        ├── toast/           # Flash message overlay
        ├── kpi-card/        # Dashboard stat cards
        └── data-table/      # Reusable sortable/filterable table
```

---

## 🎨 Design Language

- **Theme**: Dark agro — forest green background with green/amber accents
- **Font**: Inter (Google Fonts)
- **Effects**: Glassmorphism sidebar, ambient gradient blobs, smooth transitions
- **Palette**:
  - Background: `#0f1a0f`
  - Primary: `#4ade80` (green-400)
  - Accent: `#f59e0b` (amber-400)

---

## 📦 Unit / Bulk Pricing

Products support multiple **selling units** (e.g., bottle, box) with individual prices. Boxes/bulk units carry automatic bulk discounts configured per product. This is managed in the inventory screens and reflected dynamically at POS.
