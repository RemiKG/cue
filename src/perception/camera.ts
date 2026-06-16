// camera.ts — real device capture via getUserMedia. The stream is the stranger's own
// live camera + microphone, on their own device. Raw A/V stays here: we sample frames
// into an OFFSCREEN canvas for on-device analysis and never upload them.
export interface Capture {
  stream: MediaStream;
  video: HTMLVideoElement;
  hasAudio: boolean;
  hasVideo: boolean;
}

export async function startCapture(want: { video?: boolean; audio?: boolean } = { video: true, audio: true }): Promise<Capture> {
  const constraints: MediaStreamConstraints = {
    video: want.video ? { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } : false,
    audio: want.audio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : false,
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.srcObject = stream;
  await video.play().catch(() => {});
  return {
    stream,
    video,
    hasAudio: stream.getAudioTracks().length > 0,
    hasVideo: stream.getVideoTracks().length > 0,
  };
}

export function stopCapture(cap: Capture | null): void {
  if (!cap) return;
  try { cap.stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
  try { cap.video.srcObject = null; cap.video.remove(); } catch { /* ignore */ }
}

/** Sample the current frame into a small offscreen canvas; returns ImageData. */
export function sampleFrame(video: HTMLVideoElement, w = 160, h = 120): ImageData | null {
  try {
    if (!video.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
}
