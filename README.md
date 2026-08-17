# 🏗️ YapıGranit ERP — Industrial Manufacturing & Operations Management System

> **Full-stack Enterprise Resource Planning (ERP & CRM) system engineered for natural stone (granite, marble, porcelain) manufacturing, fabrication, and field installation operations.**

YapıGranit ERP is an enterprise-grade management platform that covers the complete end-to-end industrial lifecycle: from lead capture and 360° customer relationship management to automated cost estimation, 2D guillotine cutting optimization, factory CNC terminal synchronization, field measurement/installation tracking, and multi-account financial accounting.

**Developed by Ali Efekan Gökcen** | [LinkedIn](https://www.linkedin.com/in/efekangokcen/) | [GitHub](https://github.com/efekangokcen)

---

## ✨ Key Modules & Capabilities

- **🎯 Customer 360° & Sales Pipeline**: Multi-stage visual sales funnel (Kanban), lead qualification, and customer interaction history.
- **📐 Precision Cost Engine**: Dynamic calculation engine processing raw stone dimensions, wastage coefficients, custom edge tooling, fason processing, labor, and transport costs.
- **📄 Proposals & Contracts**: Multi-currency quote generation, contract binding, automated payment schedule generation, and vector-clean PDF rendering.
- **📏 Field Measurement Coordination**: Mobile-responsive measurement scheduling, on-site dimension adjustments, and revision request workflows.
- **📦 Barcode Slab & Inventory Control**: Slab-level barcode tracking, warehouse bin transfers, stone reservations, and automated procurement alerts.
- **⚙️ 2D Guillotine Cutting Optimization**: Custom 2D nesting algorithm maximizing raw slab yield and minimizing industrial scrap material.
- **🏭 Factory Floor Terminal Integration**: Real-time heartbeat monitoring and job queuing for workshop CNC machines and bridge cutting saws.
- **🚚 Field Installation & Delivery Tracking**: Multi-step delivery verification, on-site sign-off, and customer acceptance workflows.
- **💼 Comprehensive Financial Hub**:
  - Management of **40+ bank, cash, credit line (KMH), and corporate credit card accounts**.
  - Commercial promissory notes (*senet*), checks, and SGK liability lifecycle tracking.
  - Daily cash ledger (*kasa defteri*), inter-account transfers (*virman*), and cross-ledger settlements (*mahsup*).
  - Current account (*cari*) reconciliation with automatic transaction logging.
- **🛡️ Audit Trail & RBAC**: Granular role-based authorization (Admin, Sales, Workshop, Field Measurement) and immutable system activity logging.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router, Server Actions, React 19, Turbopack) |
| **Language** | TypeScript 5 |
| **UI & Styling** | Tailwind CSS v4, Radix UI Primitives, Lucide Icons, Sonner |
| **Database & ORM** | PostgreSQL, Prisma ORM 7 (`@prisma/adapter-pg`) |
| **Authentication** | NextAuth.js (Auth.js v5) with JWT & Role-Based Middleware |
| **Document Generation** | jsPDF & jsPDF-autotable (Contract & Quote PDF Engines) |
| **Validation & Quality** | Zod 4, Playwright E2E Testing, ESLint 9 |

---

## 🗄️ Database & Cloud Architecture

The production database is hosted on **Supabase Cloud (PostgreSQL on AWS)**. 

To maintain security, commercial confidentiality, and data privacy:
- Production database credentials and live corporate data have been securely isolated.
- The complete relational database architecture is defined and version-controlled via **Prisma Schema (`prisma/schema.prisma`)** comprising **37 relational models** and **13 PostgreSQL enums**.
- **15 incremental SQL migration files** are included in `prisma/migrations/` to replicate the exact database schema in any environment.

### Entity Relationship Overview:
```
Customer ──< CostCalculation ──< Quote ──1:1── Contract ──< ContractItem
                                                                 │
                   ┌─────────────────────────────────────────────┼─────────────────────────────┐
                   ▼                                             ▼                             ▼
            MeasurementTask                               WorkQueue (Workshop)           InstallationTask
                   │                                             │                             │
                   ▼                                             ▼                             ▼
              RevisionReq                                2D Cutting Nesting             Site Delivery Sign-off
```

---

## 🔐 Security & Architecture Highlights

- **Multi-Role RBAC:** Strict route and action isolation across Administrator, Sales, Workshop, and Field teams.
- **Content Security Policy (CSP):** Hardened HTTP headers preventing XSS, clickjacking, and MIME sniffing.
- **Brute-Force Rate Limiting:** Endpoint protection for authentication and sensitive transaction routes.
- **Safe Server Actions:** Custom crash-resilient wrapper (`safe-action.ts`) ensuring transaction atomicity.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ & pnpm
- A PostgreSQL instance or Supabase project

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/efekangokcen/yapigranit-crm.git
   cd yapigranit-crm
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**
   ```bash
   cp .env.example .env.local
   ```
   Provide your PostgreSQL / Supabase connection URL in `.env.local`.

4. **Initialize Database**
   ```bash
   npx prisma migrate deploy
   # or
   npx prisma db push
   ```

5. **Start Development Server**
   ```bash
   pnpm dev
   ```

---

## 👨‍💻 Developer

**Ali Efekan Gökcen**  
- [LinkedIn Profile](https://www.linkedin.com/in/efekangokcen/)
- [GitHub Profile](https://github.com/efekangokcen)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
