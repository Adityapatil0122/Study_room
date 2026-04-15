import app from "./app.js";
import { config } from "./config/env.js";
import { initializeDatabase } from "./db/schema.js";
import { logger } from "./utils/logger.js";

let server;

function getStartupHelp(error) {
  if (error?.code === "ECONNREFUSED") {
    return [
      `Could not connect to MySQL at ${config.mysqlHost}:${config.mysqlPort}.`,
      "Start your MySQL service before running the API.",
      "If you use XAMPP, open the XAMPP Control Panel and start MySQL.",
      "If you use the Windows service, start the MySQL80 service from Services or an elevated terminal.",
      "Then verify the credentials in .env match your local MySQL setup.",
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
