import { Elysia } from "elysia";
import type { AuthService } from "../auth/auth.service";
import type { RoomsService } from "./rooms.service";
import {
  createRoomBodySchema,
  createRoomResponseSchema,
  roomCodeParamsSchema,
  roomSnapshotResponseSchema,
  roomsErrorResponses,
} from "./rooms.schemas";

export const createRoomsRoutes = (
  roomsService: RoomsService,
  authService: AuthService,
) =>
  new Elysia({ prefix: "/api/rooms" })
    .post(
      "/",
      async ({ body, headers }) => {
        const user = await authService.getUserFromAuthorization(
          headers.authorization,
        );
        return roomsService.createRoom(body, user);
      },
      {
        body: createRoomBodySchema,
        detail: {
          tags: ["Rooms"],
          summary: "Create room",
          description:
            "Creates a watch room from a supported external video URL. The creator becomes owner and host.",
          security: [{ bearerAuth: [] }],
        },
        response: {
          200: createRoomResponseSchema,
          ...roomsErrorResponses,
        },
      },
    )
    .get(
      "/:code",
      async ({ params, headers }) => {
        const user = await authService.getOptionalUserFromAuthorization(
          headers.authorization,
        );
        return roomsService.getRoomSnapshot(params.code, user);
      },
      {
        params: roomCodeParamsSchema,
        detail: {
          tags: ["Rooms"],
          summary: "Get room snapshot",
          description:
            "Returns public room, media, server-authoritative playback state, and permissions for the current user if authenticated.",
        },
        response: {
          200: roomSnapshotResponseSchema,
          ...roomsErrorResponses,
        },
      },
    )
    .post(
      "/:code/join",
      async ({ params, headers }) => {
        const user = await authService.getOptionalUserFromAuthorization(
          headers.authorization,
        );
        return roomsService.joinRoom(params.code, user);
      },
      {
        params: roomCodeParamsSchema,
        detail: {
          tags: ["Rooms"],
          summary: "Join room",
          description:
            "Hydrates membership for authenticated users and returns the same room snapshot used by the room route.",
        },
        response: {
          200: roomSnapshotResponseSchema,
          ...roomsErrorResponses,
        },
      },
    );
