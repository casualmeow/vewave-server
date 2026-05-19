export const hashPassword = async (password: string) =>
  Bun.password.hash(password, {
    algorithm: "argon2id",
  });

export const verifyPassword = async (password: string, passwordHash: string) =>
  Bun.password.verify(password, passwordHash);
