import { useState } from "react";
import { useApp } from "@/lib/store";
import { PanelHeader } from "../PanelHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  ShieldCheck,
  User,
  Download,
  Trash2,
  Upload,
  MoonStar,
  RotateCcw,
  Link2,
  KeyRound,
  RefreshCw,
  Send,
  Terminal,
} from "lucide-react";
import { PRAYERS, type PrayerName } from "@/lib/store";
import {
  isNotifySupported,
  getNotifyPermission,
  requestNotifyPermission,
  sendSystemNotification,
} from "@/lib/pwa";
import { tzName } from "@/lib/clock";
import { HudLabel } from "../HudLabel";
import { cn } from "@/lib/utils";
import { usePageEntrance } from "@/hooks/useGsapMotion";
import { AlarmSettingsPanel } from "../AlarmSettingsPanel";
import { testBridgeConnection, simulateBridgeEvent, stopBridge, startBridge } from "@/lib/bridge";

function BridgePanel() {
  const {
    bridgeEnabled,
    bridgeUrl,
    bridgePairingKey,
    bridgeStatus,
    bridgeLastSyncAt,
    bridgeLastError,
    bridgeLog,
    setBridgeConfig,
    regenerateBridgeKey,
    pushBridgeLog,
  } = useApp();
  const [url, setUrl] = useState(bridgeUrl);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);

  const save = () => {
    const clean = url.trim().replace(/\/+$/, "");
    setBridgeConfig({ bridgeUrl: clean });
    // Restart the poller so the new URL takes effect instantly.
    stopBridge();
    startBridge();
    toast.success("Bridge URL saved — reconnecting…");
  };

  const onTest = async () => {
    setTesting(true);
    const res = await testBridgeConnection();
    setTesting(false);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    pushBridgeLog(`Manual test: ${res.message}`, res.ok ? "success" : "error");
  };

  const statusColor =
    bridgeStatus === "online"
      ? "text-[var(--holo-green)]"
      : bridgeStatus === "connecting"
        ? "text-[var(--holo-amber)]"
        : "text-muted-foreground";

  return (
    <div className="glass-panel relative p-5 md:col-span-2">
      <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--accent)/50]" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link2 className="size-4 text-[var(--accent)]" />
        <HudLabel accent="cyan">J.A.R.V.I.S. Bridge</HudLabel>
        <span className="ml-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
          <span
            className={cn("size-1.5 rounded-full", bridgeStatus === "online" && "led-dot")}
            style={{
              color:
                bridgeStatus === "online"
                  ? "var(--holo-green)"
                  : bridgeStatus === "connecting"
                    ? "var(--holo-amber)"
                    : "#3a4552",
            }}
          />
          <span className={statusColor}>
            {bridgeStatus === "online"
              ? "Online"
              : bridgeStatus === "connecting"
                ? "Connecting…"
                : "Offline"}
          </span>
          {bridgeLastSyncAt && (
            <span className="text-muted-foreground/60">
              · last sync {new Date(bridgeLastSyncAt).toLocaleTimeString()}
            </span>
          )}
        </span>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Connect your own Python JARVIS core. It runs a small HTTP server on this machine (default{" "}
        <span className="font-mono text-foreground/80">http://127.0.0.1:8765</span>); this dashboard
        polls it every 2s for notifications, tasks and schedule blocks — and streams your activity
        back so J.A.R.V.I.S. always knows what you did. Full protocol + ready-to-run Python server:{" "}
        <span className="font-mono text-foreground/80">JARVIS-BRIDGE.md</span> in the repo.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">
            Core URL
          </Label>
          <div className="mt-1 flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://127.0.0.1:8765"
              className="font-mono text-xs"
            />
            <Button size="sm" onClick={save}>
              Save
            </Button>
          </div>
        </div>
        <div>
          <Label className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
            <KeyRound className="size-3" /> Pairing key
          </Label>
          <div className="mt-1 flex gap-2">
            <Input
              readOnly
              value={
                showKey ? bridgePairingKey : "•".repeat(Math.min(40, bridgePairingKey.length || 8))
              }
              onFocus={() => setShowKey(true)}
              className="font-mono text-xs"
              title="Click to reveal — then copy into your Python config"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                regenerateBridgeKey();
                toast.success("New pairing key generated — update your Python config.");
              }}
              title="Generate a new key"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-1.5">
          <Switch
            checked={bridgeEnabled}
            onCheckedChange={(v) => setBridgeConfig({ bridgeEnabled: v })}
          />
          <span className="text-xs">{bridgeEnabled ? "Bridge active" : "Bridge paused"}</span>
        </div>
        <Button size="sm" variant="secondary" onClick={onTest} disabled={testing}>
          <ShieldCheck className="mr-1.5 size-3.5" /> {testing ? "Testing…" : "Test connection"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            simulateBridgeEvent();
            pushBridgeLog("Test notification injected through the bridge ingest path");
          }}
        >
          <Send className="mr-1.5 size-3.5" /> Test event
        </Button>
        {bridgeLastError && (
          <span className="font-mono text-[10px] text-[var(--holo-pink)]">{bridgeLastError}</span>
        )}
      </div>

      {/* activity log */}
      <div className="mt-4 rounded-md border border-border bg-black/30 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <Terminal className="size-3" /> Bridge log
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {bridgeLog.length} entries
          </span>
        </div>
        {bridgeLog.length === 0 ? (
          <div className="py-2 text-center font-mono text-[10px] text-muted-foreground/50">
            Quiet. Events from your Python core will appear here.
          </div>
        ) : (
          <ul className="scroll-y-clean max-h-40 space-y-1">
            {bridgeLog.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-2 font-mono text-[10.5px] leading-snug"
              >
                <span className="shrink-0 text-muted-foreground/50">
                  {new Date(e.at).toLocaleTimeString("en-US", { hour12: false })}
                </span>
                <span
                  className={cn(
                    "shrink-0 uppercase",
                    e.level === "error"
                      ? "text-[var(--holo-pink)]"
                      : e.level === "success"
                        ? "text-[var(--holo-green)]"
                        : "text-muted-foreground",
                  )}
                >
                  {e.level}
                </span>
                <span className="min-w-0 flex-1 text-foreground/80">{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SettingsTab() {
  const {
    notificationsEnabled,
    setNotificationsEnabled,
    profile,
    setProfile,
    settings,
    setSetting,
    memory,
    clearMemoryNotes,
    customPrayerTimes,
    setCustomPrayerTime,
    clearCustomPrayerTimes,
    resetAll,
  } = useApp();
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.role);

  const onAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfile({ avatarDataUrl: String(reader.result) });
      toast.success("Avatar updated.");
    };
    reader.readAsDataURL(f);
  };

  const requestPerm = async () => {
    if (!isNotifySupported()) {
      toast.error("This browser does not support notifications.");
      return;
    }
    const res = await requestNotifyPermission();
    if (res === "granted") {
      setNotificationsEnabled(true);
      await sendSystemNotification("Chronos Vizier online", "Alert broadcast authorized.", {
        tag: `cv-perm-${Date.now()}`,
      });
      toast.success("Notifications authorized — test alert sent.");
    } else {
      toast.error("Permission denied. Check your browser/Windows notification settings.");
    }
  };

  const sendTest = async () => {
    const res = await requestNotifyPermission();
    if (res !== "granted") {
      toast.error("Notification permission is not granted.");
      return;
    }
    setNotificationsEnabled(true);
    const ok = await sendSystemNotification(
      "Chronos Vizier // Test Signal",
      "Windows notifications are live. Alert systems nominal.",
      { tag: `cv-test-${Date.now()}` },
    );
    if (ok) toast.success("Test notification delivered.");
    else {
      toast.error("Test failed — the OS suppressed it.", {
        description:
          "Check Windows: Settings ▸ System ▸ Notifications ▸ Chrome ▸ Notifications ▸ Allow. Focus Assist may also be blocking it.",
      });
    }
  };

  const perm = getNotifyPermission();

  const prayerOverrides = PRAYERS.filter((p) => customPrayerTimes[p.name]);
  const hasOverrides = prayerOverrides.length > 0;

  const gridRef = usePageEntrance<HTMLDivElement>("settings", {
    stagger: 0.07,
    y: 16,
    duration: 0.5,
  });

  const exportData = () => {
    const blob = new Blob([JSON.stringify(useApp.getState(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chronos-vizier-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded.");
  };

  return (
    <div>
      <PanelHeader
        eyebrow="System"
        title="System Core"
        subtitle="Bridge, broadcasts, identity and data."
      />

      <div ref={gridRef} className="grid gap-4 md:grid-cols-2">
        {/* Bridge — spans full width, the new centerpiece */}
        <BridgePanel />

        <div className="glass-panel relative p-5">
          <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--accent)/50]" />
          <div className="mb-4 flex items-center gap-2">
            <User className="size-4 text-[var(--accent)]" />
            <HudLabel accent="cyan">Operator Profile</HudLabel>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[image:var(--gradient-cyber)]">
                {profile.avatarDataUrl ? (
                  <img
                    src={profile.avatarDataUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <User className="size-6 text-background" />
                )}
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs transition hover:border-[var(--accent)]/50">
                  <Upload className="size-3.5" /> Upload avatar
                </span>
              </label>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                placeholder="Operator"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Role
              </Label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1"
                placeholder="Student / Engineer / Creator"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Timezone
              </Label>
              <Input value={tzName()} disabled className="mt-1" />
            </div>
            <Button
              size="sm"
              onClick={() => {
                setProfile({
                  name: name.trim() || "Operator",
                  role: role.trim() || "Operator",
                });
                toast.success("Profile saved.");
              }}
              className="w-full"
            >
              Save Profile
            </Button>
          </div>
        </div>

        <div className="glass-panel relative p-5">
          <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--holo-violet)/50]" />
          <div className="mb-4 flex items-center gap-2">
            <Bell className="size-4 text-[var(--holo-violet)]" />
            <HudLabel accent="violet">Alert Broadcast</HudLabel>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Native Windows/browser notifications fire on deadlines, milestones, schedule blocks and
            prayer times.
          </p>
          <div className="mb-3 flex items-center gap-3">
            <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
            <span className="text-sm">{notificationsEnabled ? "Broadcasting" : "Silent"}</span>
          </div>
          <div
            className={cn(
              "mb-3 flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em]",
              perm === "granted"
                ? "border-[oklch(0.8_0.16_155/0.35)] bg-[oklch(0.8_0.16_155/0.08)] text-[var(--holo-green)]"
                : perm === "default"
                  ? "border-[oklch(0.62_0.19_260/0.35)] bg-[oklch(0.62_0.19_260/0.08)] text-[var(--accent)]"
                  : "border-[oklch(0.72_0.24_350/0.4)] bg-[oklch(0.72_0.24_350/0.08)] text-[var(--holo-pink)]",
            )}
          >
            <span className="led-dot size-1.5" style={{ color: "currentColor" }} />
            OS Permission:{" "}
            {perm === "granted" ? "GRANTED" : perm === "default" ? "NOT REQUESTED" : "BLOCKED"}
          </div>
          <div className="mb-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Frequency
            </Label>
            <Select
              value={settings.notificationFrequency}
              onValueChange={(v) => setSetting("notificationFrequency", v as "critical" | "all")}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical only</SelectItem>
                <SelectItem value="all">All events</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={requestPerm} variant="secondary" className="flex-1">
              <ShieldCheck className="mr-2 size-4" />
              {perm === "granted" ? "Re-authorize" : "Authorize"}
            </Button>
            <Button
              onClick={sendTest}
              variant="secondary"
              className="flex-1 border-[oklch(0.62_0.19_260/0.3)] text-[var(--accent)] hover:bg-[oklch(0.62_0.19_260/0.1)]"
              title="Instantly verify Windows notifications"
            >
              <BellRing className="mr-2 size-4" />
              Test Alert
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            <b className="text-foreground/80">Closed-tab delivery:</b> while the app is open — or
            closed but the browser keeps running — alerts fire via the service worker. For alerts
            when the browser itself is fully shut down, install the app and keep the browser open.
          </p>
        </div>

        <div className="glass-panel relative p-5">
          <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--accent)/50]" />
          <div className="mb-4 flex items-center gap-2">
            <User className="size-4 text-[var(--accent)]" />
            <HudLabel accent="cyan">Assistant Memory</HudLabel>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Permanent notes your Python J.A.R.V.I.S. receives with every journal batch —
            preferences, identity rules, recurring facts.
          </p>
          <div className="rounded-md border border-border bg-background/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Memory notes
              </span>
              <span className="font-mono text-xs text-[var(--accent)]">{memory.notes.length}</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                clearMemoryNotes();
                toast.success("Assistant memory cleared.");
              }}
              className="w-full"
            >
              <Trash2 className="mr-1.5 size-3.5" /> Clear memory
            </Button>
          </div>
        </div>

        <div className="glass-panel relative p-5">
          <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--holo-green)/50]" />
          <div className="mb-4 flex items-center gap-2">
            <MoonStar className="size-4 text-[var(--holo-green)]" />
            <HudLabel accent="green">Namaz Timing Override</HudLabel>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Set the <b className="text-foreground/80">real</b> prayer times for your mosque / area.
            These override the auto-fetched times everywhere — dashboard, countdown, history and
            notifications.
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PRAYERS.map((p) => (
              <div key={p.name}>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {p.name}
                </Label>
                <Input
                  type="time"
                  value={customPrayerTimes[p.name as PrayerName] ?? p.time}
                  onChange={(e) => setCustomPrayerTime(p.name as PrayerName, e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest",
                hasOverrides
                  ? "border-[oklch(0.8_0.16_155/0.4)] bg-[oklch(0.8_0.16_155/0.08)] text-[var(--holo-green)]"
                  : "border-border text-muted-foreground/60",
              )}
            >
              <span
                className="led-dot size-1.5"
                style={{ color: hasOverrides ? "var(--holo-green)" : "#3a4552" }}
              />
              {hasOverrides
                ? `Manual times active · ${prayerOverrides.length} prayer${prayerOverrides.length > 1 ? "s" : ""}`
                : "Auto times (fetched by location)"}
            </span>
            {hasOverrides && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  clearCustomPrayerTimes();
                  toast.success("Reverted to auto prayer times.");
                }}
                className="text-[11px] text-muted-foreground hover:text-[var(--holo-pink)]"
              >
                <RotateCcw className="mr-1 size-3.5" /> Revert to auto
              </Button>
            )}
          </div>
        </div>

        <div className="glass-panel relative p-5">
          <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--accent)/50]" />
          <div className="mb-4 flex items-center gap-2">
            <Download className="size-4 text-[var(--accent)]" />
            <HudLabel accent="cyan">Data Export</HudLabel>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Download the full local state (tasks, schedule, prayers, memory) as JSON.
          </p>
          <Button onClick={exportData} variant="secondary" className="w-full">
            <Download className="mr-2 size-4" /> Export local state
          </Button>
        </div>

        <div className="glass-panel relative p-5 border-[var(--holo-pink)]/25">
          <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--holo-pink)/50]" />
          <div className="mb-4 flex items-center gap-2">
            <Trash2 className="size-4 text-[var(--holo-pink)]" />
            <HudLabel accent="pink">System Reset</HudLabel>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Irreversible. Wipes every streak, block, task, bridge key and memory note from this
            browser and reloads the app clean.
          </p>
          <Button
            onClick={() => {
              const ok = window.confirm(
                "WARNING: This will wipe all streaks, blocks, and logs from the system core. Proceed?",
              );
              if (!ok) return;
              resetAll();
            }}
            variant="secondary"
            className="w-full border border-[var(--holo-pink)]/40 text-[var(--holo-pink)] hover:bg-[var(--holo-pink)]/10"
          >
            <Trash2 className="mr-2 size-4" /> Reset App
          </Button>
        </div>
      </div>
    </div>
  );
}
