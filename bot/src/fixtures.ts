import { supabase } from "./database.js";

const GAMEWEEK_INTERVAL_DAYS = 3;

/**
 * Generate a complete home + away fixture list for a division.
 *
 * Each gameweek starts 3 days after the previous one.
 * Every team plays every other team home and away.
 */
export async function generateFixtures(
  divisionId: string,
  startDate = new Date(),
) {
  // Get division
  const { data: division, error: divisionError } =
    await supabase
      .from("divisions")
      .select("id, league_id, name, status, gameweek_interval_days")
      .eq("id", divisionId)
      .maybeSingle();

  if (divisionError) {
    console.error("Division lookup error:", divisionError);
    throw new Error("Couldn't find the division.");
  }

  if (!division) {
    throw new Error("Division doesn't exist.");
  }

  // Don't generate fixtures for an ended division
  if (division.status === "ended") {
    throw new Error("This division has already ended.");
  }

  // Get teams in this division
  const { data: teams, error: teamsError } =
    await supabase
      .from("teams")
      .select("id, name")
      .eq("division_id", divisionId)
      .order("name");

  if (teamsError) {
    console.error("Team lookup error:", teamsError);
    throw new Error("Couldn't load the division teams.");
  }

  if (!teams || teams.length < 2) {
    throw new Error(
      "You need at least 2 teams to generate fixtures.",
    );
  }

  // Check whether fixtures already exist
  const { count: existingFixtureCount, error: countError } =
    await supabase
      .from("fixtures")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("division_id", divisionId);

  if (countError) {
    console.error("Fixture count error:", countError);
    throw new Error("Couldn't check existing fixtures.");
  }

  if ((existingFixtureCount ?? 0) > 0) {
    throw new Error(
      "Fixtures already exist for this division.",
    );
  }

  // Check whether gameweeks already exist
  const { count: existingGameweekCount, error: gwCountError } =
    await supabase
      .from("gameweeks")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("division_id", divisionId);

  if (gwCountError) {
    console.error(
      "Gameweek count error:",
      gwCountError,
    );
    throw new Error("Couldn't check existing gameweeks.");
  }

  if ((existingGameweekCount ?? 0) > 0) {
    throw new Error(
      "Gameweeks already exist for this division.",
    );
  }

  /*
   * Circle method round-robin.
   *
   * If there is an odd number of teams, add a BYE.
   */
  const teamList = teams.map((team) => ({
    id: team.id,
    name: team.name,
  }));

  if (teamList.length % 2 !== 0) {
    teamList.push({
      id: "BYE",
      name: "BYE",
    });
  }

  const totalTeams = teamList.length;
  const gamesPerGameweek = totalTeams / 2;
  const totalGameweeksPerHalf = totalTeams - 1;

  const firstHalf: Array<
    Array<{
      homeTeamId: string;
      awayTeamId: string;
    }>
  > = [];

  let rotation = [...teamList];

  for (
    let round = 0;
    round < totalGameweeksPerHalf;
    round++
  ) {
    const matches: Array<{
      homeTeamId: string;
      awayTeamId: string;
    }> = [];

    for (let i = 0; i < gamesPerGameweek; i++) {
      const teamA = rotation[i];
      const teamB =
        rotation[totalTeams - 1 - i];

      if (
        teamA.id === "BYE" ||
        teamB.id === "BYE"
      ) {
        continue;
      }

      /*
       * Alternate home advantage so the fixture list
       * isn't heavily biased toward one side.
       */
      if (round % 2 === 0) {
        matches.push({
          homeTeamId: teamA.id,
          awayTeamId: teamB.id,
        });
      } else {
        matches.push({
          homeTeamId: teamB.id,
          awayTeamId: teamA.id,
        });
      }
    }

    firstHalf.push(matches);

    // Keep the first team fixed and rotate the rest.
    rotation = [
      rotation[0],
      rotation[totalTeams - 1],
      ...rotation.slice(1, totalTeams - 1),
    ];
  }

  /*
   * Second half is the reverse of the first half.
   * Home and away are swapped.
   */
  const secondHalf =
    firstHalf.map((matches) =>
      matches.map((match) => ({
        homeTeamId: match.awayTeamId,
        awayTeamId: match.homeTeamId,
      })),
    );

  const allGameweeks = [
    ...firstHalf,
    ...secondHalf,
  ];

  const intervalDays =
    division.gameweek_interval_days ??
    GAMEWEEK_INTERVAL_DAYS;

  const gameweekRows = allGameweeks.map(
    (_, index) => {
      const startsAt = new Date(startDate);

      startsAt.setDate(
        startsAt.getDate() +
          index * intervalDays,
      );

      return {
        division_id: divisionId,
        number: index + 1,
        starts_at: startsAt.toISOString(),
      };
    },
  );

  // Create gameweeks
  const { data: createdGameweeks, error: gameweekError } =
    await supabase
      .from("gameweeks")
      .insert(gameweekRows)
      .select("id, number, starts_at");

  if (gameweekError || !createdGameweeks) {
    console.error(
      "Gameweek creation error:",
      gameweekError,
    );

    throw new Error(
      "Couldn't create the gameweeks.",
    );
  }

  /*
   * Create fixture rows.
   *
   * Every fixture gets the start time of its gameweek.
   */
  const fixtureRows: Array<{
    league_id: string;
    division_id: string;
    home_team_id: string;
    away_team_id: string;
    kickoff_at: string;
    status: string;
    home_score: null;
    away_score: null;
    gameweek: number;
  }> = [];

  for (
    let gameweekIndex = 0;
    gameweekIndex < allGameweeks.length;
    gameweekIndex++
  ) {
    const matches =
      allGameweeks[gameweekIndex];

    const gameweek =
      createdGameweeks.find(
        (gw) =>
          gw.number ===
          gameweekIndex + 1,
      );

    if (!gameweek) {
      throw new Error(
        `Couldn't find created Gameweek ${gameweekIndex + 1}.`,
      );
    }

    for (const match of matches) {
      fixtureRows.push({
        league_id: division.league_id,
        division_id: divisionId,
        home_team_id: match.homeTeamId,
        away_team_id: match.awayTeamId,
        kickoff_at: gameweek.starts_at,
        status: "scheduled",
        home_score: null,
        away_score: null,
        gameweek: gameweek.number,
      });
    }
  }

  // Insert all fixtures
  const { error: fixtureError } =
    await supabase
      .from("fixtures")
      .insert(fixtureRows);

  if (fixtureError) {
    console.error(
      "Fixture creation error:",
      fixtureError,
    );

    // Roll back gameweeks if fixture creation fails.
    await supabase
      .from("gameweeks")
      .delete()
      .eq("division_id", divisionId);

    throw new Error(
      "Couldn't create the fixtures.",
    );
  }

  return {
    divisionId,
    divisionName: division.name,
    teamCount: teams.length,
    gameweekCount: allGameweeks.length,
    fixtureCount: fixtureRows.length,
    intervalDays,
  };
}
