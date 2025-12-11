import { defineConfig } from "drizzle-kit";

const DATABASE_URL = process.env.DATABASE_URL;
const isPostgres = !!DATABASE_URL;

export default defineConfig(
  isPostgres
    ? {
        schema: "./src/db/schema.pg.ts",
        out: "./drizzle/pg",
        dialect: "postgresql",
        dbCredentials: {
          url: DATABASE_URL!,
        },
        verbose: true,
        strict: true,
      }
    : {
        schema: "./src/db/schema.sqlite.ts",
        out: "./drizzle/sqlite",
        dialect: "sqlite",
        dbCredentials: {
          url: process.env.SQLITE_PATH || "../../data/inboxorcist.db",
        },
        verbose: true,
        strict: true,
      }
);
