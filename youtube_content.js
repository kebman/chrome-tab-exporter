// chrome-tab-exporter/youtube-content.js - Chrome Tab Exporter v 1.3
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "getYoutubeInfo") return;

  try {
    const video = document.querySelector("video");

    const playheadSeconds = video ? Math.floor(video.currentTime || 0) : null;
    const durationSeconds =
      video && Number.isFinite(video.duration)
        ? Math.floor(video.duration)
        : null;

    sendResponse({
      playheadSeconds,
      durationSeconds
    });
  } catch (e) {
    sendResponse({
      error: (e && typeof e.message === "string" && e.message) || String(e)
    });
  }

  return true; // keep channel open for async sendResponse (MV3-safe)
});
