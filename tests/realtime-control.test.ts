import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { realtimeAudioInputEvent, webRtcFailureMessage } from "../src/lib/realtime-control";

test("voice turns clear and commit the Realtime input buffer explicitly", () => {
  assert.deepEqual(realtimeAudioInputEvent("input_audio_buffer.clear"), { type: "input_audio_buffer.clear" });
  assert.deepEqual(realtimeAudioInputEvent("input_audio_buffer.commit"), { type: "input_audio_buffer.commit" });

  const tokenRoute = readFileSync(path.join(process.cwd(), "src/app/api/realtime/token/route.ts"), "utf8");
  assert.match(tokenRoute, /turn_detection:\s*null/);
});

test("WebRTC failures expose the peer and ICE states", () => {
  const message = webRtcFailureMessage("failed", "failed");
  assert.match(message, /connection: failed/);
  assert.match(message, /ICE: failed/);
  assert.match(message, /typed answers/);
});
