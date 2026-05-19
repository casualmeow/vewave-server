import type { AppEnv } from "../config/env";
import { loadEnv } from "../config/env";
import type {
  MediaSourceRecord,
  NewRefreshSessionRecord,
  NewRoomEventRecord,
  NewUserRecord,
  RefreshSessionRecord,
  RoomEventRecord,
  RoomMemberRecord,
  RoomPlaybackStateRecord,
  RoomRecord,
  UserRecord,
} from "../db/schema";
import type { AuthRepository } from "../modules/auth/auth.repository";
import { AuthService } from "../modules/auth/auth.service";
import { MediaService } from "../modules/media/media.service";
import { RealtimeGateway } from "../modules/realtime/realtime.gateway";
import type { RoomsRepository } from "../modules/rooms/rooms.repository";
import { RoomsService } from "../modules/rooms/rooms.service";
import type {
  CreateRoomRepositoryInput,
  PlaybackUpdateInput,
  RoomRole,
} from "../modules/rooms/rooms.types";
import type { AppServices } from "../services";

export const createTestEnv = (overrides: Partial<AppEnv> = {}): AppEnv => ({
  ...loadEnv({
    NODE_ENV: "test",
    API_PORT: "3001",
    CLIENT_ORIGIN: "http://localhost:3000",
    DATABASE_URL: "postgres://postgres:postgres@localhost:5432/vewave_test",
    JWT_ACCESS_SECRET: "test-access-secret-at-least-thirty-two-characters",
    JWT_REFRESH_SECRET: "test-refresh-secret-at-least-thirty-two-characters",
    ACCESS_TOKEN_TTL: "15m",
    REFRESH_TOKEN_TTL: "30d",
    COOKIE_SECURE: "false",
  }),
  ...overrides,
});

export class InMemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, UserRecord>();
  readonly refreshSessions = new Map<string, RefreshSessionRecord>();

  async createUser(input: NewUserRecord) {
    const user = input as UserRecord;
    this.users.set(user.id, user);
    return user;
  }

  async findUserByEmail(email: string) {
    return (
      Array.from(this.users.values()).find((user) => user.email === email) ??
      null
    );
  }

  async findUserById(id: string) {
    return this.users.get(id) ?? null;
  }

  async createRefreshSession(input: NewRefreshSessionRecord) {
    const session = input as RefreshSessionRecord;
    this.refreshSessions.set(session.id, session);
    return session;
  }

  async findRefreshSessionById(id: string) {
    return this.refreshSessions.get(id) ?? null;
  }

  async revokeRefreshSession(id: string, revokedAt: Date) {
    const session = this.refreshSessions.get(id);
    if (!session) return;
    this.refreshSessions.set(id, { ...session, revokedAt, lastUsedAt: revokedAt });
  }

  async markRefreshSessionUsed(id: string, lastUsedAt: Date) {
    const session = this.refreshSessions.get(id);
    if (!session) return;
    this.refreshSessions.set(id, { ...session, lastUsedAt });
  }
}

export class InMemoryRoomsRepository implements RoomsRepository {
  readonly mediaSources = new Map<string, MediaSourceRecord>();
  readonly rooms = new Map<string, RoomRecord>();
  readonly members = new Map<string, RoomMemberRecord>();
  readonly playbackStates = new Map<string, RoomPlaybackStateRecord>();
  readonly events = new Map<string, RoomEventRecord>();

  async createRoomWithInitialState(input: CreateRoomRepositoryInput) {
    const now = new Date();
    const media: MediaSourceRecord = {
      id: crypto.randomUUID(),
      ownerId: input.ownerId,
      provider: input.parsedMedia.provider,
      originalUrl: input.originalUrl,
      canonicalUrl: input.parsedMedia.canonicalUrl,
      externalId: input.parsedMedia.externalId,
      title: null,
      thumbnailUrl: null,
      embedUrl: input.parsedMedia.embedUrl ?? null,
      providerPayload: null,
      createdAt: now,
      updatedAt: now,
    };
    const room: RoomRecord = {
      id: crypto.randomUUID(),
      code: input.code,
      ownerId: input.ownerId,
      hostUserId: input.ownerId,
      mediaSourceId: media.id,
      title: input.title?.trim() || null,
      visibility: "unlisted",
      status: "active",
      createdAt: now,
      updatedAt: now,
      endedAt: null,
    };
    const member: RoomMemberRecord = {
      id: crypto.randomUUID(),
      roomId: room.id,
      userId: input.ownerId,
      guestName: null,
      role: "owner",
      joinedAt: now,
      leftAt: null,
      lastSeenAt: now,
    };
    const playback: RoomPlaybackStateRecord = {
      roomId: room.id,
      status: "paused",
      positionMs: 0,
      playbackRate: 1,
      version: 0,
      updatedAt: now,
      updatedByMemberId: member.id,
    };

    this.mediaSources.set(media.id, media);
    this.rooms.set(room.id, room);
    this.members.set(member.id, member);
    this.playbackStates.set(room.id, playback);
    await this.insertRoomEvent({
      id: crypto.randomUUID(),
      roomId: room.id,
      actorMemberId: member.id,
      type: "room_created",
      payload: { code: room.code },
      createdAt: now,
    });

    return { room, media, playback, member };
  }

  async findRoomBundleByCode(code: string) {
    const room =
      Array.from(this.rooms.values()).find((item) => item.code === code) ?? null;
    if (!room) return null;

    const media = this.mediaSources.get(room.mediaSourceId);
    const playback = this.playbackStates.get(room.id);
    if (!media || !playback) return null;

    return { room, media, playback };
  }

  async findActiveMemberByUser(roomId: string, userId: string) {
    return (
      Array.from(this.members.values()).find(
        (member) =>
          member.roomId === roomId &&
          member.userId === userId &&
          member.leftAt === null,
      ) ?? null
    );
  }

  async getOrCreateMember(input: {
    roomId: string;
    userId: string;
    role: RoomRole;
  }) {
    const existing = await this.findActiveMemberByUser(
      input.roomId,
      input.userId,
    );
    const now = new Date();

    if (existing) {
      const updated = { ...existing, role: input.role, lastSeenAt: now };
      this.members.set(updated.id, updated);
      return updated;
    }

    const member: RoomMemberRecord = {
      id: crypto.randomUUID(),
      roomId: input.roomId,
      userId: input.userId,
      guestName: null,
      role: input.role,
      joinedAt: now,
      leftAt: null,
      lastSeenAt: now,
    };
    this.members.set(member.id, member);
    return member;
  }

  async markMemberLeft(memberId: string, leftAt: Date) {
    const member = this.members.get(memberId);
    if (!member) return;
    this.members.set(memberId, { ...member, leftAt, lastSeenAt: leftAt });
  }

  async updatePlaybackState(input: PlaybackUpdateInput) {
    const existing = this.playbackStates.get(input.roomId);
    if (!existing) throw new Error("Playback state missing");

    const updated: RoomPlaybackStateRecord = {
      ...existing,
      status: input.status,
      positionMs: input.positionMs,
      playbackRate: input.playbackRate,
      version: input.version,
      updatedAt: input.updatedAt,
      updatedByMemberId: input.updatedByMemberId,
    };

    this.playbackStates.set(input.roomId, updated);
    return updated;
  }

  async insertRoomEvent(input: NewRoomEventRecord) {
    const event = input as RoomEventRecord;
    this.events.set(event.id, event);
  }
}

export const createInMemoryServices = (
  env = createTestEnv(),
): AppServices => {
  const authRepository = new InMemoryAuthRepository();
  const roomsRepository = new InMemoryRoomsRepository();
  const media = new MediaService();
  const auth = new AuthService(env, authRepository);
  const rooms = new RoomsService(roomsRepository, media);

  return {
    auth,
    media,
    rooms,
    realtime: new RealtimeGateway(auth, rooms),
  };
};
