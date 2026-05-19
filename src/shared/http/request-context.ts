export type RequestContext = {
  userAgent?: string;
  ipAddress?: string;
};

export const getRequestContext = (request: Request): RequestContext => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  return {
    userAgent: request.headers.get("user-agent") ?? undefined,
    ipAddress: forwardedFor?.split(",")[0]?.trim() || realIp || undefined,
  };
};
