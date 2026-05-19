import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DbClientOptions = {
  max?: number;
};

export const createDbClient = (
  databaseUrl: string,
  options: DbClientOptions = {},
) => {
  const client = postgres(databaseUrl, {
    max: options.max ?? 10,
    prepare: false,
  });
  const db = drizzle(client, { schema });

  return { client, db };
};

export type Database = ReturnType<typeof createDbClient>["db"];
