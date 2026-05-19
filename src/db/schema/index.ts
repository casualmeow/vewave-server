import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const mediaProviderEnum = pgEnum("media_provider", [
  "youtube",
  "vimeo",
  "tiktok",
  "unknown",
]);

export const roomVisibilityEnum = pgEnum("room_visibility", [
  "private",
  "unlisted",
  "public",
]);

export const roomStatusEnum = pgEnum("room_status", ["active", "ended"]);

export const roomMemberRoleEnum = pgEnum("room_member_role", [
  "owner",
  "host",
  "viewer",
]);

export const playbackStatusEnum = pgEnum("playback_status", [
  "playing",
  "paused",
  "buffering",
  "ended",
]);

const id = uuid("id").primaryKey();
const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow();

export const users = pgTable(
  "users",
  {
    id,
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
  }),
);

export const refreshSessions = pgTable(
  "refresh_sessions",
  {
    id,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    rotatedFromSessionId: uuid("rotated_from_session_id"),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 128 }),
    createdAt,
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => ({
    userIdx: index("refresh_sessions_user_id_idx").on(table.userId),
    tokenHashIdx: index("refresh_sessions_token_hash_idx").on(table.tokenHash),
  }),
);

export const mediaSources = pgTable(
  "media_sources",
  {
    id,
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    provider: mediaProviderEnum("provider").notNull(),
    originalUrl: text("original_url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    externalId: varchar("external_id", { length: 256 }).notNull(),
    title: varchar("title", { length: 180 }),
    thumbnailUrl: text("thumbnail_url"),
    embedUrl: text("embed_url"),
    providerPayload: jsonb("provider_payload"),
    createdAt,
    updatedAt,
  },
  (table) => ({
    providerExternalIdx: index("media_sources_provider_external_id_idx").on(
      table.provider,
      table.externalId,
    ),
    ownerIdx: index("media_sources_owner_id_idx").on(table.ownerId),
  }),
);

export const rooms = pgTable(
  "rooms",
  {
    id,
    code: varchar("code", { length: 24 }).notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mediaSourceId: uuid("media_source_id")
      .notNull()
      .references(() => mediaSources.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 180 }),
    visibility: roomVisibilityEnum("visibility").notNull().default("unlisted"),
    status: roomStatusEnum("status").notNull().default("active"),
    createdAt,
    updatedAt,
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => ({
    codeUnique: uniqueIndex("rooms_code_unique").on(table.code),
    ownerIdx: index("rooms_owner_id_idx").on(table.ownerId),
    hostIdx: index("rooms_host_user_id_idx").on(table.hostUserId),
  }),
);

export const roomMembers = pgTable(
  "room_members",
  {
    id,
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    guestName: varchar("guest_name", { length: 80 }),
    role: roomMemberRoleEnum("role").notNull().default("viewer"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (table) => ({
    roomIdx: index("room_members_room_id_idx").on(table.roomId),
    userIdx: index("room_members_user_id_idx").on(table.userId),
  }),
);

export const roomPlaybackStates = pgTable("room_playback_states", {
  roomId: uuid("room_id")
    .primaryKey()
    .references(() => rooms.id, { onDelete: "cascade" }),
  status: playbackStatusEnum("status").notNull().default("paused"),
  positionMs: integer("position_ms").notNull().default(0),
  playbackRate: doublePrecision("playback_rate").notNull().default(1),
  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedByMemberId: uuid("updated_by_member_id").references(
    () => roomMembers.id,
    { onDelete: "set null" },
  ),
});

export const roomEvents = pgTable(
  "room_events",
  {
    id,
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    actorMemberId: uuid("actor_member_id").references(() => roomMembers.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 80 }).notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt,
  },
  (table) => ({
    roomCreatedIdx: index("room_events_room_id_created_at_idx").on(
      table.roomId,
      table.createdAt,
    ),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  refreshSessions: many(refreshSessions),
  ownedRooms: many(rooms, { relationName: "owner" }),
  hostedRooms: many(rooms, { relationName: "host" }),
}));

export const refreshSessionsRelations = relations(refreshSessions, ({ one }) => ({
  user: one(users, {
    fields: [refreshSessions.userId],
    references: [users.id],
  }),
}));

export const mediaSourcesRelations = relations(mediaSources, ({ one, many }) => ({
  owner: one(users, {
    fields: [mediaSources.ownerId],
    references: [users.id],
  }),
  rooms: many(rooms),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  owner: one(users, {
    fields: [rooms.ownerId],
    references: [users.id],
    relationName: "owner",
  }),
  host: one(users, {
    fields: [rooms.hostUserId],
    references: [users.id],
    relationName: "host",
  }),
  mediaSource: one(mediaSources, {
    fields: [rooms.mediaSourceId],
    references: [mediaSources.id],
  }),
  members: many(roomMembers),
  playbackState: one(roomPlaybackStates),
  events: many(roomEvents),
}));

export const roomMembersRelations = relations(roomMembers, ({ one, many }) => ({
  room: one(rooms, {
    fields: [roomMembers.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [roomMembers.userId],
    references: [users.id],
  }),
  playbackUpdates: many(roomPlaybackStates),
  events: many(roomEvents),
}));

export const roomPlaybackStatesRelations = relations(
  roomPlaybackStates,
  ({ one }) => ({
    room: one(rooms, {
      fields: [roomPlaybackStates.roomId],
      references: [rooms.id],
    }),
    updatedByMember: one(roomMembers, {
      fields: [roomPlaybackStates.updatedByMemberId],
      references: [roomMembers.id],
    }),
  }),
);

export const roomEventsRelations = relations(roomEvents, ({ one }) => ({
  room: one(rooms, {
    fields: [roomEvents.roomId],
    references: [rooms.id],
  }),
  actorMember: one(roomMembers, {
    fields: [roomEvents.actorMemberId],
    references: [roomMembers.id],
  }),
}));

export type UserRecord = typeof users.$inferSelect;
export type NewUserRecord = typeof users.$inferInsert;
export type RefreshSessionRecord = typeof refreshSessions.$inferSelect;
export type NewRefreshSessionRecord = typeof refreshSessions.$inferInsert;
export type MediaSourceRecord = typeof mediaSources.$inferSelect;
export type NewMediaSourceRecord = typeof mediaSources.$inferInsert;
export type RoomRecord = typeof rooms.$inferSelect;
export type NewRoomRecord = typeof rooms.$inferInsert;
export type RoomMemberRecord = typeof roomMembers.$inferSelect;
export type NewRoomMemberRecord = typeof roomMembers.$inferInsert;
export type RoomPlaybackStateRecord = typeof roomPlaybackStates.$inferSelect;
export type NewRoomPlaybackStateRecord =
  typeof roomPlaybackStates.$inferInsert;
export type RoomEventRecord = typeof roomEvents.$inferSelect;
export type NewRoomEventRecord = typeof roomEvents.$inferInsert;
