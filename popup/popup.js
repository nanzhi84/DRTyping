(function initPopup(global) {
  const store = global.promptPaletteStore;
  const hostEl = document.getElementById("host");
  const statusEl = document.getElementById("status");
  const toggleEl = document.getElementById("site-toggle");
  const toggleLabel = document.getElementById("toggle-label");
  const optionsButton = document.getElementById("open-options");

  if (!store || !hostEl || !statusEl || !toggleEl || !optionsButton) {
    return;
  }

  let currentHost = null;
  let currentEntryId = null;
  let isBusy = false;

  const setStatus = (text) => {
    statusEl.textContent = text;
  };

  const setToggleEnabled = (enabled) => {
    toggleEl.disabled = !enabled || isBusy;
    toggleLabel.style.opacity = enabled && !isBusy ? "1" : "0.5";
  };

  const normalizeHost = (url) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname ? hostname.toLowerCase() : null;
    } catch {
      return null;
    }
  };

  const getActiveTab = () =>
    new Promise((resolve) => {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        resolve(tabs[0]);
      });
    });

  const refreshToggleState = async () => {
    if (!currentHost) {
      setToggleEnabled(false);
      setStatus("This page cannot be controlled.");
      return;
    }
    const whitelist = await store.listWhitelist();
    const found = whitelist.find((entry) => entry.hostname === currentHost);
    currentEntryId = found?.id ?? null;
    toggleEl.checked = Boolean(found);
    setStatus(found ? "Slash commands are enabled here." : "Slash commands are disabled here.");
    setToggleEnabled(true);
  };

  const syncHost = async () => {
    const activeTab = await getActiveTab();
    const host = activeTab?.url ? normalizeHost(activeTab.url) : null;
    if (!host) {
      hostEl.textContent = "Unavailable";
      toggleEl.checked = false;
      setToggleEnabled(false);
      setStatus("Chrome pages或空白页无法启用扩展。");
      return;
    }
    currentHost = host;
    hostEl.textContent = host;
    await refreshToggleState();
  };

  const withBusyState = async (fn) => {
    if (isBusy) {
      return;
    }
    isBusy = true;
    setToggleEnabled(true);
    try {
      await fn();
    } finally {
      isBusy = false;
      await refreshToggleState();
    }
  };

  toggleEl.addEventListener("change", () => {
    void withBusyState(async () => {
      if (!currentHost) {
        return;
      }
      if (toggleEl.checked) {
        const entry = await store.addWhitelistEntry(currentHost);
        currentEntryId = entry.id;
        setStatus("Enabled for this site.");
      } else if (currentEntryId) {
        await store.removeWhitelistEntry(currentEntryId);
        currentEntryId = null;
        setStatus("Disabled for this site.");
      } else {
        setStatus("Already disabled.");
      }
    }).catch((error) => {
      console.error(error);
      setStatus("Failed to update. See console for details.");
    });
  });

  optionsButton.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options/options.html"));
    }
  });

  void syncHost();
})(globalThis);

