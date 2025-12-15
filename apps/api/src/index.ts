import { Hono } from "hono";
import { cors } from "hono/cors";
import { validateEnv } from "./lib/env";
import { dbType, checkDatabaseHealth } from "./db";
import authRoutes from "./routes/auth";
import oauthRoutes from "./routes/oauth";
import gmailRoutes from "./routes/gmail";
import explorerRoutes from "./routes/explorer";
import { initializeQueue, getQueueStatus, closeQueue } from "./services/queue";
import { registerSyncWorker, resumeInterruptedJobs } from "./services/sync";
import { securityHeaders } from "./middleware/security-headers";

// Validate required environment variables before anything else
validateEnv();

const app = new Hono();

// Initialize queue and register workers
const queue = initializeQueue();
registerSyncWorker();
console.log("[App] Queue and workers initialized");

// Resume any interrupted jobs from previous run (async, don't block startup)
resumeInterruptedJobs().catch((error) => {
  console.error("[App] Failed to resume interrupted jobs:", error);
});

// CORS configuration
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
app.use(
  "*",
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);

// Security headers
app.use("*", securityHeaders());

// Root endpoint
app.get("/", (c) =>
  c.json({
    name: "Inboxorcist API",
    message: "The power of delete compels you",
  })
);

// Health check
app.get("/health", async (c) => {
  const dbHealthy = await checkDatabaseHealth();
  const queueStatus = await getQueueStatus();

  return c.json({
    status: dbHealthy ? "possessed" : "exorcised",
    database: {
      type: dbType,
      connected: dbHealthy,
    },
    queue: queueStatus,
  });
});

// Auth routes
app.route("/auth", authRoutes);

// OAuth routes (Gmail account management)
app.route("/oauth", oauthRoutes);

// Gmail routes
app.route("/gmail", gmailRoutes);

// Explorer routes
app.route("/explorer", explorerRoutes);

export default {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
  fetch: app.fetch,
};
