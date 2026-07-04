async function refresh() {
  try {
    const [sr, ar] = await Promise.all([
      fetch(API + "/status", { cache: "no-store" }),
      fetch(API + "/activity", { cache: "no-store" })
    ]);
    const d = await sr.json();
    const items = await ar.json();
    updateHeader(d);
    updateStrip(d);
    updateStorage(d);
    updateCPU(d);
    updateMemory(d);
    updateNetwork(d);
    updateServices(d);
    updateActivity(items);
  } catch (e) {
    console.error("Refresh failed:", e);
  }
}

refresh();
setInterval(refresh, REFRESH_MS);
