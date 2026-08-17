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
  KeyRound,
  ShieldCheck,
  User,
  Brain,
  Download,
  Trash2,
  Upload,
  Cpu,
  MoonStar,
  RotateCcw,
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

export function SettingsTab() {
  const {
    openrouterKey,
    setOpenrouterKey,
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
  const [tmp, setTmp] = useState(openrouterKey);
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
      await sendSystemNotification("J.A.R.V.I.S. online", "Alert broadcast authorized, Sir.", {
        // Unique tag per call so a re-test is never suppressed as a "duplicate".
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
      "J.A.R.V.I.S. // Test Signal",
      "Windows notifications are live, Sir. Alert systems nominal.",
      // Unique tag per test — repeated tests always re-display.
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
    a.download = `cybertime-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded.");
  };

  return (
    <div>
      <PanelHeader
        eyebrow="Tab 06 / Core"
        title="System Core"
        subtitle="Configure broadcast layer & intelligence credentials."
      />

      <div ref={gridRef} className="grid gap-4 md:grid-cols-2">
        <div className="glass-panel relative p-5">
          <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--holo-cyan)/50]" />
          <div className="mb-4 flex items-center gap-2">
            <User className="size-4 text-[var(--holo-cyan)]" />
            <HudLabel accent="cyan">Operator Profile</HudLabel>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative size-16 overflow-hidden rounded-md bg-[image:var(--gradient-cyber)] flex items-center justify-center shrink-0">
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
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs hover:border-[var(--holo-cyan)]/50 transition">
                  <Upload className="size-3.5" /> Upload avatar
                </span>
              </label>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Callsign
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                placeholder="CyberVizier"
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
                placeholder="AI Engineer / Digital Creator"
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
          <p className="text-xs text-muted-foreground mb-3">
            Native Windows/browser notifications fire on deadlines, milestone thresholds, schedule
            blocks and prayer times.
          </p>
          <div className="flex items-center gap-3 mb-3">
            <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
            <span className="text-sm">{notificationsEnabled ? "Broadcasting" : "Silent"}</span>
          </div>
          {/* Live permission status */}
          <div
            className={cn(
              "mb-3 flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em]",
              perm === "granted"
                ? "border-[oklch(0.8_0.16_155/0.35)] bg-[oklch(0.8_0.16_155/0.08)] text-[var(--holo-green)]"
                : perm === "default"
                  ? "border-[oklch(0.85_0.17_200/0.35)] bg-[oklch(0.85_0.17_200/0.08)] text-[var(--holo-cyan)]"
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
              className="flex-1 border-[oklch(0.85_0.17_200/0.3)] text-[var(--holo-cyan)] hover:bg-[oklch(0.85_0.17_200/0.1)]"
              title="Instantly verify Windows notifications"
            >
              <BellRing className="mr-2 size-4" />
              Test Alert
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            <b className="text-foreground/80">Closed-tab delivery:</b> while the app is open — or
            closed but the browser keeps running — alerts fire via the service worker. For alerts
            when the browser itself is fully shut down, install the app and keep the browser open,
            or use a native wrapper (Web Push needs a push server).
          </p>
        </div>

        <div className="glass-panel relative p-5">
          <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--holo-violet)/50]" />
          <div className="mb-4 flex items-center gap-2">
            <Brain className="size-4 text-[var(--holo-violet)]" />
            <HudLabel accent="violet">AI Processing</HudLabel>
          </div>
          <div className="mb-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Response depth
            </Label>
            <Select
              value={settings.aiDepth}
              onValueChange={(v) => setSetting("aiDepth", v as "fast" | "deep")}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fast">Fast (concise)</SelectItem>
                <SelectItem value="deep">Deep (analytical)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border border-border bg-background/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Memory notes
              </span>
              <span className="font-mono text-xs text-[var(--holo-cyan)]">
                {memory.notes.length}
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                clearMemoryNotes();
                toast.success("Vizier memory cleared.");
              }}
              className="w-full"
            >
              <Trash2 className="size-3.5 mr-1.5" /> Clear Vizier memory
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
                <RotateCcw className="size-3.5 mr-1" /> Revert to auto
              </Button>
            )}
          </div>
        </div>

        <div className="glass-panel relative p-5">
          <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--holo-cyan)/50]" />
          <div className="mb-4 flex items-center gap-2">
            <Download className="size-4 text-[var(--holo-cyan)]" />
            <HudLabel accent="cyan">Data Export</HudLabel>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Download the full local state (tasks, schedule, prayers, chats) as JSON.
          </p>
          <Button onClick={exportData} variant="secondary" className="w-full">
            <Download className="size-4 mr-2" /> Export local state
          </Button>
        </div>

        <div className="glass-panel relative p-5 border-[var(--holo-pink)]/25">
          <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--holo-pink)/50]" />
          <div className="mb-4 flex items-center gap-2">
            <Trash2 className="size-4 text-[var(--holo-pink)]" />
            <HudLabel accent="pink">System Reset</HudLabel>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Irreversible. Wipes every streak, block, task, chat session and memory note from this
            browser and reloads the app clean.
          </p>
          <Button
            onClick={() => {
              const ok = window.confirm(
                "WARNING: This will wipe all streaks, blocks, and logs from the system core. Proceed, Sir?",
              );
              if (!ok) return;
              resetAll();
            }}
            variant="secondary"
            className="w-full border border-[var(--holo-pink)]/40 text-[var(--holo-pink)] hover:bg-[var(--holo-pink)]/10"
          >
            <Trash2 className="size-4 mr-2" /> Reset App
          </Button>
        </div>

        <div className="glass-panel relative p-5 md:col-span-2">
          <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--holo-pink)/50]" />
          <span className="pointer-events-none absolute right-0 top-0 size-2.5 border-r-2 border-t-2 border-[var(--holo-pink)/50]" />
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="size-4 text-[var(--holo-pink)]" />
            <HudLabel accent="pink">OpenRouter API Key</HudLabel>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Your OpenRouter key is stored <b className="text-foreground">only in this browser</b>
            (localStorage) and is sent <b className="text-foreground">only to openrouter.ai</b> —
            never to any other server, never logged, never committed to the repo. As a build-time
            fallback you may set
            <span className="font-mono"> VITE_OPENROUTER_API_KEY</span> in a local
            <span className="font-mono"> .env</span> (see
            <span className="font-mono"> .env.example</span>).
          </p>
          <div className="mb-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Cpu className="size-3" /> Model (non-OpenAI only)
            </Label>
            <Select value={settings.aiModel} onValueChange={(v) => setSetting("aiModel", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openrouter/auto">Auto (Recommended)</SelectItem>
                <SelectItem value="openai/gpt-4o-mini">GPT-4o mini</SelectItem>
                <SelectItem value="openai/gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                <SelectItem value="anthropic/claude-3-haiku">Claude 3 Haiku</SelectItem>
                <SelectItem value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk-or-…"
              value={tmp}
              onChange={(e) => setTmp(e.target.value)}
            />
            <Button
              onClick={() => {
                setOpenrouterKey(tmp.trim());
                toast.success("OpenRouter key saved locally.");
              }}
            >
              Save
            </Button>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
            <ShieldCheck
              className={
                openrouterKey
                  ? "size-3.5 text-[var(--holo-green)]"
                  : "size-3.5 text-muted-foreground/60"
              }
            />
            Status: {openrouterKey ? "Configured — stored in this browser only" : "Not configured"}
            {!openrouterKey && import.meta.env.VITE_OPENROUTER_API_KEY && (
              <span className="text-[var(--holo-cyan)]">
                {" "}
                · VITE_OPENROUTER_API_KEY fallback active
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
