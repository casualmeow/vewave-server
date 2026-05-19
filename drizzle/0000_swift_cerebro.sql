CREATE TYPE "public"."media_provider" AS ENUM('youtube', 'vimeo', 'tiktok', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."playback_status" AS ENUM('playing', 'paused', 'buffering', 'ended');--> statement-breakpoint
CREATE TYPE "public"."room_member_role" AS ENUM('owner', 'host', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."room_visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
CREATE TABLE "media_sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid,
	"provider" "media_provider" NOT NULL,
	"original_url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"external_id" varchar(256) NOT NULL,
	"title" varchar(180),
	"thumbnail_url" text,
	"embed_url" text,
	"provider_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"rotated_from_session_id" uuid,
	"user_agent" text,
	"ip_address" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "room_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"actor_member_id" uuid,
	"type" varchar(80) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_name" varchar(80),
	"role" "room_member_role" DEFAULT 'viewer' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "room_playback_states" (
	"room_id" uuid PRIMARY KEY NOT NULL,
	"status" "playback_status" DEFAULT 'paused' NOT NULL,
	"position_ms" integer DEFAULT 0 NOT NULL,
	"playback_rate" double precision DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_member_id" uuid
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(24) NOT NULL,
	"owner_id" uuid NOT NULL,
	"host_user_id" uuid NOT NULL,
	"media_source_id" uuid NOT NULL,
	"title" varchar(180),
	"visibility" "room_visibility" DEFAULT 'unlisted' NOT NULL,
	"status" "room_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(120) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_sources" ADD CONSTRAINT "media_sources_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_events" ADD CONSTRAINT "room_events_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_events" ADD CONSTRAINT "room_events_actor_member_id_room_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."room_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_playback_states" ADD CONSTRAINT "room_playback_states_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_playback_states" ADD CONSTRAINT "room_playback_states_updated_by_member_id_room_members_id_fk" FOREIGN KEY ("updated_by_member_id") REFERENCES "public"."room_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_media_source_id_media_sources_id_fk" FOREIGN KEY ("media_source_id") REFERENCES "public"."media_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_sources_provider_external_id_idx" ON "media_sources" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "media_sources_owner_id_idx" ON "media_sources" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "refresh_sessions_user_id_idx" ON "refresh_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_sessions_token_hash_idx" ON "refresh_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "room_events_room_id_created_at_idx" ON "room_events" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "room_members_room_id_idx" ON "room_members" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_members_user_id_idx" ON "room_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_code_unique" ON "rooms" USING btree ("code");--> statement-breakpoint
CREATE INDEX "rooms_owner_id_idx" ON "rooms" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "rooms_host_user_id_idx" ON "rooms" USING btree ("host_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");