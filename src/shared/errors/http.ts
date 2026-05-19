import { AppError, toErrorEnvelope } from "./app-error";

type ElysiaErrorContext = {
  code: unknown;
  error: unknown;
  set: {
    status?: number | string;
  };
};

const getValidationMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "The request did not match the expected schema.";
};

export const handleHttpError = ({ code, error, set }: ElysiaErrorContext) => {
  if (error instanceof AppError) {
    set.status = error.statusCode;
    return toErrorEnvelope(error);
  }

  if (code === "VALIDATION") {
    set.status = 400;
    return toErrorEnvelope(
      new AppError(
        "VALIDATION_ERROR",
        "The request did not match the expected schema.",
        400,
        { reason: getValidationMessage(error) },
      ),
    );
  }

  set.status = 500;
  return toErrorEnvelope(
    new AppError(
      "INTERNAL_SERVER_ERROR",
      "An unexpected server error occurred.",
      500,
    ),
  );
};
