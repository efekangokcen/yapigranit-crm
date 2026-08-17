<div align="center">
  <h1>🏗️ YapıGranit ERP</h1>
  <p><strong>Enterprise Resource Planning for Natural Stone Manufacturing</strong></p>
  <p>Full-stack ERP system managing the complete lifecycle from customer acquisition to production, cutting optimization, and financial operations.</p>

  ![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
  ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
  ![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)
</div>

---

## 📋 Key Features

- 🎯 **Customer 360° Portal & Sales Pipeline (Kanban):** Track leads, manage stages, and gain a holistic view of customer interactions.
- 🧮 **Cost Calculation Engine:** Accurately compute costs including raw materials, labor, transport, and processing.
- 📄 **Quote & Contract Management:** Generate professional PDFs for quotes and contracts seamlessly.
- 📐 **Field Measurement Team Scheduling & Revision Management:** Assign tasks, track progress, and handle requested revisions efficiently.
- 📦 **Barcode-enabled Stone Slab Inventory & Warehouse Transfers:** Manage physical inventory, track specific slabs, and execute warehouse transfers.
- 🔪 **2D Guillotine Cutting Optimization:** Advanced nesting algorithm to minimize waste and maximize stone slab yield.
- 🏭 **Factory Terminal Integration:** CNC/bridge cutter heartbeat monitoring and production queue management.
- 🚚 **Assembly & Field Delivery Tracking:** Monitor the final stages of the process right to the customer's site.
- 💰 **Multi-account Financial Hub:** Comprehensive financial tracking supporting 40+ bank/cash accounts, checks, promissory notes, credit installments, and SGK.
- 📒 **Daily Cash Book & Inter-account Transfers:** Manage virman (transfer) and mahsup (offset) operations.
- 🔍 **Activity Logging & Audit Trail:** Keep a detailed record of system actions and data changes.
- 🔐 **Role-Based Access Control:** Secure access levels tailored for Admin, Sales, Workshop, and Measurement teams.

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Styling** | Tailwind CSS, shadcn/ui |
| **State & Fetching** | React Query, Zustand |
| **PDF Generation** | @react-pdf/renderer |
| **Authentication** | NextAuth.js / Supabase Auth |

## 📐 Architecture

The system utilizes a monolithic architecture built on top of Next.js, leveraging Server Components and Server Actions for efficient data fetching and mutations. The backend interacts directly with a robust PostgreSQL database through Prisma ORM, ensuring type safety from end to end. The front-end employs a modular component structure (shadcn/ui) optimized for complex data entry and visualization.

## 🗄️ Database Structure

The robust relational database model is designed specifically for manufacturing workflows. It features:
- **37 Prisma Models** representing core entities (Customers, Contracts, Stones, Transactions, etc.)
- **13 PostgreSQL Enums** for strict state management (e.g., pipeline stages, material finishes, payment types)

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/yapigranit-crm.git
   cd yapigranit-crm
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Update the values in .env.local with your database and auth credentials
   ```

4. **Database Migration**
   ```bash
   npx prisma migrate dev
   ```

5. **Seed Demo Data**
   ```bash
   npx tsx scripts/seed-all-demo.ts
   ```

6. **Run the Development Server**
   ```bash
   pnpm dev
   ```

## 📊 Modules Overview

| Module | Description |
|---|---|
| **Sales** | Pipeline, Quotes, Contracts, Customer profiles |
| **Production** | Cutting optimization, Factory terminal, Quality control |
| **Inventory** | Barcode tracking, Slabs, Warehouses, Suppliers |
| **Finance** | Cashbook, Checks, Installments, Financial reporting |
| **Logistics** | Measurement scheduling, Deliveries, Installations |

## 🔐 Security

- **Role-Based Access Control (RBAC):** Strict isolation between Sales, Workshop, Measurement, and Admin roles.
- **CSP Headers:** Implemented Content Security Policy to mitigate XSS attacks.
- **Brute-Force Protection:** Rate limiting on sensitive endpoints like authentication.
- **Data Sanitization:** Input validation using Zod schemas.

## 👨‍💻 Developer

**Developed by Ali Efekan Gökcen**
- [LinkedIn](https://www.linkedin.com/in/aliefekangokcen)
- [GitHub](https://github.com/aliefekangokcen)

## License

This project is licensed under the [MIT License](LICENSE).
