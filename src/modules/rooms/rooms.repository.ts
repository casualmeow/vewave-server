import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  mediaSources,
  roomEvents,
  roomMembers,
  roomPlaybackStates,
  rooms,
  type NewRoomEventRecord,
  type RoomMemberRecord,
  type RoomPlaybackStateRecord,
} from "../../db/schema";
import type {
  CreateRoomRepositoryInput,
  PlaybackUpdateInput,
  RoomBundle as RoomBundleType,
  RoomRole,
} from "./rooms.types";

export type RoomsRepository = {
  createRoomWithInitialState(
    input: CreateRoomRepositoryInput,
  ): Promise<RoomBundleType & { member: RoomMemberRecord }>;
  findRoomBundleByCode(code: string): Promise<RoomBundleType | null>;
  findActiveMemberByUser(
    roomId: string,
    userId: string,
  ): Promise<RoomMemberRecord | null>;
  getOrCreateMember(input: {
    roomId: string;
    userId: string;
    role: RoomRole;
  }): Promise<RoomMemberRecord>;
  markMemberLeft(memberId: string, leftAt: Date): Promise<void>;
  updatePlaybackState(
    input: PlaybackUpdateInput,
  ): Promise<RoomPlaybackStateRecord>;
  insertRoomEvent(input: NewRoomEventRecord): Promise<void>;
};

export class DrizzleRoomsRepository implements RoomsRepository {
  constructor(private readonly db: Database) {}

  async createRoomWithInitialState(input: CreateRoomRepositoryInput) {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [media] = await tx
        .insert(mediaSources)
        .values({
          id: crypto.randomUUID(),
          ownerId: input.ownerId,
          provider: input.parsedMedia.provider,
          originalUrl: input.originalUrl,
          canonicalUrl: input.parsedMedia.canonicalUrl,
          externalId: input.parsedMedia.externalId,
          embedUrl: input.parsedMedia.embedUrl ?? null,
          title: null,
          thumbnailUrl: null,
          providerPayload: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const [room] = await tx
        .insert(rooms)
        .values({
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
        })
        .returning();

      const [member] = await tx
        .insert(roomMembers)
        .values({
          id: crypto.randomUUID(),
          roomId: room.id,
          userId: input.ownerId,
          guestName: null,
          role: "owner",
          joinedAt: now,
          leftAt: null,
          lastSeenAt: now,
        })
        .returning();

      const [playback] = await tx
        .insert(roomPlaybackStates)
        .values({
          roomId: room.id,
          status: "paused",
          positionMs: 0,
          playbackRate: 1,
          version: 0,
          updatedAt: now,
          updatedByMemberId: member.id,
        })
        .returning();

      await tx.insert(roomEvents).values({
        id: crypto.randomUUID(),
        roomId: room.id,
        actorMemberId: member.id,
        type: "room_created",
        payload: { code: room.code },
        createdAt: now,
      });

      return { room, media, playback, member };
    });
  }

  async findRoomBundleByCode(code: string) {
    const [row] = await this.db
      .select({
        room: rooms,
        media: mediaSources,
        playback: roomPlaybackStates,
      })
      .from(rooms)
      .innerJoin(mediaSources, eq(rooms.mediaSourceId, mediaSources.id))
      .innerJoin(roomPlaybackStates, eq(roomPlaybackStates.roomId, rooms.id))
      .where(eq(rooms.code, code))
      .limit(1);

    return row ?? null;
  }

  async findActiveMemberByUser(roomId: string, userId: string) {
    const [member] = await this.db
      .select()
      .from(roomMembers)
      .where(
        and(
          eq(roomMembers.roomId, roomId),
          eq(roomMembers.userId, userId),
          isNull(roomMembers.leftAt),
        ),
      )
      .limit(1);

    return member ?? null;
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
      const [updated] = await this.db
        .update(roomMembers)
        .set({ lastSeenAt: now, role: input.role })
        .where(eq(roomMembers.id, existing.id))
        .returning();

      return updated;
    }

    const [member] = await this.db
      .insert(roomMembers)
      .values({
        id: crypto.randomUUID(),
        roomId: input.roomId,
        userId: input.userId,
        guestName: null,
        role: input.role,
        joinedAt: now,
        leftAt: null,
        lastSeenAt: now,
      })
      .returning();

    return member;
  }

  async markMemberLeft(memberId: string, leftAt: Date) {
    await this.db
      .update(roomMembers)
      .set({ leftAt, lastSeenAt: leftAt })
      .where(eq(roomMembers.id, memberId));
  }

  async updatePlaybackState(input: PlaybackUpdateInput) {
    const [state] = await this.db
      .update(roomPlaybackStates)
      .set({
        status: input.status,
        positionMs: input.positionMs,
        playbackRate: input.playbackRate,
        version: input.version,
        updatedAt: input.updatedAt,
        updatedByMemberId: input.updatedByMemberId,
      })
      .where(eq(roomPlaybackStates.roomId, input.roomId))
      .returning();

    return state;
  }

  async insertRoomEvent(input: NewRoomEventRecord) {
    await this.db.insert(roomEvents).values(input);
  }
}
