import type { AppEnv } from "./config/env";
import { createDbClient } from "./db/client";
import { DrizzleAuthRepository } from "./modules/auth/auth.repository";
import { AuthService } from "./modules/auth/auth.service";
import { MediaService } from "./modules/media/media.service";
import { RealtimeGateway } from "./modules/realtime/realtime.gateway";
import { DrizzleRoomsRepository } from "./modules/rooms/rooms.repository";
import { RoomsService } from "./modules/rooms/rooms.service";

export type AppServices = {
  auth: AuthService;
  media: MediaService;
  rooms: RoomsService;
  realtime: RealtimeGateway;
};

export const createProductionServices = (env: AppEnv): AppServices => {
  const { db } = createDbClient(env.databaseUrl);
  const authRepository = new DrizzleAuthRepository(db);
  const media = new MediaService();
  const roomsRepository = new DrizzleRoomsRepository(db);

  const auth = new AuthService(env, authRepository);
  const rooms = new RoomsService(roomsRepository, media);

  return {
    auth,
    media,
    rooms,
    realtime: new RealtimeGateway(auth, rooms),
  };
};
