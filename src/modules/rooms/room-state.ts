import type { MediaSourceRecord, RoomMemberRecord, RoomPlaybackStateRecord, RoomRecord } from "../../db/schema";
import type { PublicUser } from "../auth/auth.types";
import type { RoomRole } from "./rooms.types";
import { calculateEffectivePositionMs } from "./sync/playback-clock";
import { canMutatePlayback } from "./sync/playback-permissions";

const serializeDate = (date: Date | null) => (date ? date.toISOString() : null);

export const inferMemberRole = (
  room: Pick<RoomRecord, "ownerId" | "hostUserId">,
  user: PublicUser,
): RoomRole =>
  room.ownerId === user.id ? "owner" : room.hostUserId === user.id ? "host" : "viewer";

export const serializeRoom = (room: RoomRecord) => ({
  id: room.id,
  code: room.code,
  title: room.title,
  visibility: room.visibility,
  status: room.status,
  createdAt: room.createdAt.toISOString(),
  endedAt: serializeDate(room.endedAt),
});

export const serializeMedia = (media: MediaSourceRecord) => ({
  provider: media.provider,
  externalId: media.externalId,
  canonicalUrl: media.canonicalUrl,
  embedUrl: media.embedUrl ?? undefined,
  title: media.title ?? undefined,
  thumbnailUrl: media.thumbnailUrl ?? undefined,
});

export const serializePlayback = (
  playback: RoomPlaybackStateRecord,
  now = new Date(),
) => ({
  status: playback.status,
  positionMs: playback.positionMs,
  effectivePositionMs: calculateEffectivePositionMs(playback, now),
  playbackRate: playback.playbackRate,
  version: playback.version,
  updatedAt: playback.updatedAt.toISOString(),
  serverTimeMs: now.getTime(),
});

export const serializePermissions = (member: RoomMemberRecord | null) => ({
  role: member?.role ?? "viewer",
  canControlPlayback: canMutatePlayback(member?.role),
});
