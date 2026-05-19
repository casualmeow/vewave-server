import { t } from "elysia";
import { apiErrorSchema } from "../../shared/http/schemas";

export const publicUserSchema = t.Object({
  id: t.String({ format: "uuid" }),
  name: t.String(),
  email: t.String({ format: "email" }),
});

export const registerBodySchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 120, examples: ["Jane Doe"] }),
  email: t.String({ format: "email", examples: ["jane@example.com"] }),
  password: t.String({ minLength: 8, maxLength: 256 }),
});

export const loginBodySchema = t.Object({
  email: t.String({ format: "email", examples: ["jane@example.com"] }),
  password: t.String({ minLength: 1, maxLength: 256 }),
});

export const authResponseSchema = t.Object({
  user: publicUserSchema,
  accessToken: t.String(),
});

export const refreshResponseSchema = t.Object({
  accessToken: t.String(),
});

export const meResponseSchema = t.Object({
  user: publicUserSchema,
});

export const logoutResponseSchema = t.Object({
  ok: t.Boolean(),
});

export const authErrorResponses = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  409: apiErrorSchema,
  500: apiErrorSchema,
};
