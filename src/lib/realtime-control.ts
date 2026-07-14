export type RealtimeAudioInputEvent = {
  type: "input_audio_buffer.clear" | "input_audio_buffer.commit";
};

export function realtimeAudioInputEvent(type: RealtimeAudioInputEvent["type"]): RealtimeAudioInputEvent {
  return { type };
}

export function webRtcFailureMessage(connectionState: RTCPeerConnectionState, iceState: RTCIceConnectionState) {
  return `The voice connection could not establish a media path (connection: ${connectionState}, ICE: ${iceState}). Retry on a stable network or use typed answers.`;
}
