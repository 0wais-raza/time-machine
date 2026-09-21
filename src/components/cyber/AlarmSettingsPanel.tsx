import { useApp, RINGTONES } from "@/lib/store";
import { previewRingtone, stopRingtone } from "@/lib/ringtones";
import { HudLabel } from "./HudLabel";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlarmClock, Music4, Volume2, Timer, BellPlus, Play, Square } from "lucide-react";
import { useState } from "react";

export function AlarmSettingsPanel() {
  const { alarmSettings, setAlarmSetting } = useApp();
  const a = alarmSettings;
  const [previewing, setPreviewing] = useState<string | null>(null);

  const preview = (name: string) => {
    if (previewing === name) {
      stopRingtone();
      setPreviewing(null);
      return;
    }
    previewRingtone(name as Parameters<typeof previewRingtone>[0], a.volume);
    setPreviewing(name);
    window.setTimeout(() => setPreviewing((p) => (p === name ? null : p)), 2500);
  };

  return (
    <div className="glass-panel relative p-5 md:col-span-2">
      <span className="pointer-events-none absolute left-0 top-0 size-2.5 border-l-2 border-t-2 border-[var(--holo-amber)/50]" />
      <div className="mb-4 flex items-center gap-2">
        <AlarmClock className="size-4 text-[var(--holo-amber)]" />
        <HudLabel accent="amber">Alarm System</HudLabel>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Left: master + triggers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-[oklch(0.82_0.16_80/0.3)] bg-[oklch(0.82_0.16_80/0.05)] px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Alarm Master</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                {a.enabled ? "Armed — will ring at trigger times" : "Disarmed — silent system"}
              </div>
            </div>
            <Switch checked={a.enabled} onCheckedChange={(v) => setAlarmSetting("enabled", v)} />
          </div>

          <div className="space-y-2.5">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Ring when
            </Label>
            {(
              [
                ["onBlockStart", "Timetable block starts"],
                ["onPrayerTime", "Prayer time arrives"],
                ["onExamSession", "Study session for a near exam"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between py-0.5">
                <span className="flex items-center gap-2 text-xs text-foreground/85">
                  <BellPlus className="size-3 text-muted-foreground" />
                  {label}
                </span>
                <Switch
                  checked={a[key]}
                  onCheckedChange={(v) => setAlarmSetting(key, v)}
                  disabled={!a.enabled}
                />
              </div>
            ))}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Volume2 className="size-3" /> Volume
              </Label>
              <span className="font-mono text-[10px] tabular-nums text-[var(--holo-cyan)]">
                {Math.round(a.volume * 100)}%
              </span>
            </div>
            <Slider
              value={[a.volume * 100]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) => setAlarmSetting("volume", v / 100)}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Timer className="size-3" /> Auto-stop
              </Label>
              <span className="font-mono text-[10px] tabular-nums text-[var(--holo-cyan)]">
                {a.durationSec}s
              </span>
            </div>
            <Slider
              value={[a.durationSec]}
              min={3}
              max={60}
              step={1}
              onValueChange={([v]) => setAlarmSetting("durationSec", v)}
            />
          </div>
        </div>

        {/* Right: ringtone picker */}
        <div>
          <Label className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Music4 className="size-3" /> Ringtone
          </Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {RINGTONES.map((r) => {
              const selected = a.ringtone === r.name;
              return (
                <button
                  key={r.name}
                  onClick={() => setAlarmSetting("ringtone", r.name)}
                  onDoubleClick={() => preview(r.name)}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all duration-200",
                    selected
                      ? "border-[oklch(0.82_0.16_80/0.6)] bg-[oklch(0.82_0.16_80/0.1)] shadow-[0_0_18px_oklch(0.82_0.16_80/0.15)]"
                      : "border-border bg-[oklch(1_1_1/0.02)] hover:border-[oklch(0.85_0.17_200/0.4)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border transition",
                      selected
                        ? "border-[oklch(0.82_0.16_80/0.5)] bg-[oklch(0.82_0.16_80/0.15)]"
                        : "border-border",
                    )}
                  >
                    <Music4
                      className={cn(
                        "size-3.5",
                        selected ? "text-[var(--holo-amber)]" : "text-muted-foreground",
                      )}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold">{r.label}</span>
                    <span className="block truncate font-mono text-[9px] text-muted-foreground">
                      {r.hint}
                    </span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      preview(r.name);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        preview(r.name);
                      }
                    }}
                    className={cn(
                      "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border transition",
                      previewing === r.name
                        ? "border-[var(--holo-cyan)] bg-[oklch(0.85_0.17_200/0.15)] text-[var(--holo-cyan)]"
                        : "border-border text-muted-foreground hover:border-[var(--holo-cyan)]/50 hover:text-[var(--holo-cyan)]",
                    )}
                    title="Preview"
                  >
                    {previewing === r.name ? (
                      <Square className="size-2.5" />
                    ) : (
                      <Play className="size-2.5" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Ringtones are synthesized in the browser (zero downloads). Click selects; the play
            button previews. Alarms ring while the app is open — pair with Broadcast
            notifications for closed-tab alerts.
          </p>
        </div>
      </div>
    </div>
  );
}
