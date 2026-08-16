import {
  LayoutDashboard,
  Moon,
  ListChecks,
  CalendarClock,
  BarChart3,
  Settings,
  Cpu,
  User as UserIcon,
} from "lucide-react";
import { useApp, type TabKey } from "@/lib/store";
import { cn } from "@/lib/utils";

const items: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "namaz", label: "Namaz", icon: Moon },
  { key: "todo", label: "Tasks", icon: ListChecks },
  { key: "schedule", label: "Schedule", icon: CalendarClock },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "workbench", label: "PC Workbench & Store", icon: Cpu },
];

export function Sidebar() {
  const { activeTab, setActiveTab, profile } = useApp();
  return (
    <aside className="fixed left-0 top-0 bottom-0 z-30 flex w-60 flex-col border-r border-border bg-sidebar">
      {/* Profile header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-[image:var(--gradient-cyber)] flex items-center justify-center">
          {profile.avatarDataUrl ? (
            <img src={profile.avatarDataUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <UserIcon className="size-5 text-primary-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {profile.name || "Operator"}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {profile.role || "Role"}
          </div>
        </div>
      </div>

      {/* Workspace nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-2 pb-2 text-[11px] font-medium text-muted-foreground">
          Workspace
        </div>
        <ul className="space-y-0.5">
          {items.map((it) => {
            const Icon = it.icon;
            const active = activeTab === it.key;
            return (
              <li key={it.key}>
                <button
                  onClick={() => setActiveTab(it.key)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate font-medium">{it.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer settings */}
      <div className="border-t border-border px-2 py-3">
        <button
          onClick={() => setActiveTab("settings")}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
            activeTab === "settings"
              ? "bg-accent/15 text-accent"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
          )}
        >
          <Settings className="size-4" />
          <span>System Core</span>
        </button>
      </div>
    </aside>
  );
}