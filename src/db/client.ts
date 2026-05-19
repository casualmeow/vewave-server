import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export const createDbClient = (databaseUrl: string) => {
  const client = postgres(databaseUrl, {
    max: 10,
    prepare: false,
  });
  const db = drizzle(client, { schema });

  return { client, db };
};

export type Database = ReturnType<typeof createDbClient>["db"];
