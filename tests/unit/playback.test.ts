import { describe, expect, test } from "bun:test";
import { calculateEffectivePositionMs } from "../../src/modules/rooms/sync/playback-clock";
import { canMutatePlayback } from "../../src/modules/rooms/sync/playback-permissions";

describe("playback clock", () => {
  test("advances playing state by elapsed server time and playback rate", () => {
    const updatedAt = new Date("2026-05-19T10:00:00.000Z");
    const now = new Date("2026-05-19T10:00:02.000Z");

    expect(
      calculateEffectivePositionMs(
        {
          status: "playing",
          positionMs: 10_000,
          playbackRate: 1.5,
          updatedAt,
        },
        now,
      ),
    ).toBe(13_000);
  });

  test("keeps paused state fixed", () => {
    expect(
      calculateEffectivePositionMs(
        {
          status: "paused",
          positionMs: 42_000,
          playbackRate: 1,
          updatedAt: new Date("2026-05-19T10:00:00.000Z"),
        },
        new Date("2026-05-19T10:01:00.000Z"),
      ),
    ).toBe(42_000);
  });
});

describe("playback permissions", () => {
  test("only owner and host can mutate playback", () => {
    expect(canMutatePlayback("owner")).toBe(true);
    expect(canMutatePlayback("host")).toBe(true);
    expect(canMutatePlayback("viewer")).toBe(false);
    expect(canMutatePlayback(null)).toBe(false);
  });
});
