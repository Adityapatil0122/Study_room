import dotenv from "dotenv";
import path from "path";

dotenv.config();

const requiredEnvVars = ["PG_DATABASE", "JWT_SECRET"];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  pgHost: process.env.PG_HOST ?? "localhost",
  pgPort: parseInt(process.env.PG_PORT ?? "5432", 10),
  pgUser: process.env.PG_USER ?? "postgres",
  pgPassword: process.env.PG_PASSWORD ?? "",
  pgDatabase: process.env.PG_DATABASE,
  pgSsl: process.env.PG_SSL === "true",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  studentJwtExpiresIn: process.env.STUDENT_JWT_EXPIRES_IN ?? "30d",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  logLevel: process.env.LOG_LEVEL ?? "info",
  appUrl: process.env.APP_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? "4000"}`,
  webAppUrl: process.env.WEB_APP_URL ?? "http://localhost:5173",
  uploadsDir:
    process.env.UPLOADS_DIR ??
    path.resolve(process.cwd(), "uploads"),
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? "",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
  seedAdminName: process.env.SEED_ADMIN_NAME ?? "Workspace Admin",
};
