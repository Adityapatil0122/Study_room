import dotenv from "dotenv";
import path from "path";

dotenv.config();

const requiredEnvVars = ["MYSQL_DATABASE", "JWT_SECRET"];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  mysqlHost: process.env.MYSQL_HOST ?? "localhost",
  mysqlPort: parseInt(process.env.MYSQL_PORT ?? "3306", 10),
  mysqlUser: process.env.MYSQL_USER ?? "root",
  mysqlPassword: process.env.MYSQL_PASSWORD ?? "",
  mysqlDatabase: process.env.MYSQL_DATABASE,
  mysqlSsl: process.env.MYSQL_SSL === "true",
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
