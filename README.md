# SafeBox Energy — Inventory Management System

Full-stack web application for solar energy inventory management.
Built with **React + Vite** (frontend) and **Node.js + Express + SQLite** (backend).

---

## Quick start (local development)

```bash
# 1. Clone / unzip the project
cd safebox-energy

# 2. Copy environment file and edit if needed
cp .env.example .env

# 3. Install all dependencies and seed the database
npm run setup

# 4. Start development servers (frontend + backend)
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

### Demo accounts
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@safebox.ng | Admin1234! |
| Admin | admin@safebox.ng | Admin1234! |

---

## Project structure

```
safebox-energy/
├── server/
│   ├── index.js           # Express entry point
│   ├── db/
│   │   ├── schema.sql     # SQLite schema
│   │   ├── seed.js        # Seed script (run once)
│   │   └── index.js       # DB connection
│   ├── middleware/
│   │   ├── auth.js        # JWT authentication
│   │   └── audit.js       # Audit log helper
│   └── routes/
│       ├── auth.js        # Login, invite, accept-invite
│       ├── products.js    # Product catalogue + approvals
│       └── api.js         # All other endpoints
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx        # Router + protected routes
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── components/
│       │   ├── Layout.jsx # Sidebar nav
│       │   └── ui.jsx     # Shared components
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   └── Pages.jsx  # All other pages
│       └── utils/
│           └── api.js     # Fetch wrapper
├── package.json
├── .env.example
└── README.md
```

---

## Production deployment

### Option A — Single server (VPS / EC2 / DigitalOcean)

```bash
# Build the React client
npm run build

# Set production env
cp .env.example .env
# Edit .env: set NODE_ENV=production and a strong JWT_SECRET

# Start server (serves built client + API)
npm start
```

Run with PM2 for auto-restart:
```bash
npm install -g pm2
pm2 start server/index.js --name safebox-ims
pm2 save && pm2 startup
```

Nginx reverse proxy (optional, recommended for SSL):
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Use Certbot for free SSL: `certbot --nginx -d yourdomain.com`

### Option B — Railway / Render (free tier)

1. Push to GitHub
2. Connect repo to Railway or Render
3. Set environment variables:
   - `NODE_ENV=production`
   - `JWT_SECRET=<long random string>`
   - `PORT=3001`
4. Build command: `npm run install:all && node server/db/seed.js && npm run build`
5. Start command: `npm start`

### Option C — Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm run install:all
RUN node server/db/seed.js
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

```bash
docker build -t safebox-ims .
docker run -p 3001:3001 -v $(pwd)/data:/app/server/db safebox-ims
```

---

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | `development` or `production` | `development` |
| `JWT_SECRET` | Secret for JWT signing — **change in production** | (see .env.example) |
| `JWT_EXPIRES_IN` | Token expiry | `8h` |
| `DB_PATH` | SQLite database file path | `./server/db/safebox.db` |
| `CLIENT_URL` | Frontend URL (for CORS in dev) | `http://localhost:5173` |

---

## API endpoints

### Authentication
| Method | Path | Access |
|--------|------|--------|
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/invite` | Super Admin |
| POST | `/api/auth/accept-invite` | Public (with token) |
| GET | `/api/auth/me` | Authenticated |
| POST | `/api/auth/logout` | Authenticated |

### Products
| Method | Path | Access |
|--------|------|--------|
| GET | `/api/products` | Authenticated |
| GET | `/api/products/stock` | Authenticated |
| POST | `/api/products` | Authenticated (Admin→Pending, SA→Approved) |
| PUT | `/api/products/:id` | Authenticated |
| POST | `/api/products/:id/approve` | Super Admin |

### Other endpoints
All under `/api/` — `movements`, `returns`, `projects`, `materials`, `engineers`, `categories`, `users`, `settings`, `dashboard`, `audit`

---

## User roles

| Feature | Admin | Super Admin |
|---------|-------|-------------|
| View all data | ✅ | ✅ |
| Add products | ✅ (Pending) | ✅ (Approved) |
| Log movements | ✅ (Pending) | ✅ (Approved) |
| Approve products & movements | ❌ | ✅ |
| Manage categories | ❌ | ✅ |
| Manage users & invite | ❌ | ✅ |
| View audit trail | ❌ | ✅ |
| Change settings | ❌ | ✅ |

---

## Resetting the database

```bash
rm server/db/safebox.db
node server/db/seed.js
```
