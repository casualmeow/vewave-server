import { beforeEach, describe, expect, test } from "bun:test";
import { createInMemoryServices, createTestEnv } from "../../src/testing/in-memory-services";
import type { ServerRoomEvent } from "../../src/modules/realtime/realtime.schemas";

const createSocket = (roomCode: string, accessToken?: string) => {
  const messages: ServerRoomEvent[] = [];

  return {
    id: crypto.randomUUID(),
    messages,
    closed: false,
    data: {
      params: { code: roomCode },
      query: accessToken ? { accessToken } : {},
      headers: {},
    },
    send(data: string) {
      messages.push(JSON.parse(data));
    },
    close() {
      this.closed = true;
    },
  };
};

describe("realtime gateway", () => {
  const env = createTestEnv();
  let services: ReturnType<typeof createInMemoryServices>;

  beforeEach(() => {
    services = createInMemoryServices(env);
  });

  const createUserSession = async (email: string, name: string) =>
    services.auth.register(
      {
        email,
        name,
        password: "strong-password",
      },
      {},
    );

  test("host playback commands broadcast canonical playback state", async () => {
    const host = await createUserSession("host@example.com", "Host");
    const viewer = await createUserSession("viewer@example.com", "Viewer");
    const created = await services.rooms.createRoom(
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Live room",
      },
      host.user,
    );
    const roomCode = created.room.code;
    const hostSocket = createSocket(roomCode, host.accessToken);
    const viewerSocket = createSocket(roomCode, viewer.accessToken);

    await services.realtime.open(hostSocket as never);
    await services.realtime.open(viewerSocket as never);
    await services.realtime.message(
      hostSocket as never,
      JSON.stringify({
        type: "playback.command",
        requestId: "play-1",
        payload: { action: "play", positionMs: 12_450, playbackRate: 1 },
      }),
    );

    const hostPlayback = hostSocket.messages.find(
      (event) => event.type === "playback.state",
    );
    const viewerPlayback = viewerSocket.messages.find(
      (event) => event.type === "playback.state",
    );

    expect(hostPlayback?.payload).toMatchObject({
      status: "playing",
      positionMs: 12_450,
      playbackRate: 1,
      version: 1,
    });
    expect(viewerPlayback?.payload).toMatchObject({
      status: "playing",
      positionMs: 12_450,
      version: 1,
    });
  });

  test("viewer playback commands are rejected", async () => {
    const host = await createUserSession("host@example.com", "Host");
    const viewer = await createUserSession("viewer@example.com", "Viewer");
    const created = await services.rooms.createRoom(
      { url: "https://vimeo.com/123456789" },
      host.user,
    );
    const viewerSocket = createSocket(created.room.code, viewer.accessToken);

    await services.realtime.open(viewerSocket as never);
    await services.realtime.message(
      viewerSocket as never,
      JSON.stringify({
        type: "playback.command",
        requestId: "pause-1",
        payload: { action: "pause", positionMs: 1_000 },
      }),
    );

    const rejected = viewerSocket.messages.find(
      (event) => event.type === "command.rejected",
    );

    expect(rejected?.payload).toMatchObject({
      code: "PLAYBACK_COMMAND_FORBIDDEN",
    });
  });

  test("late joiner receives current room snapshot", async () => {
    const host = await createUserSession("host@example.com", "Host");
    const created = await services.rooms.createRoom(
      { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      host.user,
    );
    const hostSocket = createSocket(created.room.code, host.accessToken);

    await services.realtime.open(hostSocket as never);
    await services.realtime.message(
      hostSocket as never,
      JSON.stringify({
        type: "playback.command",
        payload: { action: "play", positionMs: 5_000 },
      }),
    );

    const lateJoiner = createSocket(created.room.code);
    await services.realtime.open(lateJoiner as never);

    const snapshot = lateJoiner.messages.find(
      (event) => event.type === "room.snapshot",
    );

    expect(snapshot?.payload).toMatchObject({
      playback: {
        status: "playing",
        positionMs: 5_000,
        version: 1,
      },
    });
  });
});
