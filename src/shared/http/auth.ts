import { AppError } from "../errors/app-error";

export const getBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader) return null;

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token;
};

export const requireBearerToken = (authorizationHeader?: string) => {
  const token = getBearerToken(authorizationHeader);

  if (!token) {
    throw new AppError("AUTH_UNAUTHORIZED", "Authentication is required.", 401);
  }

  return token;
};
