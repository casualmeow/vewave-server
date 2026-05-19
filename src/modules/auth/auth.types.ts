export type PublicUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthSessionResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};
