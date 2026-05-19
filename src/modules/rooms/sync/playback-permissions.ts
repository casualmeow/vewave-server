import type { RoomRole } from "../rooms.types";

export const canMutatePlayback = (role?: RoomRole | null) =>
  role === "owner" || role === "host";
