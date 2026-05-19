import { createRoomCode } from "../../shared/ids/room-code";
import { AppError } from "../../shared/errors/app-error";
import type { PublicUser } from "../auth/auth.types";
import type { MediaService } from "../media/media.service";
import type {
  PlaybackCommand,
  PlaybackStatus,
  RoomBundle,
  RoomRole,
} from "./rooms.types";
import type { RoomsRepository } from "./rooms.repository";
import {
  inferMemberRole,
  serializeMedia,
  serializePermissions,
  serializePlayback,
  serializeRoom,
} from "./room-state";
import { calculateEffectivePositionMs } from "./sync/playback-clock";
import { canMutatePlayback } from "./sync/playback-permissions";

type CreateRoomInput = {
  url: string;
  title?: string;
};

export class RoomsService {
  constructor(
    private readonly repository: RoomsRepository,
    private readonly mediaService: MediaService,
  ) {}

  async createRoom(input: CreateRoomInput, user: PublicUser) {
    const parsedMedia = this.mediaService.parseUrl(input.url);
    const bundle = await this.repository.createRoomWithInitialState({
      ownerId: user.id,
      code: createRoomCode(),
      title: input.title,
      originalUrl: input.url,
      parsedMedia,
    });

    return this.toCreateRoomResponse(bundle);
  }

  async getRoomSnapshot(code: string, user: PublicUser | null) {
    const bundle = await this.getRoomBundle(code);
    const member = user
      ? await this.repository.findActiveMemberByUser(bundle.room.id, user.id)
      : null;

    return this.toSnapshotResponse(bundle, member);
  }

  async joinRoom(code: string, user: PublicUser | null) {
    const connection = await this.connectRealtimeRoom(code, user);
    return connection.snapshot;
  }

  async connectRealtimeRoom(code: string, user: PublicUser | null) {
    const bundle = await this.getActiveRoomBundle(code);
    const member = user
      ? await this.repository.getOrCreateMember({
          roomId: bundle.room.id,
          userId: user.id,
          role: inferMemberRole(bundle.room, user),
        })
      : null;

    if (member) {
      await this.repository.insertRoomEvent({
        id: crypto.randomUUID(),
        roomId: bundle.room.id,
        actorMemberId: member.id,
        type: "member_joined",
        payload: { userId: user?.id },
        createdAt: new Date(),
      });
    }

    return {
      roomId: bundle.room.id,
      member,
      snapshot: this.toSnapshotResponse(bundle, member),
    };
  }

  async applyPlaybackCommand(
    code: string,
    user: PublicUser | null,
    command: PlaybackCommand,
  ) {
    if (!user) {
      throw new AppError(
        "PLAYBACK_COMMAND_FORBIDDEN",
        "Authentication is required to control playback.",
        403,
      );
    }

    const bundle = await this.getActiveRoomBundle(code);
    const member = await this.repository.getOrCreateMember({
      roomId: bundle.room.id,
      userId: user.id,
      role: inferMemberRole(bundle.room, user),
    });

    if (!canMutatePlayback(member.role)) {
      throw new AppError(
        "PLAYBACK_COMMAND_FORBIDDEN",
        "Only the room host can control playback.",
        403,
      );
    }

    const now = new Date();
    const currentPosition = calculateEffectivePositionMs(bundle.playback, now);
    const nextPosition = this.resolveCommandPosition(command, currentPosition);
    const nextPlaybackRate = this.resolvePlaybackRate(
      command,
      bundle.playback.playbackRate,
    );
    const nextStatus = this.resolvePlaybackStatus(command, bundle.playback.status);
    const playback = await this.repository.updatePlaybackState({
      roomId: bundle.room.id,
      status: nextStatus,
      positionMs: nextPosition,
      playbackRate: nextPlaybackRate,
      version: bundle.playback.version + 1,
      updatedAt: now,
      updatedByMemberId: member.id,
    });

    await this.repository.insertRoomEvent({
      id: crypto.randomUUID(),
      roomId: bundle.room.id,
      actorMemberId: member.id,
      type: this.eventTypeForCommand(command.action),
      payload: {
        action: command.action,
        positionMs: nextPosition,
        playbackRate: nextPlaybackRate,
        version: playback.version,
      },
      createdAt: now,
    });

    return serializePlayback(playback, now);
  }

  async markMemberLeft(memberId: string, roomId: string) {
    const now = new Date();
    await this.repository.markMemberLeft(memberId, now);
    await this.repository.insertRoomEvent({
      id: crypto.randomUUID(),
      roomId,
      actorMemberId: memberId,
      type: "member_left",
      payload: {},
      createdAt: now,
    });
  }

  private async getRoomBundle(code: string): Promise<RoomBundle> {
    const bundle = await this.repository.findRoomBundleByCode(code);

    if (!bundle) {
      throw new AppError("ROOM_NOT_FOUND", "Room was not found.", 404);
    }

    return bundle;
  }

  private async getActiveRoomBundle(code: string) {
    const bundle = await this.getRoomBundle(code);

    if (bundle.room.status !== "active") {
      throw new AppError("ROOM_NOT_ACTIVE", "Room is no longer active.", 409);
    }

    return bundle;
  }

  private toCreateRoomResponse(bundle: RoomBundle) {
    return {
      room: serializeRoom(bundle.room),
      media: serializeMedia(bundle.media),
      playback: serializePlayback(bundle.playback),
    };
  }

  private toSnapshotResponse(
    bundle: RoomBundle,
    member: Awaited<ReturnType<RoomsRepository["findActiveMemberByUser"]>>,
  ) {
    return {
      room: serializeRoom(bundle.room),
      media: serializeMedia(bundle.media),
      playback: serializePlayback(bundle.playback),
      permissions: serializePermissions(member),
    };
  }

  private resolveCommandPosition(
    command: PlaybackCommand,
    currentPosition: number,
  ) {
    if (command.action === "seek" && command.positionMs === undefined) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Seek commands require positionMs.",
        400,
      );
    }

    return Math.max(0, Math.round(command.positionMs ?? currentPosition));
  }

  private resolvePlaybackRate(command: PlaybackCommand, currentRate: number) {
    const rate = command.playbackRate ?? currentRate;

    if (rate < 0.25 || rate > 2) {
      throw new AppError(
        "VALIDATION_ERROR",
        "playbackRate must be between 0.25 and 2.",
        400,
      );
    }

    return rate;
  }

  private resolvePlaybackStatus(
    command: PlaybackCommand,
    currentStatus: PlaybackStatus,
  ): PlaybackStatus {
    if (command.action === "play") return "playing";
    if (command.action === "pause") return "paused";
    return currentStatus === "ended" ? "paused" : currentStatus;
  }

  private eventTypeForCommand(action: PlaybackCommand["action"]) {
    if (action === "play") return "playback_play";
    if (action === "pause") return "playback_pause";
    if (action === "seek") return "playback_seek";
    return "playback_rate_changed";
  }
}

export type RoomSnapshotResponse = Awaited<
  ReturnType<RoomsService["getRoomSnapshot"]>
>;
