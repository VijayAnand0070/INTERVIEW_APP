import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import app from "./app.js";
import { assertRequiredEnv, env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { createWebSocketServer } from "./services/websocket.js";
import { startTempCleanup } from "./middleware/upload.js";

assertRequiredEnv();

if (!env.supabaseAnonKey) {
  logger.warn({
    msg: "SUPABASE_ANON_KEY is not set — API auth may fail. Copy VITE_SUPABASE_ANON_KEY from client/.env into server/.env.",
  });
}

await fs.mkdir(path.resolve("uploads"), { recursive: true });

// Socket.IO must register BEFORE Express so /socket.io is not swallowed by Express 404.
const allowedOrigins = (env.clientUrl || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const server = http.createServer();
createWebSocketServer(server, allowedOrigins);

// Socket.IO registers its own request listener — skip those paths in Express.
server.on("request", (req, res) => {
  if (req.url?.startsWith("/socket.io")) return;
  app(req, res);
});

// Start temp file cleanup scheduler
startTempCleanup();

// Start listening
server.listen(env.port, () => {
  logger.info({
    msg: `Pucca Interview API running on http://localhost:${env.port}`,
    port: env.port,
    wsEnabled: true,
    corsOrigins: allowedOrigins,
  });
});
