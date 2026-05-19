import { Elysia } from "elysia";
import type { AppEnv } from "../../config/env";
import {
  clearRefreshCookie,
  getRefreshCookie,
  setRefreshCookie,
} from "../../shared/http/cookies";
import { getRequestContext } from "../../shared/http/request-context";
import type { AuthService } from "./auth.service";
import {
  authErrorResponses,
  authResponseSchema,
  loginBodySchema,
  logoutResponseSchema,
  meResponseSchema,
  refreshResponseSchema,
  registerBodySchema,
} from "./auth.schemas";

export const createAuthRoutes = (authService: AuthService, env: AppEnv) =>
  new Elysia({ prefix: "/api/auth" })
    .post(
      "/register",
      async ({ body, cookie, request }) => {
        const result = await authService.register(
          body,
          getRequestContext(request),
        );
        setRefreshCookie(cookie, env, result.refreshToken);

        return {
          user: result.user,
          accessToken: result.accessToken,
        };
      },
      {
        body: registerBodySchema,
        detail: {
          tags: ["Auth"],
          summary: "Register user",
          description:
            "Creates a user, starts a refresh session, and returns an access token.",
        },
        response: {
          200: authResponseSchema,
          ...authErrorResponses,
        },
      },
    )
    .post(
      "/login",
      async ({ body, cookie, request }) => {
        const result = await authService.login(body, getRequestContext(request));
        setRefreshCookie(cookie, env, result.refreshToken);

        return {
          user: result.user,
          accessToken: result.accessToken,
        };
      },
      {
        body: loginBodySchema,
        detail: {
          tags: ["Auth"],
          summary: "Login user",
          description:
            "Authenticates by email and password, rotates the refresh cookie, and returns an access token.",
        },
        response: {
          200: authResponseSchema,
          ...authErrorResponses,
        },
      },
    )
    .post(
      "/refresh",
      async ({ cookie, request }) => {
        const result = await authService.refresh(
          getRefreshCookie(cookie, env),
          getRequestContext(request),
        );
        setRefreshCookie(cookie, env, result.refreshToken);

        return {
          accessToken: result.accessToken,
        };
      },
      {
        detail: {
          tags: ["Auth"],
          summary: "Refresh access token",
          description:
            "Uses the secure HTTP-only refresh cookie, rotates the refresh session, and returns a new access token.",
        },
        response: {
          200: refreshResponseSchema,
          ...authErrorResponses,
        },
      },
    )
    .post(
      "/logout",
      async ({ cookie }) => {
        await authService.logout(getRefreshCookie(cookie, env));
        clearRefreshCookie(cookie, env);

        return { ok: true };
      },
      {
        detail: {
          tags: ["Auth"],
          summary: "Logout",
          description: "Revokes the current refresh session and clears the cookie.",
        },
        response: {
          200: logoutResponseSchema,
          ...authErrorResponses,
        },
      },
    )
    .get(
      "/me",
      async ({ headers }) => ({
        user: await authService.getUserFromAuthorization(headers.authorization),
      }),
      {
        detail: {
          tags: ["Auth"],
          summary: "Current user",
          description: "Returns the user identified by the Bearer access token.",
          security: [{ bearerAuth: [] }],
        },
        response: {
          200: meResponseSchema,
          ...authErrorResponses,
        },
      },
    );
