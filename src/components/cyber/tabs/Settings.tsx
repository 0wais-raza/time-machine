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
import { Bell, KeyRound, ShieldCheck, User, Brain, Download, Trash2, Upload, Cpu } from "lucide-react";
import { requestNotifyAndShow } from "@/lib/pwa";
import { tzName } from "@/lib/clock";

export function SettingsTab() {
  const {
    geminiKey,
    setGeminiKey,
    notificationsEnabled,
    setNotificationsEnabled,
    profile,
    setProfile,
    settings,
    setSetting,
    memory,
    clearMemoryNotes,
    resetAll,
  } = useApp();
  const [tmp, setTmp] = useState(geminiKey);
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
    if (!("Notification" in window)) {
      toast.error("Browser does not support notifications.");
      return;
    }
    const res = await Notification.requestPermission();
    if (res === "granted") {
      setNotificationsEnabled(true);
      await requestNotifyAndShow("Vizier online", "Alert broadcast authorized.");
      toast.success("Notifications authorized.");
    } else {
      toast.error("Permission denied.");
    }
  };

  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify(useApp.getState(), null, 2)],
      { type: "application/json" },
    );
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass-panel p-5">
          <div className="mb-3 flex items-center gap-2">
            <User className="size-4 text-[var(--neon-cyan)]" />
            <h3 className="text-sm font-bold uppercase tracking-widest">Operator Profile</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative size-16 overflow-hidden rounded-md bg-[image:var(--gradient-cyber)] flex items-center justify-center shrink-0">
                {profile.avatarDataUrl ? (
                  <img src={profile.avatarDataUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <User className="size-6 text-background" />
                )}
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs hover:border-[var(--neon-cyan)]/50 transition">
                  <Upload className="size-3.5" /> Upload avatar
                </span>
              </label>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Callsign</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="CyberVizier" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Role</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1" placeholder="AI Engineer / Digital Creator" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Timezone</Label>
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

        <div className="glass-panel p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="size-4 text-[var(--neon-violet)]" />
            <h3 className="text-sm font-bold uppercase tracking-widest">Alert Broadcast</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Native browser notifications fire only on critical events:
            deadlines, milestone thresholds, and schedule changes.
          </p>
          <div className="flex items-center gap-3 mb-3">
            <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
            <span className="text-sm">{notificationsEnabled ? "Broadcasting" : "Silent"}</span>
          </div>
          <div className="mb-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Frequency
            </Label>
            <Select
              value={settings.notificationFrequency}
              onValueChange={(v) =>
                setSetting("notificationFrequency", v as "critical" | "all")
              }
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
          <Button onClick={requestPerm} variant="secondary" className="w-full">
            <ShieldCheck className="size-4 mr-2" />
            Authorize System Alert Broadcast
          </Button>
        </div>

        <div className="glass-panel p-5">
          <div className="mb-3 flex items-center gap-2">
            <Brain className="size-4 text-[var(--neon-violet)]" />
            <h3 className="text-sm font-bold uppercase tracking-widest">AI Processing</h3>
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
              <span className="font-mono text-xs text-[var(--neon-cyan)]">
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

        <div className="glass-panel p-5">
          <div className="mb-3 flex items-center gap-2">
            <Download className="size-4 text-[var(--neon-cyan)]" />
            <h3 className="text-sm font-bold uppercase tracking-widest">Data Export</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Download the full local state (tasks, schedule, prayers, chats) as JSON.
          </p>
          <Button onClick={exportData} variant="secondary" className="w-full">
            <Download className="size-4 mr-2" /> Export local state
          </Button>
        </div>

        <div className="glass-panel p-5 border-[var(--neon-pink)]/30">
          <div className="mb-3 flex items-center gap-2">
            <Trash2 className="size-4 text-[var(--neon-pink)]" />
            <h3 className="text-sm font-bold uppercase tracking-widest">System Reset</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Irreversible. Wipes every streak, block, task, chat session and memory note
            from this browser and reloads the app clean.
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
            className="w-full border border-[var(--neon-pink)]/40 text-[var(--neon-pink)] hover:bg-[var(--neon-pink)]/10"
          >
            <Trash2 className="size-4 mr-2" /> Reset App
          </Button>
        </div>

        <div className="glass-panel p-5 md:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="size-4 text-[var(--neon-pink)]" />
            <h3 className="text-sm font-bold uppercase tracking-widest">OpenRouter API Key</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Stored locally in this browser only. Required to operate The Vizier. Routes through
            <span className="font-mono"> openrouter.ai/api/v1 </span> using model
            <span className="font-mono"> {settings.aiModel}</span>.
          </p>
          <div className="mb-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Cpu className="size-3" /> Model (non-OpenAI only)
            </Label>
            <Select
              value={settings.aiModel}
              onValueChange={(v) => setSetting("aiModel", v)}
            >
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
                setGeminiKey(tmp.trim());
                toast.success("OpenRouter key saved locally.");
              }}
            >
              Save
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground font-mono">
            Status: {geminiKey ? `Configured (${geminiKey.slice(0, 6)}…)` : "Not configured"}
          </p>
        </div>
      </div>
    </div>
  );
}