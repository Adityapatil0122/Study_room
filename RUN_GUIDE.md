# How to Run the Project

This project consists of three parts:
1.  **Backend Server** (Node.js/Express)
2.  **Web Dashboard** (React/Vite)
3.  **Mobile App** (React Native/Expo)

## Prerequisites
-   Node.js installed.
-   PostgreSQL/Supabase project set up.

## 1. Start the Backend
The backend handles API requests and database interactions.

```bash
cd abhyasika-dashboard-server
npm install  # (First time only)
npm run dev
```
*Runs on: `http://localhost:4000`*

## 2. Start the Web Dashboard
The admin dashboard for managing students and seats.

```bash
cd abhyasika-dashboard
npm install  # (First time only)
npm run dev
```
*Runs on: `http://localhost:5173` (or 5174 if port is busy)*

## 3. Start the Mobile App
The mobile application for students/staff.

```bash
cd abhyasika-mobile
npm install  # (First time only)
npx expo start
```
*Runs on: Expo Go (scan QR code) or Android Emulator (press `a`)*

## Environment Variables
Ensure you have `.env` files in all three directories.
-   `abhyasika-dashboard-server/.env`
-   `abhyasika-dashboard/.env`
-   `abhyasika-mobile/.env`
