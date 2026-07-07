let lastUsbMounted = null;

function updateHeader(d) {
  setEl("greeting", greeting() + " \u{1F44B}");
  const b = document.getElementById("badge");
  b.textContent = d.online ? "Online" : "Degraded";
  b.className = "badge " + (d.online ? "online" : "offline");
}

function updateStrip(d) {
  setEl("strip-uptime", fmtUptime(d.host.uptime_seconds));
  setEl("strip-since", "Since start");
  updateSupervisorStrip(d.supervisor);
  setEl("strip-model", d.host.model);
  setEl("strip-android", "Android " + d.host.android_version);
  const bt = d.battery;
  const charging = bt.plugged === "PLUGGED_USB" || bt.plugged === "PLUGGED_AC" || bt.status === "CHARGING";
  setEl("strip-battery", (bt.percentage ?? "\u2014") + "%");
  setEl("strip-battery-state", charging ? "Charging" : (bt.status || "Battery"));
  const w = d.wifi;
  setEl("strip-wifi", w.ssid || "Wi-Fi");
  const sig = w.rssi_dbm != null ? w.rssi_dbm + " dBm" : "\u2014";
  const speed = w.link_speed_mbps != null ? w.link_speed_mbps + " Mbps" : "";
  setEl("strip-wifi-meta", speed ? sig + " \u2022 " + speed : sig);
  setEl("strip-ip", w.ip ?? "\u2014");
  updateTailscaleStrip(d.tailscale);
  if (bt.temperature_c != null) {
    document.getElementById("strip-temp-card").style.display = "";
    setEl("strip-temp", Math.round(bt.temperature_c) + "\u00B0C");
    setEl("strip-temp-state", bt.temperature_c >= 45 ? "Warm" : "Normal");
  } else {
    document.getElementById("strip-temp-card").style.display = "none";
  }
}

function updateSupervisorStrip(s) {
  s = s || {};
  const state = s.state || "unknown";
  const label = state.charAt(0).toUpperCase() + state.slice(1);
  setEl("strip-supervisor", label);
  const services = s.service_count ? (s.supervised_count + "/" + s.service_count + " supervised") : "No status yet";
  const checked = s.last_check ? relativeTime(new Date(s.last_check)) : "never";
  const recovery = s.last_recovery ? " · recovered " + relativeTime(new Date(s.last_recovery)) : "";
  setEl("strip-supervisor-meta", services + " · checked " + checked + recovery);
  const icon = document.getElementById("strip-supervisor-icon");
  if (icon) icon.className = "strip-icon supervisor-" + state;
}

function updateTailscaleStrip(t) {
  t = t || {};
  const installed = !!t.installed;
  const online = installed && !!t.online;
  const label = !installed ? "Not installed" : online ? "Running" : (t.backend_state || "Stopped");
  setEl("strip-tailscale", label);
  const peerPart = installed ? (t.active_peer_count || 0) + "/" + (t.peer_count || 0) + " active peers" : "Private access off";
  const ipPart = online ? (t.ipv4 || t.dns_name || "No IP") : "No tunnel";
  const relayPart = t.relay ? " · DERP " + t.relay : "";
  setEl("strip-tailscale-meta", installed ? ipPart + " · " + peerPart + relayPart : peerPart);
  const icon = document.getElementById("strip-tailscale-icon");
  if (icon) icon.className = "strip-icon tailscale-" + (online ? "healthy" : installed ? "degraded" : "unknown");
}

function updateStorage(d) {
  const u = d.storage.usb;
  const se = document.getElementById("usb-state");
  const be = document.getElementById("usb-body");
  if (lastUsbMounted !== null && lastUsbMounted !== u.mounted) {
    fetch(API + "/activity", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: u.mounted ? "usb_mounted" : "usb_unmounted" }) }).catch(() => {});
  }
  lastUsbMounted = u.mounted;
  if (!u.mounted) {
    se.textContent = "USB storage not mounted";
    se.className = "usb-state unmounted";
    be.style.display = "none";
    return;
  }
  se.textContent = "Mounted \u00B7 exFAT";
  se.className = "usb-state mounted";
  be.style.display = "";
  const pct = u.use_pct ?? 0;
  setEl("usb-pct", pct);
  setEl("usb-used-line", "Used: " + fmtBytes(u.used_bytes));
  setEl("usb-free-line", "Free: " + fmtBytes(u.available_bytes));
  setEl("usb-total-line", "Total: " + fmtBytes(u.total_bytes));
  const ring = document.querySelector(".ring-fill");
  if (ring) {
    const circ = 2 * Math.PI * 52;
    ring.style.strokeDasharray = circ;
    ring.style.strokeDashoffset = circ * (1 - pct / 100);
    ring.style.stroke = pct > 85 ? "var(--red)" : pct > 65 ? "var(--orange)" : "var(--blue)";
  }
  const folders = u.top_folders;
  const tf = document.getElementById("top-folders");
  const fl = document.getElementById("folder-list");
  if (folders && folders.length > 0) {
    tf.style.display = "";
    fl.innerHTML = folders.map(f => "<li><span>" + esc(f.name) + "</span><span>" + esc(f.size) + "</span></li>").join("");
  } else { tf.style.display = "none"; }
  const ip = d.storage.internal.use_pct ?? 0;
  document.getElementById("internal-bar").style.width = ip + "%";
  setEl("internal-pct", ip + "%");
}

function updateCPU(d) {
  const la = d.host.loadavg;
  setEl("load-1", la.one); setEl("load-5", la.five); setEl("load-15", la.fifteen);
  const grid = document.getElementById("cores-grid");
  if (!grid.children.length) {
    d.cpu.cores.forEach(function(c) {
      const big = c.id >= 4;
      const div = document.createElement("div");
      div.className = "core-item " + (big ? "core-big" : "core-little");
      div.innerHTML = '<div class="core-header"><span class="core-id">C'+c.id+'</span><span class="core-freq" id="cf-'+c.id+'">\u2014</span></div><div class="core-bar-track"><div class="core-bar-fill" id="cb-'+c.id+'" style="width:0%"></div></div>';
      grid.appendChild(div);
    });
  }
  let maxF = 2800;
  d.cpu.cores.forEach(function(c) { if (c.max_mhz && c.max_mhz > maxF) maxF = c.max_mhz; });
  d.cpu.cores.forEach(function(c) {
    const f = c.freq_mhz;
    const label = f != null ? (f >= 1000 ? (f/1000).toFixed(2)+" GHz" : f+" MHz") : "\u2014";
    setEl("cf-"+c.id, label);
    const bar = document.getElementById("cb-"+c.id);
    if (bar && f != null) bar.style.width = Math.min(100, (f/maxF)*100) + "%";
  });
}

function updateMemory(d) {
  const m = d.memory;
  const ru = m.ram_total_bytes - m.ram_available_bytes;
  const rp = m.ram_total_bytes > 0 ? Math.round((ru/m.ram_total_bytes)*100) : 0;
  document.getElementById("ram-bar").style.width = rp + "%";
  setEl("ram-pct", rp + "%");
  setEl("ram-used", "Used: " + fmtBytes(ru));
  setEl("ram-available", "Available: " + fmtBytes(m.ram_available_bytes));
  setEl("ram-cache", "Cache: " + fmtBytes(m.ram_cached_bytes));
  const su = m.swap_total_bytes - m.swap_free_bytes;
  const sp = m.swap_total_bytes > 0 ? Math.round((su/m.swap_total_bytes)*100) : 0;
  document.getElementById("swap-bar").style.width = sp + "%";
  setEl("swap-pct", sp + "%");
  setEl("swap-used", "Used: " + fmtBytes(su));
  setEl("swap-free", "Free: " + fmtBytes(m.swap_free_bytes));
}

function updateNetwork(d) {
  const w = d.wifi;
  const t = d.tailscale || {};
  const ssidRow = document.getElementById("net-ssid");
  if (w.ssid) {
    if (ssidRow) ssidRow.style.display = "";
    setNetworkText("net-ssid-val", w.ssid);
  } else if (ssidRow) {
    ssidRow.style.display = "none";
  }
  const r = w.rssi_dbm != null ? w.rssi_dbm+" dBm ("+rssiLabel(w.rssi_dbm)+")" : "\u2014";
  setNetworkText("net-rssi", r);
  setNetworkText("net-speed", w.link_speed_mbps != null ? w.link_speed_mbps+" Mbps" : "\u2014");
  setNetworkText("net-freq", w.frequency_mhz != null ? w.frequency_mhz+" MHz" : "\u2014");
  setNetworkText("net-ip", w.ip ?? "\u2014");
  if (t.installed) {
    const state = t.online ? "Running" : (t.backend_state || "Stopped");
    setNetworkText("net-ts-state", state);
    setNetworkText("net-ts-name", t.dns_name || t.hostname || "\u2014");
    setNetworkText("net-ts-ip", t.ipv4 || "\u2014");
    setNetworkText("net-ts-peers", (t.active_peer_count || 0) + "/" + (t.peer_count || 0) + " active");
    setServePorts(t);
    updateNetworkPill(state, t.online ? "healthy" : "degraded");
  } else {
    setNetworkText("net-ts-state", "Not installed");
    setNetworkText("net-ts-name", "\u2014");
    setNetworkText("net-ts-ip", "\u2014");
    setNetworkText("net-ts-peers", "\u2014");
    setServePorts({});
    updateNetworkPill("Not installed", "unknown");
  }
}

function setNetworkText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = value == null ? "\u2014" : String(value);
  el.textContent = text;
  el.title = text === "\u2014" ? "" : text;
}

function updateNetworkPill(label, state) {
  const pill = document.getElementById("net-ts-pill");
  if (!pill) return;
  pill.textContent = "Tailscale " + label;
  pill.className = "net-status-pill " + state;
}

function setServePorts(t) {
  const el = document.getElementById("net-ts-serve");
  if (!el) return;
  const ports = Array.isArray(t.serve_ports) ? t.serve_ports : [];
  if (t.serve_enabled && ports.length) {
    el.innerHTML = ports.map(function(port) {
      return '<span class="net-chip">' + esc(port) + '</span>';
    }).join("");
    el.title = "Private Serve ports: " + ports.join(", ");
    return;
  }
  const fallback = t.serve_enabled && t.serve_web_count ? t.serve_web_count + " web" : "Off";
  el.textContent = fallback;
  el.title = fallback === "Off" ? "" : fallback;
}

function updateServices(d) {
  const grid = document.getElementById("services-grid");
  if (!grid.children.length) {
    d.services.forEach(function(s) {
      const tile = document.createElement("div");
      tile.className = "service-tile";
      tile.id = "svc-"+s.id;
      const action = serviceAction(s);
      tile.innerHTML = '<div class="service-main"><span class="service-icon">'+serviceIcon(s.id)+'</span><div class="service-info"><div class="service-title">'+esc(serviceTitle(s))+'</div><div class="service-sub" id="sub-'+s.id+'">'+serviceSub(s)+'</div></div></div><div class="service-health '+s.status+'" id="health-'+s.id+'"><span class="service-dot '+s.status+'" id="dot-'+s.id+'"></span>'+serviceLabel(s.status)+'</div>'+action;
      grid.appendChild(tile);
    });
    grid.addEventListener("click", onServiceAction);
  } else {
    d.services.forEach(function(s) {
      const dot = document.getElementById("dot-"+s.id);
      if (dot) dot.className = "service-dot " + s.status;
      const health = document.getElementById("health-"+s.id);
      if (health) {
        health.className = "service-health " + s.status;
        health.innerHTML = '<span class="service-dot '+s.status+'" id="dot-'+s.id+'"></span>' + serviceLabel(s.status);
      }
      const sub = document.getElementById("sub-"+s.id);
      if (sub) sub.textContent = serviceSub(s);
    });
  }
}

function updateActivity(items) {
  const list = document.getElementById("activity-list");
  if (!items || !items.length) { list.textContent = "No recent events"; return; }
  list.innerHTML = items.map(function(a) {
    const ts = a.ts ? relativeTime(new Date(a.ts)) : "";
    return '<div class="activity-item"><span class="activity-icon">'+activityIcon(a.event)+'</span><span class="activity-msg">'+esc(formatEvent(a))+'</span><span class="activity-ts">'+ts+'</span></div>';
  }).join("");
}

function serviceIcon(id) {
  return ({ filebrowser:"▣", audiobookshelf:"▤", navidrome:"♫", jellyfin:"△", samba:"⌘", ssh:"▻", "home-dashboard":"●", "local-llm":"✣" })[id] || "●";
}

function serviceTitle(s) {
  return ({ filebrowser:"Files", "home-dashboard":"Home", "local-llm":"LLM" })[s.id] || s.title;
}

function serviceSub(s) {
  if (s.id === "audiobookshelf") return "Stories, books and listening progress";
  if (s.id === "navidrome") return "Albums, playlists and favourites";
  if (s.id === "samba") return "SMB :" + s.port;
  if (s.id === "ssh") return "SSH :" + s.port;
  if (s.status === "not_running") return "Future";
  return "Port " + s.port;
}

function serviceAction(s) {
  const url = serviceUrl(s);
  if (url) {
    return '<a class="service-open" href="'+esc(url)+'" target="_blank" rel="noopener">Open \u2197</a>';
  }
  return '<button type="button" class="service-open service-setup" data-service="'+esc(s.id)+'">Setup</button>';
}

function serviceUrl(s) {
  if (s.kind === "http" && s.port) {
    const path = String(s.path || "/");
    try {
      const u = new URL(window.location.href);
      u.protocol = (s.scheme || "http") + ":";
      u.hostname = window.location.hostname;
      u.port = String(s.port);
      u.pathname = path.charAt(0) === "/" ? path : "/" + path;
      u.search = "";
      u.hash = "";
      return u.toString();
    } catch (e) {
      return "";
    }
  }
  return s.url || "";
}

function serviceLabel(status) {
  if (status === "not_running") return "Not running";
  if (status === "healthy") return "Healthy";
  if (status === "degraded") return "Degraded";
  if (status === "unhealthy") return "Down";
  return "Unknown";
}

function onServiceAction(e) {
  const btn = e.target.closest(".service-setup");
  if (!btn) return;
  showServiceSetup(btn.dataset.service);
}

function showServiceSetup(id) {
  const dialog = document.getElementById("service-dialog");
  const title = document.getElementById("service-dialog-title");
  const subtitle = document.getElementById("service-dialog-subtitle");
  const body = document.getElementById("service-dialog-body");
  const info = setupInfo(id);
  title.textContent = info.title;
  subtitle.textContent = info.subtitle;
  body.innerHTML = info.body;
  if (dialog && typeof dialog.showModal === "function") dialog.showModal();
}

function setupInfo(id) {
  const map = {
    samba: {
      title: "Use Samba",
      subtitle: "Network drive access",
      body: '<p>Connect from macOS Finder with this server address:</p><code>smb://android-media.local:1445/media-drive</code><p>Use Finder > Go > Connect to Server, paste the address, then save credentials in macOS when prompted.</p>'
    },
    ssh: {
      title: "Use SSH",
      subtitle: "Terminal access",
      body: '<p>Connect from a terminal on the LAN:</p><code>ssh -p 8022 android-media.local</code><p>Use your configured SSH key. Passwordless key access is the expected setup for administration.</p>'
    },
    "local-llm": {
      title: "Local LLM",
      subtitle: "Planned service",
      body: '<p>This service is reserved for a future local model endpoint.</p><p>When it is installed, this card can open the web UI or show the API endpoint here.</p>'
    }
  };
  return map[id] || {
    title: "Service setup",
    subtitle: "Connection details",
    body: "<p>No setup instructions are defined for this service yet.</p>"
  };
}

function formatEvent(a) {
  const event = String(a.event || "").replace(/_/g, " ");
  return event.charAt(0).toUpperCase() + event.slice(1) + (a.detail ? "  " + a.detail : "");
}

function activityIcon(event) {
  const e = String(event || "");
  if (e.includes("ssh")) return "⌘";
  if (e.includes("usb")) return "▣";
  if (e.includes("file")) return "↥";
  if (e.includes("dashboard")) return "▻";
  return "•";
}

function relativeTime(date) {
  const diff = Math.max(0, Date.now() - date.getTime());
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m ago";
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + "h ago";
  return Math.round(hours / 24) + "d ago";
}
