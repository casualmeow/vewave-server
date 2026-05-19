import { migrate } from "drizzle-orm/postgres-js/migrator";
import { loadEnv } from "../config/env";
import { createDbClient } from "./client";

const env = loadEnv();
const { db, client } = createDbClient(env.databaseUrl);

try {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Database migrations applied");
} finally {
  await client.end();
}
