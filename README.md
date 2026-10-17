# GymLog — Personal Workout Tracker

A secure, fast, mobile-first gym workout tracker built with **React + Vite**, **Express.js**, and **MongoDB Atlas**.

The Home page supports hiding and restoring muscle-group cards without deleting
workout history. Hidden groups are saved per account in the current browser.
Exercise search is debounced, cancels stale requests, filters names and
variations, and briefly caches matching results to avoid repeat API waits.
New workout records require an explicit muscle-group selection.
Workout categories are Chest, Tricep, Back, Bicep, Leg, Shoulder, Core, and
Cardio. Cardio entries track steps and can include an optional additional
exercise and details; strength entries track weight, sets, and reps. The Home
page shows the current streak and a standalone rest timer with one-minute
adjustments. The Account page shows a four-week consistency graph with all
weekday labels. Exercise history includes all records and an all-time chart
range. The timer can play an alert and send a browser notification when it ends.
Browser notifications require permission and are only delivered while GymLog is
open.

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 22.x
- A MongoDB Atlas account (free)
- A Google Cloud project with OAuth credentials (optional for Google sign-in)

---

## 1. MongoDB Atlas Setup

1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com) and sign in.
2. Click **"Build a Database"** → choose **Free (M0)** tier.
3. Select a cloud provider and region close to you → click **Create**.
4. Create a **database user**:
   - Username: something like `gymlog-user`
   - Password: generate a secure password and **save it**
5. Set **Network Access**: click **"Add IP Address"** → **"Allow Access from Anywhere"** (for development). For production, add only your backend server's IP.
6. Click **Connect** → **Connect your application** → copy the connection string.
7. Replace `<password>` in the string with your actual password.
8. Paste the full URI into `server/.env` as `MONGODB_URI=`.

---

## 2. Google OAuth Setup

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com).
2. Create a new project (or select an existing one).
3. Go to **APIs & Services** → **OAuth consent screen**:
   - Choose **External** → fill in app name and your email.
   - Add your email as a test user.
4. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**.
5. Application type: **Web application**.
6. Add **Authorized JavaScript origins**:
   - `http://localhost:5173` (development)
   - `http://127.0.0.1:5173` (development when opening the app at `127.0.0.1`)
   - `https://your-vercel-domain.vercel.app` (production — add after deployment)
7. No redirect URI or client secret is needed for this app's Google Identity Services sign-in button.
8. Click **Create** and copy the **Client ID**.
9. Set that same client ID as `GOOGLE_CLIENT_ID` in `server/.env` and `VITE_GOOGLE_CLIENT_ID` in `client/.env`. The values must match exactly.
10. If the OAuth consent screen is in **Testing** mode, add each Google account you use as a test user.

---

## 3. Server Setup

```bash
cd server
cp .env.example .env     # then fill in your values
npm install
npm run dev              # starts on http://localhost:5000
```

### Server Environment Variables (`server/.env`)

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gymlog
JWT_SECRET=your-64-character-random-secret-here
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
CLIENT_ORIGIN=http://localhost:5173
PORT=5000
NODE_ENV=development
```

**Generate a JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

In development, the API allows HTTP origins on `localhost` and `127.0.0.1` at any
port so Vite can use its next available port if `5173` is already occupied. In
production, only `CLIENT_ORIGIN` and the explicit development origins above are
allowed.

---

## 4. Client Setup

```bash
cd client
cp .env.example .env     # then fill in your Google Client ID
npm install
npm run dev              # starts on http://localhost:5173
```

### Client Environment Variables (`client/.env`)

```env
# Empty = use Vite proxy (recommended for local dev)
VITE_API_URL=
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Keep `VITE_API_URL` empty for local development so Vite proxies `/api` requests
to `http://localhost:5000`. In production, set it to the backend origin only,
for example `https://gym-tracker-api-1824.onrender.com` (not a URL ending in `/api`).
The client adds `/api` to all endpoint paths.

Workouts are stored in MongoDB with the verified account's user ID. On Google sign-in,
the server finds the same account by Google's stable subject ID (or links an existing
account with the same verified email). Returning to the same Google account therefore
loads that account's existing workout history. Keep the same `MONGODB_URI` and
`JWT_SECRET` between runs; do not point the app at a temporary/local database if you
want records to persist across machines and days.

After signing in with Google, set or update an email/password login from the
Account page. Passwords must be at least 8 characters.

Password reset emails use SMTP. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in `server/.env` (or the backend
deployment environment). Reset codes expire after 10 minutes, allow five
verification attempts, and can be re-sent once per minute.

---

## 5. Running Tests

```bash
cd server
npm test
```

---

## 6. Deployment

### Backend → Render (Free)

1. Push your code to a GitHub repository.
2. Go to [https://render.com](https://render.com) → **New Web Service**.
3. Connect your GitHub repo → select the `server/` root directory.
4. Settings:
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
   - **Environment:** Node
5. Add environment variables in Render dashboard:
   - `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, and any SMTP settings from `server/.env`
   - Set `GOOGLE_CLIENT_ID` to the same Google OAuth Client ID used as `VITE_GOOGLE_CLIENT_ID` on the frontend (do not use the placeholder)
   - `CLIENT_ORIGIN=https://your-vercel-domain.vercel.app` (exact frontend origin, no path or trailing slash; the current Render frontend origin is also explicitly allowed)
   - Optionally use `CLIENT_ORIGINS` for multiple comma-separated production origins, such as Vercel preview domains
   - `NODE_ENV=production`
6. Copy your Render service URL (e.g. `https://gymlog-api.onrender.com`).

### Frontend → Vercel (Free)

1. Go to [https://vercel.com](https://vercel.com) → **New Project** → import your GitHub repo.
2. Set **Root Directory** to `client/`.
3. Add environment variables:
   - `VITE_API_URL=https://gymlog-api.onrender.com` (your Render URL)
   - `VITE_GOOGLE_CLIENT_ID=your-google-client-id`
4. Deploy → Vercel gives you a URL like `https://gymlog.vercel.app`.
5. Go back to Google Cloud Console → add this Vercel URL to **Authorized JavaScript origins**.
6. Go to Render → set `CLIENT_ORIGIN` to your Vercel URL (or add it to `CLIENT_ORIGINS`).

---

## Project Structure

```
Gym Tracker/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/     # AddWorkoutSheet, TabBar, ConfirmDialog
│   │   ├── context/        # AuthContext.jsx
│   │   ├── pages/          # Login, Register, Home, MuscleGroup, ExerciseHistory, Account
│   │   ├── services/       # api.js (Axios)
│   │   ├── styles/         # global.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── vite.config.js
│
└── server/                 # Express backend
    ├── config/             # db.js
    ├── controllers/        # authController.js, workoutController.js
    ├── middleware/          # auth.js, errorHandler.js, validate.js
    ├── models/             # User.js, Workout.js
    ├── routes/             # authRoutes.js, workoutRoutes.js
    ├── utils/              # googleVerify.js
    ├── .env.example
    └── server.js
```

---

## API Reference

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Register with name, email, password |
| POST | `/api/auth/login` | Login with email + password |
| POST | `/api/auth/google` | Google OAuth |
| POST | `/api/auth/forgot-password` | Email a one-time password reset code |
| POST | `/api/auth/reset-password` | Reset password with email, code, and new password |
| POST | `/api/auth/password` | Set/update a password for a signed-in Google-linked account |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |

### Workouts
| Method | Route | Description |
|---|---|---|
| GET | `/api/workouts` | List workouts (filterable) |
| POST | `/api/workouts` | Create workout record |
| GET | `/api/workouts/exercises` | Search distinct exercises and their latest logged values |
| GET | `/api/workouts/groups` | Summarize workouts by muscle group |
| GET | `/api/workouts/groups/:group` | List the latest record for each exercise in a muscle group |
| GET | `/api/workouts/history/:name` | Exercise history |
| GET | `/api/workouts/:id` | Get one record |
| PUT | `/api/workouts/:id` | Update one record |
| DELETE | `/api/workouts/:id` | Delete one record |

The `exercise` query parameter on `GET /api/workouts` and `search` on
`GET /api/workouts/exercises` perform a case-insensitive literal substring
search. Workout records include their selected muscle group and optional
variation; exercise history can be filtered with the `variation` query parameter.
