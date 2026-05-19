type LogLevel = "info" | "warn" | "error";

type LogRecord = Record<string, unknown> & {
  event: string;
};

const write = (level: LogLevel, record: LogRecord) => {
  const payload = {
    level,
    timestamp: new Date().toISOString(),
    ...record,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
};

export const logger = {
  info: (record: LogRecord) => write("info", record),
  warn: (record: LogRecord) => write("warn", record),
  error: (record: LogRecord) => write("error", record),
};

export const sanitizeRequestPath = (request: Request) => {
  const url = new URL(request.url);

  for (const key of Array.from(url.searchParams.keys())) {
    if (key.toLowerCase().includes("token")) {
      url.searchParams.set(key, "[redacted]");
    }
  }

  return `${url.pathname}${url.search}`;
};

export const getErrorLogFields = (error: unknown) => {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      cause:
        error.cause instanceof Error
          ? {
              name: error.cause.name,
              message: error.cause.message,
              stack: error.cause.stack,
            }
          : error.cause,
    };
  }

  return {
    errorName: typeof error,
    errorMessage: String(error),
  };
};
