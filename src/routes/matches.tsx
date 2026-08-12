import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useFavourites } from "@/hooks/useFavourites";
import { listFixturesBetween } from "@/lib/nova/api";
import { addDays, buildDateRange, fullDate, isoDay, startOfDay } from "@/lib/nova/dates";
import { DateStrip } from "@/components/nova/DateStrip";
import { MatchCard, MatchMiniPreview } from "@/components/nova/Cards";
import { EmptyState, PageHeader, SectionHeader } from "@/components/nova/Primitives";

export const Route = createFileRoute("/matches")({
  head: () => ({
    meta: [
      { title: "Match Days — NOVA VRFS" },
      {
        name: "description",
        content: "Browse NOVA VRFS match days two weeks either side of today, with kick-off times and scores.",
      },
      { property: "og:title", content: "Match Days — NOVA VRFS" },
      { property: "og:description", content: "Every NOVA VRFS fixture, day by day." },
    ],
  }),
  component: MatchesPage,
});

function MatchesPage() {
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const days = useMemo(() => buildDateRange(new Date()), []);
  const { idsOf } = useFavourites();
  const favTeams = idsOf("team");

  const from = days[0]!;
  const to = addDays(days[days.length - 1]!, 1);

  const { data, isLoading } = useQuery({
    queryKey: ["fixtures-range", isoDay(from), isoDay(to)],
    queryFn: () => listFixturesBetween(from.toISOString(), to.toISOString()),
  });

  const fixtures = data ?? [];

  const byDay = useMemo(() => {
    const map: Record<string, typeof fixtures> = {};
    for (const f of fixtures) {
      const key = isoDay(new Date(f.kickoff_at));
      (map[key] ??= []).push(f);
    }
    return map;
  }, [fixtures]);

  const counts = useMemo(
    () => Object.fromEntries(Object.entries(byDay).map(([k, v]) => [k, v.length])),
    [byDay],
  );

  const selectedKey = isoDay(selected);
  const selectedFixtures = byDay[selectedKey] ?? [];
  const isToday = selectedKey === isoDay(new Date());

  const otherUpcoming = fixtures
    .filter((f) => isoDay(new Date(f.kickoff_at)) !== selectedKey && new Date(f.kickoff_at) > new Date())
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader title="Match days" subtitle="Two weeks before and after today" />

      <DateStrip days={days} selected={selected} onSelect={setSelected} counts={counts} />

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="nova-label">{isToday ? "Today" : "Selected day"}</p>
            <h2 className="truncate text-lg font-black">{fullDate(selected)}</h2>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {selectedFixtures.length} {selectedFixtures.length === 1 ? "match" : "matches"}
          </span>
        </div>

        {isLoading ? (
          <div className="nova-panel px-3 py-6 text-center text-sm text-muted-foreground">
            Loading fixtures…
          </div>
        ) : selectedFixtures.length === 0 ? (
          <EmptyState
            title={isToday ? "No matches today." : "No matches."}
            description="This date is still shown so you can see the full match-day calendar."
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedFixtures.map((f) => (
              <MatchCard
                key={f.id}
                fixture={f}
                favourited={
                  favTeams.includes(f.home_team_id ?? "") || favTeams.includes(f.away_team_id ?? "")
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Upcoming elsewhere" />
        {otherUpcoming.length === 0 ? (
          <EmptyState title="No other upcoming matches in this window." />
        ) : (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {otherUpcoming.map((f) => (
              <MatchMiniPreview key={f.id} fixture={f} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Full calendar" />
        <div className="space-y-3">
          {days.map((day) => {
            const key = isoDay(day);
            const list = byDay[key] ?? [];
            return (
              <div key={key}>
                <button
                  onClick={() => setSelected(day)}
                  className="mb-1.5 block w-full text-left text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  {fullDate(day)}
                </button>
                {list.length === 0 ? (
                  <p className="nova-panel px-3 py-2 text-xs text-muted-foreground">
                    {key === isoDay(new Date()) ? "No matches today." : "No matches."}
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((f) => (
                      <MatchCard key={f.id} fixture={f} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
