import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import {
  createInMemoryServices,
  createTestEnv,
} from "../../src/testing/in-memory-services";

const env = createTestEnv();

const jsonRequest = (
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    cookie?: string;
  } = {},
) =>
  new Request(`http://localhost${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

const cookieHeader = (response: Response) => {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Missing set-cookie header");
  return setCookie.split(";")[0];
};

describe("Vewave API", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp({
      env,
      services: createInMemoryServices(env),
    });
  });

  const register = async () => {
    const response = await app.handle(
      jsonRequest("/api/auth/register", {
        method: "POST",
        body: {
          name: "Jane Doe",
          email: "jane@example.com",
          password: "strong-password",
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    return {
      body,
      accessToken: body.accessToken as string,
      cookie: cookieHeader(response),
    };
  };

  test("register, login, and me flow", async () => {
    const registered = await register();

    expect(registered.body.user.email).toBe("jane@example.com");

    const meResponse = await app.handle(
      jsonRequest("/api/auth/me", { token: registered.accessToken }),
    );
    expect(meResponse.status).toBe(200);
    expect((await meResponse.json()).user.email).toBe("jane@example.com");

    const loginResponse = await app.handle(
      jsonRequest("/api/auth/login", {
        method: "POST",
        body: {
          email: "jane@example.com",
          password: "strong-password",
        },
      }),
    );
    expect(loginResponse.status).toBe(200);
    expect(typeof (await loginResponse.json()).accessToken).toBe("string");
  });

  test("auth failures return controlled 401 responses", async () => {
    await register();

    const invalidLoginResponse = await app.handle(
      jsonRequest("/api/auth/login", {
        method: "POST",
        body: {
          email: "jane@example.com",
          password: "wrong-password",
        },
      }),
    );
    expect(invalidLoginResponse.status).toBe(401);
    expect((await invalidLoginResponse.json()).error.code).toBe(
      "AUTH_INVALID_CREDENTIALS",
    );

    const meResponse = await app.handle(
      jsonRequest("/api/auth/me", { token: "invalid-access-token" }),
    );
    expect(meResponse.status).toBe(401);
    expect((await meResponse.json()).error.code).toBe("AUTH_UNAUTHORIZED");

    const refreshResponse = await app.handle(
      jsonRequest("/api/auth/refresh", { method: "POST" }),
    );
    expect(refreshResponse.status).toBe(401);
    expect((await refreshResponse.json()).error.code).toBe(
      "AUTH_REFRESH_EXPIRED",
    );
  });

  test("refresh rotates session and logout revokes the refresh cookie", async () => {
    const registered = await register();

    const refreshResponse = await app.handle(
      jsonRequest("/api/auth/refresh", {
        method: "POST",
        cookie: registered.cookie,
      }),
    );
    expect(refreshResponse.status).toBe(200);
    expect(typeof (await refreshResponse.json()).accessToken).toBe("string");
    const rotatedCookie = cookieHeader(refreshResponse);

    const logoutResponse = await app.handle(
      jsonRequest("/api/auth/logout", {
        method: "POST",
        cookie: rotatedCookie,
      }),
    );
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("set-cookie")).toContain("Max-Age=0");

    const revokedRefreshResponse = await app.handle(
      jsonRequest("/api/auth/refresh", {
        method: "POST",
        cookie: rotatedCookie,
      }),
    );
    expect(revokedRefreshResponse.status).toBe(401);
  });

  test("creates a room from a valid YouTube URL and returns snapshot", async () => {
    const registered = await register();

    const createResponse = await app.handle(
      jsonRequest("/api/rooms", {
        method: "POST",
        token: registered.accessToken,
        body: {
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          title: "Friday room",
        },
      }),
    );
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json();

    expect(typeof created.room.code).toBe("string");
    expect(created.media.provider).toBe("youtube");
    expect(created.playback.status).toBe("paused");

    const snapshotResponse = await app.handle(
      jsonRequest(`/api/rooms/${created.room.code}`, {
        token: registered.accessToken,
      }),
    );
    expect(snapshotResponse.status).toBe(200);

    const snapshot = await snapshotResponse.json();
    expect(snapshot.room.code).toBe(created.room.code);
    expect(snapshot.permissions.canControlPlayback).toBe(true);
  });

  test("rejects room creation from unsupported URLs", async () => {
    const registered = await register();

    const response = await app.handle(
      jsonRequest("/api/rooms", {
        method: "POST",
        token: registered.accessToken,
        body: {
          url: "https://example.com/video/1",
        },
      }),
    );

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_MEDIA_URL");
  });
});
