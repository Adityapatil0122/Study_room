# Abhyasika Dashboard Backend

Express.js API for the Abhyasika study room dashboard.
This version uses MySQL through XAMPP, JWT auth, and local file uploads instead of Supabase.

## Prerequisites

- Node.js 18.17 or newer
- XAMPP with MySQL running
- A MySQL database created for the app, for example `abhyasika`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example`.

3. Update these values:

   - `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
   - `JWT_SECRET`
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`
   - `PORT` if you do not want `4000`

4. Start the server:

   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:4000/api`.

## Authentication

- The server creates or refreshes the seed admin account on startup.
- Clients sign in with `/api/auth/login`.
- Protected routes require `Authorization: Bearer <token>`.

## Notes

- Tables are bootstrapped automatically on startup.
- Uploaded files are stored in `uploads/` and served from `/uploads/...`.
- Public onboarding submissions go to the first owner account in the database.
