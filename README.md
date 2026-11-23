# 🔔 Whizle App (Whistlez & Tokens)

> **A real-time token queue management and digital advertising platform for businesses and enterprises.**

Whizle App streamlines business queue operations with real-time token calling, custom sound alerts/ringtones, time slot scheduling, KYC compliance, dynamic advertising campaigns, and superadmin oversight.

---

## 📌 Table of Contents

- [Features](#-features)
  - [Business Admin](#-business-admin)
  - [SuperAdmin Portal](#-superadmin-portal)
  - [Real-Time Displays & Signage](#-real-time-displays--signage)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
  - [4. Database Seeding](#4-database-seeding)
- [Environment Variables](#-environment-variables)
  - [Frontend (`client/.env`)](#frontend-clientenv)
  - [Backend (`server/.env`)](#backend-serverenv)
- [Running the Application](#-running-the-application)
- [API Overview](#-api-overview)
- [Real-Time Socket Events](#-real-time-socket-events)
- [License](#-license)

---

## 🚀 Features

### 🏢 Business Admin
- **Live Queue Management**: Issue tokens, call next token, recall, mark completed, or cancel with instant state updates.
- **Time Slot Management**: Define slot intervals, operational hours, and capacity limits per day.
- **KYC Verification**: Submit business registration documents, certificates, and identity proof for administrative review.
- **Custom Branding**: Upload business logos, banners, and customize theme settings.
- **Analytics & Reports**: Daily/weekly token metrics, average wait times, served counts, and exportable reports.
- **Audio Alerts**: Trigger customized ringtones and audible alerts upon calling tokens.

### 🛡️ SuperAdmin Portal
- **Business Oversight**: Approve/reject businesses, inspect business metrics, and view operational health.
- **KYC Approval Workflow**: Review uploaded business documentation and approve or reject KYC submissions with feedback.
- **Advertising Engine**: Create and schedule video/image ads, target specific displays/businesses, and set ad rotations.
- **Audio & Ringtone Manager**: Upload and manage audio alert files backed by Cloudinary media storage.
- **Trending Topics & Live Ticker**: Broadcast dynamic news, headlines, and announcements to customer-facing displays.
- **User Management**: Manage system administrators, roles, and security policies.

### 📺 Real-Time Displays & Signage
- **Instant Synchronization**: Powered by Socket.io rooms to ensure zero-delay token calls across customer screens and counter desks.
- **Split-Screen Signage**: Displays active calling tokens alongside sponsored advertisements and trending tickers.

---

## 💻 Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/)
- **Routing**: [React Router v6](https://reactrouter.com/)
- **Real-Time Client**: [Socket.io-client](https://socket.io/)
- **HTTP Client**: [Axios](https://axios-http.com/)
- **Styling**: [Bootstrap 5](https://getbootstrap.com/) & [Bootstrap Icons](https://icons.getbootstrap.com/)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) with [Mongoose ODM](https://mongoosejs.com/)
- **Real-Time Engine**: [Socket.io](https://socket.io/)
- **Authentication**: [JSON Web Tokens (JWT)](https://jwt.io/) & [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- **File & Media Storage**: [Cloudinary](https://cloudinary.com/) & [Multer](https://github.com/expressjs/multer)
- **Utilities**: [qrcode](https://github.com/soldair/node-qrcode), [dotenv](https://github.com/motdotla/dotenv)

---

## 📂 Project Structure

```text
whistleapp/
├── client/                     # Frontend React Application
│   ├── public/                 # Static public assets (icons, HTML template)
│   ├── src/
│   │   ├── assets/             # Images and local media
│   │   ├── components/         # Reusable UI components & sidebars
│   │   ├── context/            # React Context (AuthContext, etc.)
│   │   ├── pages/              # Views (Admin, SuperAdmin, Login, Signup)
│   │   │   ├── admin/          # Admin Dashboard, LiveQueue, TimeSlots, KYC
│   │   │   └── superadmin/     # SuperAdmin Dashboards, Ads, Trending, Ringtones
│   │   ├── utils/              # API helpers and utilities
│   │   ├── socket.js           # Socket.io connection handler
│   │   ├── App.js              # Routing and layout structure
│   │   └── index.js            # React application entry point
│   ├── .env.example            # Sample frontend environment config
│   └── package.json
│
├── server/                     # Backend Node/Express API
│   ├── config/                 # Cloudinary and MongoDB connections
│   ├── controllers/            # Route controllers (Auth, Admin, SuperAdmin, Ads)
│   ├── middleware/             # Auth check and file upload middleware
│   ├── models/                 # Mongoose schemas (Business, Token, Ad, User, etc.)
│   ├── routes/                 # API route definitions
│   ├── scripts/                # Database migrations & helper scripts
│   ├── services/               # Background services (Trending engine, etc.)
│   ├── seed.js                 # Database seeder script
│   ├── server.js               # Express application entry point & Socket.io server
│   ├── .env.example            # Sample backend environment config
│   └── package.json
│
├── .gitignore                  # Git ignore rules
├── .env.example                # Root environment reference guide
└── README.md                   # Project documentation
```

---

## ⚙️ Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18.x or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [MongoDB](https://www.mongodb.com/) (Local server or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- A free [Cloudinary](https://cloudinary.com/) account for image, video, and audio hosting

---

## 🏁 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Arungrandhi/whizle-app.git
cd whizle-app
```

---

### 2. Backend Setup

1. Navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create the environment configuration file:
   ```bash
   cp .env.example .env
   ```

4. Open `.env` and fill in your credentials (MongoDB URI, JWT Secret, Cloudinary keys).

---

### 3. Frontend Setup

1. In a new terminal, navigate to the `client` directory:
   ```bash
   cd ../client
   # or from project root: cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create the environment configuration file:
   ```bash
   cp .env.example .env
   ```

4. Open `.env` and set `REACT_APP_API_URL` to your backend server URL (default: `http://localhost:5000`).

---

### 4. Database Seeding

To create an initial SuperAdmin user, run the seed script from the `server` directory:

```bash
cd server
node seed.js
```

**Default SuperAdmin Credentials created:**
- **Email**: `superadmin@whistlez.com`
- **Password**: `SuperAdmin123!`

> ⚠️ **Note**: Change the password immediately after logging in for production deployments.

---

## 🔐 Environment Variables

### Frontend (`client/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `REACT_APP_API_URL` | Base URL of the Express backend & Socket.io server | `http://localhost:5000` |

### Backend (`server/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Port for the Express server to listen on | `5000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` |
| `MONGO_URI` | MongoDB connection URI string | `mongodb://127.0.0.1:27017/whistleapp` |
| `JWT_SECRET` | Secret key used to sign and verify JWT tokens | `your_jwt_secret_key_here` |
| `CLIENT_URL` | Allowed frontend origin for CORS and Socket.io | `http://localhost:3000` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name for media storage | `your_cloudinary_cloud_name` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `your_cloudinary_api_key` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | `your_cloudinary_api_secret` |

---

## 🏃 Running the Application

### Development Mode

Run the backend and frontend in separate terminals:

**Terminal 1 (Backend Server):**
```bash
cd server
npm run dev
```
*Backend runs at [http://localhost:5000](http://localhost:5000)*

**Terminal 2 (Frontend Client):**
```bash
cd client
npm start
```
*Frontend runs at [http://localhost:3000](http://localhost:3000)*

---

### Production Build

To build the React frontend for production:

```bash
cd client
npm run build
```

This creates an optimized, static build in the `client/build` folder, ready for deployment on platforms like Netlify, Vercel, or serving via Nginx / Express.

---

## 📡 API Overview

| Route Prefix | Purpose |
| :--- | :--- |
| `/api/auth` | User authentication, registration wizard, login, and token verification |
| `/api/admin` | Business admin operations: live queue, tokens, time slots, KYC, branding |
| `/api/superadmin` | SuperAdmin oversight: businesses, approvals, KYC, audio alerts, reports |
| `/api/ads` | Ad campaign management, scheduling, media uploads, and impressions |
| `/api/trending` | Trending topics, news feed tickers, and display broadcast engine |
| `/api/public` | Public endpoints for digital display boards and queue view |
| `/api/health` | Health check endpoint (`GET /api/health`) |

---

## 🔄 Real-Time Socket Events

Socket.io enables real-time synchronization between counter operators and digital displays:

- **`joinBusiness(businessId)`**: Joins the room for real-time queue updates of a specific business.
- **`joinSuperAdmin()`**: Joins the administrative broadcast room for platform-wide alerts.
- **`tokenCalled`**: Emitted when a token number is called at a counter.
- **`queueUpdated`**: Emitted when a token is issued, cancelled, completed, or reset.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) (or proprietary to Whizle App).
