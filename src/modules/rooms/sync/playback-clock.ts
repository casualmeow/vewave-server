import type { RoomPlaybackStateRecord } from "../../../db/schema";

export const calculateEffectivePositionMs = (
  state: Pick<
    RoomPlaybackStateRecord,
    "status" | "positionMs" | "playbackRate" | "updatedAt"
  >,
  now = new Date(),
) => {
  if (state.status !== "playing") return Math.max(0, state.positionMs);

  const elapsedMs = now.getTime() - state.updatedAt.getTime();
  return Math.max(
    0,
    Math.round(state.positionMs + elapsedMs * state.playbackRate),
  );
};
