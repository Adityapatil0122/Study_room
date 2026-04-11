# Abhyasika Dashboard - Frontend

React + Vite frontend for the Abhyasika dashboard.
This build talks to the Express API running on top of MySQL/XAMPP.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example`.

3. Point it to the backend API:

   ```env
   VITE_API_BASE_URL=http://localhost:4000/api
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:5173`.
