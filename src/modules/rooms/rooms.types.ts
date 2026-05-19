import type {
  MediaSourceRecord,
  RoomMemberRecord,
  RoomPlaybackStateRecord,
  RoomRecord,
} from "../../db/schema";
import type { ParsedMediaSource } from "../media/providers";

export type RoomRole = "owner" | "host" | "viewer";
export type PlaybackStatus = "playing" | "paused" | "buffering" | "ended";
export type RoomStatus = "active" | "ended";
export type RoomVisibility = "private" | "unlisted" | "public";

export type RoomBundle = {
  room: RoomRecord;
  media: MediaSourceRecord;
  playback: RoomPlaybackStateRecord;
};

export type RoomBundleWithMember = RoomBundle & {
  member: RoomMemberRecord | null;
};

export type CreateRoomRepositoryInput = {
  ownerId: string;
  code: string;
  title?: string;
  originalUrl: string;
  parsedMedia: ParsedMediaSource;
};

export type PlaybackCommandAction = "play" | "pause" | "seek" | "set_rate";

export type PlaybackCommand = {
  action: PlaybackCommandAction;
  positionMs?: number;
  playbackRate?: number;
};

export type PlaybackUpdateInput = {
  roomId: string;
  status: PlaybackStatus;
  positionMs: number;
  playbackRate: number;
  version: number;
  updatedAt: Date;
  updatedByMemberId: string;
};
