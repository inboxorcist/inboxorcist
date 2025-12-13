import { Hono } from "hono";
import { cors } from "hono/cors";
import { dbType, checkDatabaseHealth } from "./db";
import oauthRoutes from "./routes/oauth";
import gmailRoutes from "./routes/gmail";
import explorerRoutes from "./routes/explorer";
import { initializeQueue, getQueueStatus, closeQueue } from "./services/queue";
import { registerSyncWorker, resumeInterruptedJobs } from "./services/sync";

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

// Root endpoint
app.get("/", (c) =>
  c.json({
    name: "Inboxorcist API",
    message: "The power of delete compels you",
  })
);

// Health check
app.get("/api/health", async (c) => {
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

// OAuth routes
app.route("/oauth", oauthRoutes);

// Gmail routes
app.route("/api/gmail", gmailRoutes);

// Explorer routes
app.route("/api/explorer", explorerRoutes);

export default {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
  fetch: app.fetch,
};
