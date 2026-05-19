import { t } from "elysia";
import { apiErrorCodes } from "../errors/app-error";

export const apiErrorSchema = t.Object({
  error: t.Object({
    code: t.Union(apiErrorCodes.map((code) => t.Literal(code))),
    message: t.String(),
    details: t.Optional(t.Unknown()),
  }),
});

export const isoDateSchema = t.String({
  format: "date-time",
  examples: ["2026-05-19T12:00:00.000Z"],
});
