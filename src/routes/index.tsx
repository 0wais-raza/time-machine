import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/cyber/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chronos Vizier — AI Command Control" },
      {
        name: "description",
        content:
          "Tactical AI Chief of Staff: mission briefs, deep-focus timers, Namaz precision, schedule matrix, XP analytics.",
      },
      { property: "og:title", content: "Chronos Vizier" },
      {
        property: "og:description",
        content: "High-performance AI command control for missions, time, and discipline.",
      },
    ],
  }),
  component: AppShell,
});
