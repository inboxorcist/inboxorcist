import { Hono } from "hono";
import { cors } from "hono/cors";
import { dbType, checkDatabaseHealth } from "./db";
import oauthRoutes from "./routes/oauth";

const app = new Hono();

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
  return c.json({
    status: dbHealthy ? "possessed" : "exorcised",
    database: {
      type: dbType,
      connected: dbHealthy,
    },
  });
});

// OAuth routes
app.route("/oauth", oauthRoutes);

export default {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
  fetch: app.fetch,
};
