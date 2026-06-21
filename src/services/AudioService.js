// AudioService placeholder for future native wake-word / recording integration.
// Current app uses WebView-based recognizers; this module centralizes future native hooks.

export function isNativeWakewordAvailable() {
  // placeholder: detect presence of native module
  return false;
}

export async function startWakewordListener(opts = {}) {
  // If you integrate Picovoice/Porcupine or other SDKs, replace this.
  console.warn('startWakewordListener: native wake-word not implemented; using WebView fallbacks');
  return false;
}

export async function stopWakewordListener() {
  console.warn('stopWakewordListener: no-op');
}

export async function startRecordingToFile(path) {
  console.warn('startRecordingToFile: not implemented');
}

export async function stopRecording() {
  console.warn('stopRecording: not implemented');
}
