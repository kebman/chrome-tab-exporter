// chrome-tab-exporter/background.js - Chrome Tab Exporter v 1.3
function getCurrentDateFilename() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `tabs_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

function getYouTubeVideoId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      // Standard watch URL: https://www.youtube.com/watch?v=ID
      if (url.pathname === '/watch') {
        return url.searchParams.get('v');
      }
      // Shorts: https://www.youtube.com/shorts/ID
      if (url.pathname.startsWith('/shorts/')) {
        const parts = url.pathname.split('/');
        return parts[2] || null;
      }
    }

    // Shortlink: https://youtu.be/ID
    if (host === 'youtu.be') {
      return url.pathname.slice(1) || null;
    }

    return null;
  } catch {
    return null;
  }
}

chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({}); // alle tabs i alle vinduer

  // === 1) Bygg opp et kart over tab-grupper først ===
  const groupIds = [
    ...new Set(
      tabs
        .map(t => t.groupId)
        .filter(id => typeof id === 'number' && id !== -1)
    )
  ];

  const groupMap = {}; // groupId -> { title, color }

  if (groupIds.length > 0) {
    const groupPromises = groupIds.map(id => chrome.tabGroups.get(id));
    const groups = await Promise.all(groupPromises);
    for (const g of groups) {
      groupMap[g.id] = {
        title: g.title || null,
        color: g.color || null   // f.eks. "blue", "red", "yellow", ...
      };
    }
  }

  const results = [];

  // === 2) Gå gjennom alle tabs og legg på info + gruppe ===
  for (const tab of tabs) {
    const info = {
      page_title: tab.title,
      url: tab.url
    };

    // --- Tab group-informasjon ---
    if (typeof tab.groupId === 'number' && tab.groupId !== -1 && groupMap[tab.groupId]) {
      info.tab_group_id = tab.groupId;
      info.tab_group_title = groupMap[tab.groupId].title;
      info.tab_group_color = groupMap[tab.groupId].color;
    }

    // --- YouTube: legg på video_id ---
    const videoId = getYouTubeVideoId(tab.url);
    if (videoId) {
      info.youtube_video_id = videoId;
    }

    // --- YouTube: hent playhead/duration via content script ---
    if (
      tab.url.includes("youtube.com/watch") ||
      tab.url.includes("youtu.be") ||
      tab.url.includes("youtube.com/shorts")
    ) {
      try {
        const r = await new Promise((resolve) => {
          chrome.tabs.sendMessage(
            tab.id,
            { type: "getYoutubeInfo" },
            (response) => {
              const err = chrome.runtime.lastError;
              if (err) {
                const msg =
                  (typeof err.message === "string" && err.message) ||
                  JSON.stringify(err, Object.getOwnPropertyNames(err));
                resolve({ error: msg });
              } else {
                resolve(response || {});
              }
            }
          );
        });

        if (r.error) {
          if (typeof r.error === "string") {
            info.youtube_injection_error = r.error;
          } else if (r.error && typeof r.error.message === "string") {
            info.youtube_injection_error = r.error.message;
          } else {
            info.youtube_injection_error = JSON.stringify(
              r.error,
              Object.getOwnPropertyNames(r.error || {})
            );
          }
        } else {
          if (r.playheadSeconds != null) {
            info.playhead_seconds = r.playheadSeconds;
          }
          if (r.durationSeconds != null) {
            info.duration_seconds = r.durationSeconds;
          }
        }
      } catch (e) {
        info.youtube_injection_error =
          (e && typeof e.message === "string" && e.message) ||
          JSON.stringify(e, Object.getOwnPropertyNames(e || {}));
      }
    }

    results.push(info);
  }

  // === 3) Last ned JSON-fila ===
  const filename = getCurrentDateFilename();
  const jsonStr = JSON.stringify(results, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });

  const reader = new FileReader();
  reader.onloadend = () => {
    const dataUrl = reader.result;
    chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: false
    });
  };
  reader.readAsDataURL(blob);
});