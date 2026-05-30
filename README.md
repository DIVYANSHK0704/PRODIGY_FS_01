# 🔐 SecureAuth — MERN Stack Authentication App

A production-ready full-stack authentication system built with MongoDB, Express, React, and Node.js.

## ✨ Features

### Backend
- **JWT Authentication** — Stateless token-based auth with 7-day expiry
- **Password Hashing** — bcrypt with salt rounds of 12
- **Role-Based Access Control** — `user` and `admin` roles
- **Rate Limiting** — Global (100/15min) and auth-specific (10/15min) limits
- **Input Validation** — express-validator on all auth routes
- **Security Headers** — helmet middleware
- **Error Handling** — Centralized error handler with Mongoose error parsing
- **Login Tracking** — Records login count and last login timestamp

### Frontend
- **React 18** with functional components and Hooks
- **React Router v6** — Protected and public routes
- **Auth Context** — Global state management with `useContext`
- **Axios Interceptors** — Auto-attach token + handle 401s globally
- **Password Strength Meter** — Real-time strength indicator
- **Toast Notifications** — react-hot-toast
- **Responsive Design** — Mobile-first dark UI
- **Profile Editing** — Update display name from dashboard
- **Admin Panel** — View all users (admin-only)

## 🗂️ Project Structure

```
auth-app/
├── server/
│   ├── controllers/
│   │   └── authController.js   # Register, login, getMe
│   ├── middleware/
│   │   ├── auth.js             # JWT protect + requireRole
│   │   └── errorHandler.js     # Global error handler
│   ├── models/
│   │   └── User.js             # Mongoose user schema
│   ├── routes/
│   │   ├── auth.js             # /api/auth/*
│   │   └── user.js             # /api/user/*
│   ├── .env.example
│   ├── index.js                # Entry point
│   └── package.json
│
├── client/
│   ├── public/index.html
│   └── src/
│       ├── components/
│       │   └── ProtectedRoute.js
│       ├── context/
│       │   └── AuthContext.js
│       ├── pages/
│       │   ├── Login.js
│       │   ├── Register.js
│       │   ├── Dashboard.js
│       │   └── Admin.js
│       ├── utils/
│       │   └── api.js          # Axios instance + API helpers
│       ├── App.js
│       ├── App.css
│       └── index.js
│
└── package.json                # Root scripts with concurrently
```

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or MongoDB Atlas)

### 1. Clone & Install

```bash
# Install all dependencies (root, server, client)
npm run install-all

# Also install concurrently at root
npm install
```

### 2. Configure Environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/authapp
JWT_SECRET=your_super_secret_key_here   # change this!
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

### 3. Run Development

```bash
# From root — runs both server and client concurrently
npm run dev

# Or separately:
npm run server    # Backend on :5000
npm run client    # Frontend on :3000
```

### 4. Build for Production

```bash
npm run build
```

## 🔌 API Endpoints

### Auth Routes (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user (🔒) |

### User Routes (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/dashboard` | Dashboard data (🔒 user) |
| PUT | `/api/user/profile` | Update profile (🔒 user) |
| GET | `/api/user/admin` | All users (🔒 admin only) |

### Request Format

**Register:**
```json
{ "name": "John Doe", "email": "john@example.com", "password": "pass123" }
```

**Login:**
```json
{ "email": "john@example.com", "password": "pass123" }
```

**Auth Header:**
```
Authorization: Bearer <token>
```

## 🛡️ Security Checklist

- ✅ Passwords hashed with bcrypt (salt=12)
- ✅ JWT signed with secret, expires in 7 days
- ✅ Password field excluded from all DB queries by default
- ✅ Rate limiting on auth routes (10 req/15min)
- ✅ Input validation and sanitization
- ✅ CORS configured to allowed origins only
- ✅ Security headers via Helmet
- ✅ Role-based route protection

## 🔧 Creating an Admin User

Use MongoDB shell or Compass to set a user's role:

```javascript
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "admin" } }
)
```

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Axios |
| Backend | Node.js, Express 4 |
| Database | MongoDB, Mongoose |
| Auth | JWT, bcryptjs |
| Security | Helmet, express-rate-limit, express-validator |
| Dev | concurrently, nodemon |
