import app from "./app.js";
import { config } from "./config/env.js";
import { initializeDatabase } from "./db/schema.js";
import { logger } from "./utils/logger.js";

await initializeDatabase();

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down...");
  server.close(() => {
    logger.info("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down...");
  server.close(() => {
    logger.info("HTTP server closed");
  });
});
