#!/data/data/com.termux/files/usr/bin/python3
"""N20 Home Dashboard - telemetry server."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json, os, re, socket, subprocess, time, threading
from datetime import datetime, timezone

HOST = os.environ.get("N20_DASHBOARD_HOST", "192.168.1.50")
PORT = int(os.environ.get("N20_DASHBOARD_PORT", "8080"))
ROOT = Path(os.environ.get("N20_DASHBOARD_ROOT",
    "/data/data/com.termux/files/home/n20-home-dashboard/public")).resolve()
ACTIVITY_LOG = Path(os.environ.get("N20_ACTIVITY_LOG",
    "/data/data/com.termux/files/home/n20-home-dashboard/activity.jsonl"))
WATCHDOG_STATUS = Path(os.environ.get("N20_WATCHDOG_STATUS",
    "/data/data/com.termux/files/home/.local/state/runit-supervisor-watchdog/status.json"))
PROBE_HOST = os.environ.get("N20_DASHBOARD_PROBE_HOST", "127.0.0.1")
MDNS = os.environ.get("N20_DASHBOARD_PUBLIC_NAME", "android-media.local")

_cache = {}
_cache_lock = threading.Lock()
_activity_lock = threading.Lock()

def _run(cmd, timeout=8):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.stdout
    except Exception:
        return ""

def _cached(key, fn, ttl):
    now = time.time()
    with _cache_lock:
        e = _cache.get(key)
        if e and (now - e["ts"]) < ttl:
            return e["data"]
    data = fn()
    with _cache_lock:
        _cache[key] = {"ts": now, "data": data}
    return data

def _parse_meminfo():
    out = _run("grep -E '^(MemTotal|MemFree|MemAvailable|Buffers|Cached|SReclaimable|Shmem|SwapTotal|SwapFree):' /proc/meminfo")
    fields = {}
    for line in out.strip().splitlines():
        parts = line.split(":")
        if len(parts) == 2:
            key = parts[0].strip()
            val = parts[1].strip().split()[0]
            try:
                fields[key] = int(val) * 1024
            except (ValueError, IndexError):
                pass
    return fields

def _parse_df(path):
    out = _run("df '%s' 2>/dev/null" % path)
    lines = out.strip().splitlines()
    if len(lines) >= 2:
        parts = lines[1].split()
        if len(parts) >= 5:
            try:
                return (int(parts[1])*1024, int(parts[2])*1024, int(parts[3])*1024, int(parts[4].replace("%","")))
            except (ValueError, IndexError):
                pass
    return None

def collect_host():
    model = _run("getprop ro.product.model").strip() or "SM-N985F"
    android_ver = _run("getprop ro.build.version.release").strip() or "13"
    up = _run("uptime").strip()
    load = {"one": 0.0, "five": 0.0, "fifteen": 0.0}
    m = re.search(r"load average:\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)", up)
    if m:
        load = {"one": round(float(m.group(1)),2), "five": round(float(m.group(2)),2), "fifteen": round(float(m.group(3)),2)}
    uptime_sec = None
    m2 = re.search(r"up\s+(\d+):(\d+)", up)
    if m2:
        try:
            uptime_sec = int(m2.group(1))*3600 + int(m2.group(2))*60
        except ValueError:
            pass
    return {"name": MDNS, "model": model, "android_version": android_ver, "uptime_seconds": uptime_sec, "loadavg": load}

def collect_battery():
    out = _run("termux-battery-status", timeout=5)
    try:
        d = json.loads(out)
        return {"percentage": d.get("percentage"), "status": d.get("status"), "plugged": d.get("plugged"), "temperature_c": d.get("temperature")}
    except (json.JSONDecodeError, TypeError):
        return {"percentage": None, "status": None, "plugged": None, "temperature_c": None}

def collect_wifi():
    out = _run("termux-wifi-connectioninfo", timeout=5)
    try:
        d = json.loads(out)
        ssid = d.get("ssid")
        if ssid and ssid.lower() in ("<unknown ssid>","<unknown>",""):
            ssid = None
        return {"ip": d.get("ip"), "rssi_dbm": d.get("rssi"), "frequency_mhz": d.get("frequency_mhz"), "link_speed_mbps": d.get("link_speed_mbps"), "ssid": ssid}
    except (json.JSONDecodeError, TypeError):
        return {"ip": PROBE_HOST, "rssi_dbm": None, "frequency_mhz": None, "link_speed_mbps": None, "ssid": None}

def collect_cpu():
    out = _run("""for i in 0 1 2 3 4 5 6 7; do
cur=$(cat /sys/devices/system/cpu/cpu$i/cpufreq/scaling_cur_freq 2>/dev/null || echo null)
mn=$(cat /sys/devices/system/cpu/cpu$i/cpufreq/scaling_min_freq 2>/dev/null || echo null)
mx=$(cat /sys/devices/system/cpu/cpu$i/cpufreq/scaling_max_freq 2>/dev/null || echo null)
echo "$i $cur $mn $mx"
done""", timeout=5)
    cores = []
    for line in out.strip().splitlines():
        parts = line.split()
        if len(parts) >= 4:
            cid = int(parts[0])
            cur = int(parts[1]) if parts[1] != "null" else None
            mn = int(parts[2]) if parts[2] != "null" else None
            mx = int(parts[3]) if parts[3] != "null" else None
            cores.append({"id": cid, "freq_mhz": round(cur/1000,0) if cur else None, "min_mhz": round(mn/1000,0) if mn else None, "max_mhz": round(mx/1000,0) if mx else None})
    return {"core_count": 8, "cores": cores}

def collect_memory():
    m = _parse_meminfo()
    return {"ram_total_bytes": m.get("MemTotal",0), "ram_available_bytes": m.get("MemAvailable",0), "ram_cached_bytes": m.get("Cached",0)+m.get("SReclaimable",0), "swap_total_bytes": m.get("SwapTotal",0), "swap_free_bytes": m.get("SwapFree",0)}

def _find_usb_mount():
    mounts = _run("grep -E 'media_rw.*sdfat|media_rw.*exfat' /proc/mounts")
    for line in mounts.strip().splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[1].startswith("/mnt/media_rw/"):
            return parts[1]
    return None

def collect_storage():
    usb_path = _find_usb_mount()
    usb = {"mounted": False, "readable": False, "total_bytes": 0, "used_bytes": 0, "available_bytes": 0, "use_pct": 0, "top_folders": []}
    if usb_path:
        result = _parse_df(usb_path)
        if result:
            total, used, avail, pct = result
            usb.update({"mounted": True, "total_bytes": total, "used_bytes": used, "available_bytes": avail, "use_pct": pct, "readable": os.path.isdir(usb_path)})
        if usb["mounted"] and usb["readable"]:
            top = _run("du -sh '%s'/* 2>/dev/null | sort -rh | head -10" % usb_path, timeout=30)
            for line in top.strip().splitlines():
                parts = line.split(None, 1)
                if len(parts) == 2:
                    usb["top_folders"].append({"name": Path(parts[1]).name, "size": parts[0]})
    internal_pct = 0
    result = _parse_df("/data")
    if result:
        internal_pct = result[3]
    return {"usb": usb, "internal": {"use_pct": internal_pct}}

def _probe_tcp(host, port, timeout=3):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((host, port))
        s.close()
        return True
    except Exception:
        return False

def _probe_http(url, timeout=4):
    try:
        r = subprocess.run(["curl","-fsS","-o","/dev/null","--max-time",str(timeout),url], capture_output=True, timeout=timeout+2)
        return r.returncode == 0
    except Exception:
        return False

def _sv_status(svc):
    out = _run('sv status "$PREFIX/var/service/%s" 2>/dev/null' % svc, timeout=3)
    if not out: return "unknown"
    if out.startswith("run:"): return "up"
    if out.startswith("down:"): return "down"
    return "unknown"

SVC_DEF = [
    {"id":"filebrowser","title":"FileBrowser Quantum","port":8088,"svc":"filebrowser-quantum","kind":"http","url":"http://%s:8088/" % MDNS},
    {"id":"audiobookshelf","title":"Audiobooks","port":13378,"svc":"audiobookshelf","kind":"http","url":"http://%s:13378/audiobookshelf/" % MDNS},
    {"id":"navidrome","title":"Music Jukebox","port":4533,"svc":"navidrome","kind":"http","url":"http://%s:4533/app/" % MDNS},
    {"id":"jellyfin","title":"Jellyfin","port":8096,"svc":"jellyfin","kind":"http","url":"http://%s:8096/" % MDNS},
    {"id":"samba","title":"Samba","port":1445,"svc":"smbd-android","kind":"tcp","url":None},
    {"id":"ssh","title":"SSH","port":8022,"svc":"sshd","kind":"tcp","url":None},
    {"id":"home-dashboard","title":"Home Dashboard","port":8080,"svc":"n20-home-dashboard","kind":"http","url":"http://%s:8080/" % MDNS},
    {"id":"local-llm","title":"Local LLM","port":11434,"svc":None,"kind":"tcp","url":None},
]

def collect_supervisor():
    fallback = {"state": "unknown", "last_check": None, "last_recovery": None, "reason": "status_missing", "action": "none"}
    try:
        d = json.loads(WATCHDOG_STATUS.read_text())
    except (OSError, json.JSONDecodeError):
        return fallback
    state = d.get("state") if d.get("state") in ("healthy", "degraded", "recovering") else "unknown"
    services = d.get("services") if isinstance(d.get("services"), dict) else {}
    checked = sum(1 for v in services.values() if isinstance(v, dict) and v.get("state") == "up")
    total = len(services)
    return {
        "state": state,
        "last_check": d.get("last_check"),
        "last_recovery": d.get("last_recovery"),
        "reason": d.get("reason", "unknown"),
        "action": d.get("action", "none"),
        "supervised_count": checked,
        "service_count": total,
        "usb_ready": bool(d.get("usb_ready")),
    }

def collect_services():
    result = []
    for s in SVC_DEF:
        reachable = _probe_http("http://%s:%d/" % (PROBE_HOST, s["port"])) if s["kind"]=="http" else _probe_tcp(PROBE_HOST, s["port"])
        sv = _sv_status(s["svc"]) if s["svc"] else "unknown"
        status = "healthy" if reachable and sv=="up" else ("degraded" if reachable or sv=="up" else "unhealthy")
        if s["id"]=="local-llm" and not reachable:
            status = "not_running"
        entry = {"id":s["id"],"title":s["title"],"status":status,"reachable":reachable,"supervisor":sv,"port":s["port"]}
        if s["url"]: entry["url"] = s["url"]
        result.append(entry)
    return result

def collect_status():
    host = _cached("host", collect_host, 15)
    battery = _cached("battery", collect_battery, 15)
    wifi = _cached("wifi", collect_wifi, 15)
    cpu = collect_cpu()
    memory = _cached("memory", collect_memory, 5)
    storage = _cached("storage", collect_storage, 60)
    services = collect_services()
    supervisor = collect_supervisor()
    all_up = all(s["reachable"] for s in services if s["id"]!="local-llm") and supervisor.get("state") in ("healthy", "unknown")
    return {"timestamp":datetime.now(timezone.utc).isoformat(),"online":all_up,"host":host,"battery":battery,"wifi":wifi,"cpu":cpu,"memory":memory,"storage":storage,"services":services,"supervisor":supervisor}

def append_activity(event, detail=""):
    with _activity_lock:
        try:
            ACTIVITY_LOG.parent.mkdir(parents=True, exist_ok=True)
            with open(ACTIVITY_LOG, "a") as f:
                f.write(json.dumps({"ts":datetime.now(timezone.utc).isoformat(),"event":event,"detail":detail})+"\n")
        except OSError:
            pass

def read_activity(n=30):
    with _activity_lock:
        try:
            if not ACTIVITY_LOG.exists(): return []
            lines = ACTIVITY_LOG.read_text().strip().splitlines()
            results = []
            for line in reversed(lines[-n:]):
                try: results.append(json.loads(line))
                except json.JSONDecodeError: pass
            return list(reversed(results))
        except OSError:
            return []

class H(SimpleHTTPRequestHandler):
    server_version = "N20Dashboard/1.0"
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)
    def do_GET(self):
        if self.path == "/api/status": return self._json(collect_status())
        if self.path == "/api/activity": return self._json(read_activity())
        return super().do_GET()
    def _json(self, data):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def list_directory(self, path):
        self.send_error(404); return None
    def end_headers(self):
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Referrer-Policy","no-referrer")
        self.send_header("Content-Security-Policy","default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'")
        self.send_header("Cache-Control","no-store")
        super().end_headers()
    def log_message(self, fmt, *a):
        print("%s - %s" % (self.address_string(), fmt % a), flush=True)

def main():
    if not (ROOT / "index.html").is_file():
        raise SystemExit("missing index.html under %s" % ROOT)
    ACTIVITY_LOG.parent.mkdir(parents=True, exist_ok=True)
    append_activity("dashboard_started", "N20 Home dashboard server started")
    httpd = ThreadingHTTPServer((HOST, PORT), H)
    print("N20 Dashboard serving at http://%s:%d/" % (HOST, PORT), flush=True)
    httpd.serve_forever()

if __name__ == "__main__":
    main()
