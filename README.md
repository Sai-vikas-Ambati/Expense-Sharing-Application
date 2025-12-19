# Expense Sharing Application

A production-grade expense sharing application (Splitwise-like) with ledger-based balance tracking and simplified settlements.

## 🎯 Features

- **User Authentication**: JWT-based login/register with bcrypt password hashing
- **Group Management**: Create groups, add members by email
- **Expense Tracking**: Add expenses with three split types:
  - **Equal**: Split evenly among participants
  - **Exact**: Specify exact amounts per person
  - **Percentage**: Split by percentage shares
- **Ledger-Based Balances**: O(1) balance lookups, atomic updates
- **Balance Simplification**: Greedy algorithm minimizes settlement transfers
- **Settlement Recording**: Track payments between members

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│   React + TS    │────▶│  Express + TS    │────▶│  PostgreSQL    │
│   (Vite)        │◀────│  (REST API)      │◀────│  (Prisma ORM)  │
└─────────────────┘     └──────────────────┘     └────────────────┘
       │                        │
       ▼                        ▼
  React Query           JWT + bcrypt
  React Hook Form       Zod validation
  Tailwind CSS          Ledger model
```

### Data Flow: Expense Creation

1. User submits expense with split type
2. Frontend validates with Zod schema
3. Backend resolves splits to exact DECIMAL amounts
4. **Transaction**: Create expense → Create splits → Update ledger balances
5. Return updated group state

### Balance Simplification Algorithm

```
Algorithm: Greedy Settlement Minimization
1. Compute net balance per user (positive = creditor, negative = debtor)
2. Separate into creditors[] and debtors[]
3. Sort each by absolute value (descending)
4. While both non-empty:
   a. Pick max creditor and max debtor
   b. Transfer min(|credit|, |debt|)
   c. Update balances, remove zeros
5. Return transfer list

Time: O(n log n)  |  Space: O(n)
```

**Example:**
```
Before: A owes B $5, B owes C $10, A owes C $3
Net: A=-8, B=+5, C=+3
After simplification: A pays B $5, A pays C $3 (2 transfers instead of 3)
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | React Query, React Hook Form + Zod |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Auth | JWT, bcrypt |
| Testing | Jest |

## 📦 Project Structure

```
├── backend/
│   ├── prisma/
│   │   └── schema.prisma        # Database schema
│   ├── src/
│   │   ├── config/              # App configuration
│   │   ├── middleware/          # Auth, error handling
│   │   ├── modules/
│   │   │   ├── auth/            # Login, register
│   │   │   ├── groups/          # Group CRUD
│   │   │   ├── expenses/        # Expense + splits
│   │   │   └── settlements/     # Balances, settlements
│   │   ├── utils/               # Split calc, simplify
│   │   └── app.ts               # Express entry
│   └── tests/                   # Unit tests
│
└── frontend/
    ├── src/
    │   ├── hooks/               # Auth context
    │   ├── lib/                 # API client, utils
    │   └── pages/               # React pages
    └── index.css                # Tailwind + styles
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Setup

1. **Clone and install dependencies:**
```bash
git clone https://github.com/Sai-vikas-Ambati/Expense-Sharing-Application
cd Expense-Sharing-Application

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

2. **Configure environment:**
```bash
# backend/.env
DATABASE_URL="postgresql://postgres:password@localhost:5432/expense_sharing"
JWT_SECRET="your-secret-key"
PORT=3001
```

3. **Setup database:**
```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
```

4. **Run development servers:**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

5. **Open http://localhost:5173**

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/groups` | List user's groups |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/:id` | Group details |
| POST | `/api/groups/:id/members` | Add member |
| GET | `/api/groups/:id/expenses` | List expenses |
| POST | `/api/groups/:id/expenses` | Create expense |
| DELETE | `/api/groups/:id/expenses/:eid` | Delete expense |
| GET | `/api/groups/:id/balances` | Get balances + settlements |
| POST | `/api/groups/:id/settlements` | Record payment |

## 🧪 Testing

```bash
cd backend
npm test
```

Tests cover:
- Split calculation (Equal, Exact, Percentage)
- Remainder handling
- Balance simplification algorithm
- Circular debt resolution

## 🎨 Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Ledger-based balances** | O(1) lookup vs O(n) recalculation from expenses |
| **DECIMAL(10,2) for money** | Avoid floating point errors |
| **Resolved splits at creation** | Immutable audit trail, no formula ambiguity |
| **Greedy simplification** | Near-optimal for typical group sizes (<20 users) |
| **JWT in localStorage** | Simple for demo; use httpOnly cookies in production |

## 📝 License

MIT
