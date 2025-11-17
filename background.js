function getCurrentDateFilename() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `tabs_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  const results = [];

  for (const tab of tabs) {
    const info = {
      title: tab.title,
      url: tab.url
    };

    if (tab.url.includes("youtube.com/watch")) {
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const video = document.querySelector('video');
            return video ? Math.floor(video.currentTime) : null;
          }
        });

        if (result?.result !== null) {
          info.playhead_seconds = result.result;
        }
      } catch (e) {
        // ignore injection errors
      }
    }

    results.push(info);
  }

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
