# Study Room Management System

A full-stack study room management project for handling students, seats, payments, plans, expenses, settings, reports, and admin access.

The repository contains three apps:

- `abhyasika-dashboard-server` - Node.js/Express API backed by MySQL.
- `abhyasika-dashboard` - React/Vite web dashboard for admins.
- `abhyasika-mobile` - Expo/React Native mobile app.

## Features

- Admin authentication with JWT sessions.
- Student admission and profile management.
- Seat allocation and availability tracking.
- Fee plans, payments, renewals, and reports.
- Expense and category management.
- CSV/XLSX import flow for bulk data.
- Role-based admin permissions.
- Logo and workspace settings.
- Mobile dashboard summary for active students, seats, revenue, and renewals.

## Prerequisites

- Node.js 18.17 or newer.
- npm.
- MySQL running locally or on a reachable server.

## Environment Setup

Each app uses its own `.env` file. Copy the example files before running:

```bash
cp abhyasika-dashboard-server/.env.example abhyasika-dashboard-server/.env
cp abhyasika-dashboard/.env.example abhyasika-dashboard/.env
cp abhyasika-mobile/.env.example abhyasika-mobile/.env
```

For Windows PowerShell:

```powershell
Copy-Item abhyasika-dashboard-server/.env.example abhyasika-dashboard-server/.env
Copy-Item abhyasika-dashboard/.env.example abhyasika-dashboard/.env
Copy-Item abhyasika-mobile/.env.example abhyasika-mobile/.env
```

Update the backend `.env` with your MySQL details:

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=abhyasika
JWT_SECRET=replace-with-strong-random-secret-key
PORT=4000
```

## Install Dependencies

Run install in each app directory:

```bash
cd abhyasika-dashboard-server
npm install

cd ../abhyasika-dashboard
npm install

cd ../abhyasika-mobile
npm install
```

## Run Locally

Start the backend first:

```bash
cd abhyasika-dashboard-server
npm run dev
```

The API runs at:

```text
http://localhost:4000
```

Start the web dashboard:

```bash
cd abhyasika-dashboard
npm run dev
```

The dashboard runs at:

```text
http://localhost:5173
```

Start the mobile app:

```bash
cd abhyasika-mobile
npm start
```

Use Expo Go, an Android emulator, or the Expo web option.

## Health Check

After starting the backend, confirm it is running:

```text
http://localhost:4000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

## Useful Commands

Dashboard:

```bash
npm run lint
npm run build
```

Server:

```bash
npm start
```

Mobile:

```bash
npx expo install --check
npx expo export --platform web
```

## Project Structure

```text
.
├── abhyasika-dashboard-server
│   └── src
│       ├── controllers
│       ├── db
│       ├── middleware
│       ├── routes
│       ├── services
│       └── utils
├── abhyasika-dashboard
│   └── src
│       ├── components
│       ├── context
│       ├── lib
│       └── views
└── abhyasika-mobile
    ├── app
    ├── context
    └── lib
```

## Notes

- Do not commit real `.env` files.
- The backend creates required MySQL tables during startup.
- If backend startup fails with `ECONNREFUSED 127.0.0.1:3306`, start MySQL/XAMPP first and try again.
- Generated folders such as `node_modules` and `dist` are ignored.
