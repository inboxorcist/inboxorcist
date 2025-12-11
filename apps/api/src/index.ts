import { Hono } from "hono";
import { cors } from "hono/cors";
import { db, dbType, checkDatabaseHealth } from "./db";

const app = new Hono();

app.use("*", cors());

app.get("/", (c) =>
  c.json({
    name: "Inboxorcist API",
    message: "The power of delete compels you",
  })
);

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

export default {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
  fetch: app.fetch,
};
