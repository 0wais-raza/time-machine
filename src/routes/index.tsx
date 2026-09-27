import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/cyber/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chronos Vizier — Command Dashboard" },
      {
        name: "description",
        content:
          "Personal command dashboard: timetable focus, deep-work timers, Namaz precision, task analytics — wired to your own J.A.R.V.I.S. core.",
      },
      { property: "og:title", content: "Chronos Vizier" },
      {
        property: "og:description",
        content: "Personal command dashboard for time, discipline and deep focus.",
      },
    ],
  }),
  component: AppShell,
});
