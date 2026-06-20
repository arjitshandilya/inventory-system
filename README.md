# Stockroom — Inventory & Order Management System

A full-stack, containerized inventory and order management system.

- **Backend:** Python (FastAPI) + SQLAlchemy + PostgreSQL
- **Frontend:** React (Vite) + React Router
- **Containerization:** Docker, multi-stage builds, Docker Compose
- **Deployment target:** Render / Railway / Fly.io (backend) + Vercel / Netlify (frontend)

```
inventory-system/
├── backend/            FastAPI app, Dockerfile, requirements.txt
├── frontend/            React app, Dockerfile, nginx.conf
├── docker-compose.yml    Orchestrates db + backend + frontend
├── .env.example          Root-level compose environment template
└── README.md
```

---

## 1. Quick start (Docker Compose — recommended)

This runs all three services (PostgreSQL, backend, frontend) with one command.

**Prerequisites:** Docker and Docker Compose installed.

```bash
# 1. Clone/unzip the project, then from the project root:
cp .env.example .env

# 2. Edit .env and set a real POSTGRES_PASSWORD (don't leave the default)

# 3. Build and start everything
docker compose up --build
```

Once it's up:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Interactive API docs (Swagger UI): http://localhost:8000/docs
- PostgreSQL: localhost:5432 (only exposed for local debugging — see note below)

To stop:
```bash
docker compose down
```

To stop and **wipe the database volume** (fresh start):
```bash
docker compose down -v
```

### How the pieces fit together

- `db` runs PostgreSQL 16 with a **named volume** (`inventory_system_postgres_data`) so data survives container restarts.
- `backend` waits for `db` to report healthy (via `depends_on: condition: service_healthy`) before starting, and creates tables automatically on first boot.
- `frontend` is built with the backend URL baked in (`VITE_API_URL` build arg) and served via nginx with SPA routing support.
- No credentials are hardcoded anywhere — everything comes from `.env` / environment variables, with safe local-dev defaults in `docker-compose.yml` (`${VAR:-default}` syntax).

---

## 2. Running locally without Docker (for development)

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env — for local dev without Docker, point DATABASE_URL at a
# Postgres instance you have running locally, e.g.:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/inventory_db

uvicorn app.main:app --reload --port 8000
```

The API will be live at http://localhost:8000, with docs at `/docs`.

### Frontend

```bash
cd frontend
npm install

cp .env.example .env
# VITE_API_URL=http://localhost:8000  (already the default)

npm run dev
```

The app will be live at http://localhost:5173.

---

## 3. API Reference

All endpoints return JSON. Validation errors return `422`, not-found returns `404`, conflicts (duplicate SKU/email, insufficient stock) return `409`/`400`.

### Products
| Method | Path | Description |
|---|---|---|
| POST | `/products` | Create a product |
| GET | `/products` | List all products |
| GET | `/products/{id}` | Get one product |
| PUT | `/products/{id}` | Update a product |
| DELETE | `/products/{id}` | Delete a product |

### Customers
| Method | Path | Description |
|---|---|---|
| POST | `/customers` | Create a customer |
| GET | `/customers` | List all customers |
| GET | `/customers/{id}` | Get one customer |
| DELETE | `/customers/{id}` | Delete a customer |

### Orders
| Method | Path | Description |
|---|---|---|
| POST | `/orders` | Create an order (deducts stock automatically) |
| GET | `/orders` | List all orders |
| GET | `/orders/{id}` | Get one order with line items |
| DELETE | `/orders/{id}` | Cancel an order (restocks products) |

### Dashboard
| Method | Path | Description |
|---|---|---|
| GET | `/dashboard/summary` | Totals + low-stock product list |

Full interactive documentation (request/response schemas, try-it-out) is auto-generated at `/docs` (Swagger) and `/redoc` whenever the backend is running.

### Business rules enforced by the backend
- Product SKU is unique (`409` on conflict).
- Customer email is unique and validated (`409` / `422`).
- Stock and price can never go negative (`422` on bad input, DB-level `CHECK` constraint as a second line of defense).
- An order is rejected with `400` and a clear message if **any** line item exceeds available stock — nothing is partially deducted.
- `total_amount` is always computed server-side from current product prices; the client cannot submit a price or total.
- Cancelling an order restores the stock it had reserved.

---

## 4. Docker details

### Backend Dockerfile (`backend/Dockerfile`)
- Multi-stage build: a `builder` stage compiles `psycopg2` against `libpq-dev`, then the runtime stage copies only the resulting virtualenv — no compilers ship in the final image.
- Final image is `python:3.12-slim` with only the runtime `libpq5` library installed.
- Runs as a **non-root user** (`app`).
- Reads `PORT` from the environment (defaults to `8000`) so it works as-is on Render/Railway/Fly, which inject their own port.
- Includes a `HEALTHCHECK` against `/health`.

### Frontend Dockerfile (`frontend/Dockerfile`)
- Stage 1 (`node:20-slim`): installs dependencies with `npm ci` and runs `vite build`. Accepts `VITE_API_URL` as a build arg, since Vite environment variables are resolved at build time, not container start time.
- Stage 2 (`nginx:1.27-alpine`): serves the static `dist/` output. `nginx.conf` includes SPA fallback routing (`try_files ... /index.html`) so React Router's client-side routes work on refresh/deep-link, plus gzip and asset caching.

### Why a build-time API URL matters
Because this is a static React build, `VITE_API_URL` gets compiled into the JS bundle. If you change the backend URL, you must **rebuild** the frontend image with the new `VITE_API_URL` build arg — restarting the container alone won't pick up a new value.

---

## 5. Deployment

### 5a. Backend → Render / Railway / Fly.io

The backend is a standard Dockerized FastAPI service; any of the three works the same way:

**Render**
1. New → Web Service → connect your repo → root directory `backend/`.
2. Render auto-detects the `Dockerfile`. Set environment variables in the dashboard:
   - `DATABASE_URL` — use Render's managed PostgreSQL connection string (or create a Render PostgreSQL instance and copy its internal URL).
   - `CORS_ORIGINS` — your deployed frontend URL, e.g. `https://your-app.vercel.app`.
   - `ENVIRONMENT=production`
   - `LOW_STOCK_THRESHOLD=10`
3. Render sets `PORT` automatically — the Dockerfile already respects it.
4. Deploy. Note the resulting URL (e.g. `https://stockroom-api.onrender.com`).

**Railway**
1. New Project → Deploy from repo → set root directory to `backend/`.
2. Add a PostgreSQL plugin from Railway's marketplace; Railway injects `DATABASE_URL` automatically into linked services (or copy it manually into the backend service's variables).
3. Add `CORS_ORIGINS`, `ENVIRONMENT`, `LOW_STOCK_THRESHOLD` as above.
4. Railway also auto-injects `PORT` — no changes needed.

**Fly.io**
1. `fly launch` from inside `backend/` (it will detect the Dockerfile).
2. `fly postgres create` to provision a Postgres cluster, then `fly postgres attach` to wire `DATABASE_URL` into your app automatically.
3. `fly secrets set CORS_ORIGINS=https://your-frontend-url ENVIRONMENT=production LOW_STOCK_THRESHOLD=10`.
4. `fly deploy`.

In all three cases: **never commit real credentials** — set them via each platform's environment/secrets UI, matching `.env.example`.

### 5b. Frontend → Vercel / Netlify

Both platforms build the Vite app directly (you don't need the Dockerfile for these — it's there for the Compose/self-hosted path). Use the platform's native static-site build instead of the container, since it's simpler and free-tier friendly.

**Vercel**
1. New Project → import your repo → set root directory to `frontend/`.
2. Build command: `npm run build` · Output directory: `dist`.
3. Environment variable: `VITE_API_URL` = your deployed backend URL (e.g. `https://stockroom-api.onrender.com`).
4. Deploy. Vercel gives you a `https://your-app.vercel.app` URL.

**Netlify**
1. New site from Git → root directory `frontend/`.
2. Build command: `npm run build` · Publish directory: `frontend/dist`.
3. Environment variable: `VITE_API_URL` = your deployed backend URL.
4. SPA routing is already handled — `frontend/public/_redirects` (copied into every build) tells Netlify to serve `index.html` for any unmatched path, so client-side routes won't 404 on refresh.

**Vercel** (additional note)
SPA routing is already handled via `frontend/vercel.json`, which rewrites all paths to `index.html` so React Router's client-side routes work on refresh/deep-link.

### 5c. Final connection step

After both are deployed:
1. Go back to your backend's environment variables and set `CORS_ORIGINS` to your **actual** deployed frontend URL (not `localhost`).
2. Redeploy/restart the backend so the new CORS setting takes effect.
3. Confirm in the browser console (Network tab) that requests from the frontend to the backend succeed and aren't blocked by CORS.

---

## 6. Project structure reference

```
backend/
├── app/
│   ├── main.py          FastAPI app, CORS, exception handlers, route registration
│   ├── config.py         Settings loaded from environment variables
│   ├── database.py       SQLAlchemy engine/session
│   ├── models.py         Product, Customer, Order, OrderItem ORM models
│   ├── schemas.py        Pydantic request/response schemas
│   └── routers/
│       ├── products.py
│       ├── customers.py
│       ├── orders.py      Stock validation + atomic deduction logic
│       └── dashboard.py
├── Dockerfile
├── .dockerignore
├── .env.example
└── requirements.txt

frontend/
├── src/
│   ├── api/client.js      Centralized fetch wrapper for all API calls
│   ├── components/        AppLayout, Toast, Modal/Button/Badge primitives, DataTable
│   ├── pages/              DashboardPage, ProductsPage, CustomersPage, OrdersPage
│   ├── styles/              Design tokens + component CSS
│   ├── App.jsx              Router setup
│   └── main.jsx
├── nginx.conf               SPA routing + gzip for the production container
├── Dockerfile
├── .dockerignore
└── .env.example
```

---

## 7. Notes on design decisions

- **Order → OrderItem modeling:** an order can hold multiple line items (one per product), which is the standard relational pattern and still fully satisfies "create an order for a customer and product(s) with a quantity." The UI lets you add one product per order too — multi-item is additive, not required.
- **Cancelling an order restocks inventory.** This wasn't explicitly specified, but a delete that *didn't* restock would permanently and silently shrink available inventory, which would be a worse default for a real operations tool.
- **Price is never trusted from the client.** The backend always reads the current product price at order time and computes the total — this prevents a client from submitting a fabricated total.
- **SQLite was used only for local automated testing during development** (faster iteration without a live Postgres process); the application itself only targets PostgreSQL in `requirements.txt`/`docker-compose.yml`, as required.
