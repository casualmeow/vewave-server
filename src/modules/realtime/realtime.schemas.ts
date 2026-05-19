import { AppError } from "../../shared/errors/app-error";
import type { ConnectedRoomMember } from "./realtime.transport";
import type { RoomSnapshotResponse } from "../rooms/rooms.service";
import type { PlaybackCommand } from "../rooms/rooms.types";

export type ClientRoomEvent =
  | {
      type: "room.ping";
      requestId?: string;
      payload?: Record<string, never>;
    }
  | {
      type: "playback.command";
      requestId?: string;
      payload: PlaybackCommand;
    }
  | {
      type: "playback.rate.change";
      requestId?: string;
      payload: { playbackRate: number; positionMs?: number };
    };

export type RealtimeErrorPayload = {
  code?: string;
  message: string;
  details?: unknown;
};

export type RoomSnapshotEventPayload = RoomSnapshotResponse & {
  presence: {
    members: ConnectedRoomMember[];
  };
};

export type PresenceJoinedEventPayload = {
  member: ConnectedRoomMember;
  members: ConnectedRoomMember[];
};

export type PresenceLeftEventPayload = {
  connectionId: string;
  memberId: string | null;
  userId: string | null;
  members: ConnectedRoomMember[];
};

export type ServerRoomEvent =
  | {
      type: "room.snapshot";
      eventId: string;
      roomCode: string;
      requestId?: string;
      payload: RoomSnapshotEventPayload;
    }
  | {
      type: "room.pong";
      eventId: string;
      roomCode: string;
      requestId?: string;
      payload: { serverTimeMs: number };
    }
  | {
      type: "presence.member.joined";
      eventId: string;
      roomCode: string;
      requestId?: string;
      payload: PresenceJoinedEventPayload;
    }
  | {
      type: "presence.member.left";
      eventId: string;
      roomCode: string;
      requestId?: string;
      payload: PresenceLeftEventPayload;
    }
  | {
      type: "playback.state";
      eventId: string;
      roomCode: string;
      requestId?: string;
      payload: RoomSnapshotResponse["playback"];
    }
  | {
      type: "command.rejected";
      eventId: string;
      roomCode: string;
      requestId?: string;
      payload: RealtimeErrorPayload;
    }
  | {
      type: "error";
      eventId: string;
      roomCode: string;
      requestId?: string;
      payload: RealtimeErrorPayload;
    };

type ServerRoomEventInput = {
  [Event in ServerRoomEvent as Event["type"]]: Omit<Event, "eventId">;
}[ServerRoomEvent["type"]];

export type ServerRoomEventType = ServerRoomEvent["type"];

type ServerRoomEventBase = {
  type: ServerRoomEventType;
  eventId: string;
  roomCode: string;
  requestId?: string;
  payload: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseRawMessage = (message: unknown) => {
  if (typeof message === "string") return JSON.parse(message);
  if (message instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(message));
  }
  if (ArrayBuffer.isView(message)) {
    return JSON.parse(new TextDecoder().decode(message));
  }

  return message;
};

const parsePlaybackCommand = (payload: unknown): PlaybackCommand => {
  if (!isRecord(payload)) {
    throw new AppError("VALIDATION_ERROR", "Event payload must be an object.", 400);
  }

  const action = payload.action;
  if (
    action !== "play" &&
    action !== "pause" &&
    action !== "seek" &&
    action !== "set_rate"
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Unsupported playback command action.",
      400,
    );
  }

  const positionMs = payload.positionMs;
  const playbackRate = payload.playbackRate;

  if (
    positionMs !== undefined &&
    (typeof positionMs !== "number" || positionMs < 0)
  ) {
    throw new AppError("VALIDATION_ERROR", "positionMs must be a number.", 400);
  }

  if (
    playbackRate !== undefined &&
    (typeof playbackRate !== "number" || playbackRate < 0.25 || playbackRate > 2)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "playbackRate must be between 0.25 and 2.",
      400,
    );
  }

  return {
    action,
    ...(positionMs === undefined ? {} : { positionMs }),
    ...(playbackRate === undefined ? {} : { playbackRate }),
  };
};

export const parseClientRoomEvent = (message: unknown): ClientRoomEvent => {
  let event: unknown;

  try {
    event = parseRawMessage(message);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Message must be valid JSON.", 400);
  }

  if (!isRecord(event) || typeof event.type !== "string") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Realtime event must include a type.",
      400,
    );
  }

  const requestId =
    typeof event.requestId === "string" ? event.requestId : undefined;

  if (event.type === "room.ping") {
    return { type: "room.ping", requestId };
  }

  if (event.type === "playback.command") {
    return {
      type: "playback.command",
      requestId,
      payload: parsePlaybackCommand(event.payload),
    };
  }

  if (event.type === "playback.rate.change") {
    const payload = parsePlaybackCommand({
      ...(isRecord(event.payload) ? event.payload : {}),
      action: "set_rate",
    });

    return {
      type: "playback.rate.change",
      requestId,
      payload: {
        playbackRate: payload.playbackRate ?? 1,
        ...(payload.positionMs === undefined ? {} : { positionMs: payload.positionMs }),
      },
    };
  }

  throw new AppError("VALIDATION_ERROR", "Unsupported realtime event type.", 400);
};

export const createServerEvent = (
  input: ServerRoomEventInput,
): ServerRoomEvent =>
  ({
  eventId: crypto.randomUUID(),
  ...input,
}) as ServerRoomEvent;
