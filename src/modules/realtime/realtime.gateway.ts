import type { AuthService } from "../auth/auth.service";
import type { PublicUser } from "../auth/auth.types";
import type { RoomsService } from "../rooms/rooms.service";
import { AppError } from "../../shared/errors/app-error";
import { getBearerToken } from "../../shared/http/auth";
import {
  createServerEvent,
  parseClientRoomEvent,
  type ServerRoomEvent,
} from "./realtime.schemas";
import { LocalRoomRealtimeTransport } from "./realtime.transport";

type WebSocketLike = {
  id: string;
  data: {
    params: { code: string };
    query?: { accessToken?: string };
    headers: Record<string, string | undefined>;
  };
  send(data: string): unknown;
  close(code?: number, reason?: string): void;
};

const sendEvent = (ws: Pick<WebSocketLike, "send">, event: ServerRoomEvent) => {
  ws.send(JSON.stringify(event));
};

export class RealtimeGateway {
  constructor(
    private readonly authService: AuthService,
    private readonly roomsService: RoomsService,
    private readonly transport = new LocalRoomRealtimeTransport(),
  ) {}

  async open(ws: WebSocketLike) {
    const roomCode = ws.data.params.code;

    try {
      const user = await this.resolveUser(ws);
      const connection = await this.roomsService.connectRealtimeRoom(
        roomCode,
        user,
      );

      this.transport.register({
        connectionId: ws.id,
        roomCode,
        roomId: connection.roomId,
        memberId: connection.member?.id ?? null,
        userId: user?.id ?? null,
        name: user?.name ?? "Guest",
        role: connection.snapshot.permissions.role,
        connectedAt: new Date().toISOString(),
        user,
        send: (event) => sendEvent(ws, event),
      });
      const members = this.transport.getConnectedMembers(roomCode);
      const member = members.find((item) => item.connectionId === ws.id);

      if (!member) {
        throw new AppError(
          "INTERNAL_SERVER_ERROR",
          "Realtime presence registration failed.",
          500,
        );
      }

      this.transport.publishToMember(
        ws.id,
        createServerEvent({
          type: "room.snapshot",
          roomCode,
          payload: {
            ...connection.snapshot,
            presence: {
              members,
            },
          },
        }),
      );

      this.transport.publishToRoom(
        roomCode,
        createServerEvent({
          type: "presence.member.joined",
          roomCode,
          payload: {
            member,
            members,
          },
        }),
      );
    } catch (error) {
      sendEvent(
        ws,
        createServerEvent({
          type: "error",
          roomCode,
          payload: this.toRealtimeError(error),
        }),
      );
      ws.close(1008, "Room rejected");
    }
  }

  async message(ws: WebSocketLike, rawMessage: unknown) {
    const roomCode = ws.data.params.code;
    const connection = this.transport.getConnection(ws.id);

    if (!connection) {
      sendEvent(
        ws,
        createServerEvent({
          type: "error",
          roomCode,
          payload: {
            code: "AUTH_UNAUTHORIZED",
            message: "Connection is not registered.",
          },
        }),
      );
      return;
    }

    try {
      const event = parseClientRoomEvent(rawMessage);

      if (event.type === "room.ping") {
        this.transport.publishToMember(
          ws.id,
          createServerEvent({
            type: "room.pong",
            roomCode,
            requestId: event.requestId,
            payload: { serverTimeMs: Date.now() },
          }),
        );
        return;
      }

      const command =
        event.type === "playback.rate.change"
          ? {
              action: "set_rate" as const,
              playbackRate: event.payload.playbackRate,
              positionMs: event.payload.positionMs,
            }
          : event.payload;

      const playback = await this.roomsService.applyPlaybackCommand(
        roomCode,
        connection.user,
        command,
      );

      this.transport.publishToRoom(
        roomCode,
        createServerEvent({
          type: "playback.state",
          roomCode,
          requestId: event.requestId,
          payload: playback,
        }),
      );
    } catch (error) {
      const event = createServerEvent({
        type: error instanceof AppError ? "command.rejected" : "error",
        roomCode,
        payload: this.toRealtimeError(error),
      });

      this.transport.publishToMember(ws.id, event);
    }
  }

  async close(ws: WebSocketLike) {
    const connection = this.transport.remove(ws.id);
    if (!connection) return;

    if (
      connection.memberId &&
      !this.transport.hasMemberConnection(connection.roomCode, connection.memberId)
    ) {
      await this.roomsService.markMemberLeft(
        connection.memberId,
        connection.roomId,
      );
    }

    this.transport.publishToRoom(
      connection.roomCode,
      createServerEvent({
        type: "presence.member.left",
        roomCode: connection.roomCode,
        payload: {
          connectionId: connection.connectionId,
          memberId: connection.memberId,
          userId: connection.userId,
          members: this.transport.getConnectedMembers(connection.roomCode),
        },
      }),
    );
  }

  getTransport() {
    return this.transport;
  }

  private async resolveUser(ws: WebSocketLike): Promise<PublicUser | null> {
    const bearerToken =
      getBearerToken(ws.data.headers.authorization) ?? ws.data.query?.accessToken;

    if (!bearerToken) return null;

    try {
      return await this.authService.getUserFromAccessToken(bearerToken);
    } catch {
      return null;
    }
  }

  private toRealtimeError(error: unknown) {
    if (error instanceof AppError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details,
      };
    }

    return {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected realtime error occurred.",
    };
  }
}
