import app from "./app.js";
import { config } from "./config/env.js";
import { initializeDatabase } from "./db/schema.js";
import { logger } from "./utils/logger.js";

let server;

function getStartupHelp(error) {
  if (error?.code === "ECONNREFUSED") {
    return [
      `Could not connect to PostgreSQL at ${config.pgHost}:${config.pgPort}.`,
      "Start your PostgreSQL service before running the API.",
      "On Windows, start the postgresql-x64 service from Services, or launch it via pgAdmin.",
      `Also make sure the database "${config.pgDatabase}" exists and that the credentials in .env match your local Postgres setup.`,
    ].join(" ");
  }

  if (error?.code === "28P01") {
    return [
      `Postgres rejected the credentials for user "${config.pgUser}".`,
      "Check PG_USER and PG_PASSWORD in your .env file.",
    ].join(" ");
  }

  if (error?.code === "3D000") {
    return [
      `Postgres database "${config.pgDatabase}" does not exist.`,
      "Create it in pgAdmin (or via psql: CREATE DATABASE study_room;) and try again.",
    ].join(" ");
  }

  if (error?.code === "EADDRINUSE") {
    return [
      `Port ${config.port} is already in use.`,
      "Another backend instance is probably already running.",
      "Stop the existing process or change PORT in .env before starting a new one.",
    ].join(" ");
  }

  return error?.message ?? "Unknown startup error";
}

try {
  await initializeDatabase();

  server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`);
  });

  server.on("error", (error) => {
    logger.error({ err: error }, getStartupHelp(error));
    process.exit(1);
  });
} catch (error) {
  logger.error({ err: error }, getStartupHelp(error));
  process.exit(1);
}

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down...");
  server?.close(() => {
    logger.info("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down...");
  server?.close(() => {
    logger.info("HTTP server closed");
  });
});
