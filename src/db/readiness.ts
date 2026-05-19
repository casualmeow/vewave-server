import { sql } from "drizzle-orm";
import { createDbClient } from "./client";
import { logger } from "../shared/logging/logger";

const requiredTables = [
  "users",
  "refresh_sessions",
  "media_sources",
  "rooms",
  "room_members",
  "room_playback_states",
  "room_events",
] as const;

export type DbReadinessResult =
  | {
      ok: true;
      missingTables: string[];
    }
  | {
      ok: false;
      missingTables: string[];
      error: {
        name: string;
        message: string;
        cause?: {
          name: string;
          message: string;
        };
      };
    };

const errorSummary = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      cause:
        error.cause instanceof Error
          ? {
              name: error.cause.name,
              message: error.cause.message,
            }
          : undefined,
    };
  }

  return {
    name: typeof error,
    message: String(error),
  };
};

export const checkDatabaseReadiness = async (
  databaseUrl: string,
): Promise<DbReadinessResult> => {
  const { db, client } = createDbClient(databaseUrl, { max: 1 });

  try {
    await db.execute(sql`select 1`);

    const rows = await db.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any(${requiredTables})
    `);
    const existingTables = new Set(rows.map((row) => row.table_name));
    const missingTables = requiredTables.filter(
      (table) => !existingTables.has(table),
    );

    return {
      ok: missingTables.length === 0,
      missingTables: [...missingTables],
      ...(missingTables.length
        ? {
            error: {
              name: "MissingDatabaseTables",
              message:
                "Database is reachable, but one or more required tables are missing. Run migrations.",
            },
          }
        : {}),
    } as DbReadinessResult;
  } catch (error) {
    return {
      ok: false,
      missingTables: [],
      error: errorSummary(error),
    };
  } finally {
    await client.end();
  }
};

export const logDatabaseReadiness = async (databaseUrl: string) => {
  const readiness = await checkDatabaseReadiness(databaseUrl);

  if (readiness.ok) {
    logger.info({
      event: "db.readiness_ok",
      missingTables: readiness.missingTables,
    });
    return readiness;
  }

  logger.warn({
    event: "db.readiness_failed",
    missingTables: readiness.missingTables,
    errorName: readiness.error.name,
    errorMessage: readiness.error.message,
    cause: readiness.error.cause,
  });

  return readiness;
};
