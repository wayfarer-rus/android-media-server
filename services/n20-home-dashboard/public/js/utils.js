const REFRESH_MS = 12000;
const API = "/api";

function fmtBytes(b) {
  if (b == null) return "\u2014";
  if (b >= 1e12) return (b / 1e12).toFixed(1) + " TB";
  if (b >= 1e9) return (b / 1e9).toFixed(1) + " GB";
  if (b >= 1e6) return (b / 1e6).toFixed(1) + " MB";
  return b + " B";
}

function fmtUptime(sec) {
  if (sec == null) return "\u2014";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const p = [];
  if (d > 0) p.push(d + "d");
  if (h > 0) p.push(h + "h");
  p.push(m + "m");
  return p.join(" ");
}

function rssiLabel(r) {
  if (r == null) return "";
  if (r >= -50) return "Excellent";
  if (r >= -60) return "Good";
  if (r >= -70) return "Fair";
  return "Weak";
}

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Good night!";
  if (h < 12) return "Good morning!";
  if (h < 18) return "Good afternoon!";
  return "Good evening!";
}

function setEl(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

function esc(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}
