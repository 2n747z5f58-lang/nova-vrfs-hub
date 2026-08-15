# NOVA VRFS Hub

Build NOVA as a complete, professional, mobile-first VRFS football league platform.

THIS IS A LARGE FOUNDATION BUILD. MAXIMIZE THE AMOUNT OF FUNCTIONALITY COMPLETED IN THIS GENERATION.

CREDIT EFFICIENCY IS EXTREMELY IMPORTANT:

Complete as much of this specification as possible in one generation.

Do not ask unnecessary questions.

Do not repeatedly redesign components.

Do not spend generation time on tiny cosmetic changes.

Prioritize working functionality, architecture, routing, database structure and the complete UI.

Build reusable components so future changes require minimal work.

Do not delete or replace existing functionality to implement another feature.

Do not create fake authentication or pretend an external integration works when it is not connected.

If an external credential/configuration is required, create the correct integration structure and clearly identify the required environment variable/configuration.

Do not waste credits on unnecessary animations, gradients or decorative effects.

==================================================




NOVA BRAND

Name: NOVA

NOVA is a competitive VRFS football league/platform.

IMPORTANT TERMINOLOGY:

Use “VRFS” rather than generic “Football” wherever the platform is describing the game.

NOVA itself remains the brand name.

Do not copy real-world league branding.

DESIGN:

Professional esports/sports platform.

Predominantly dark interface.

Near-black/dark charcoal main backgrounds.

White/light grey text.

Subtle grey borders and surfaces.

Do NOT make white the primary background.

Avoid excessive gradients.

Clean, sharp and modern.

Avoid making every element a giant rounded card.

Mobile-first.

Must look excellent on iPhone/Mobile Safari as well as desktop.

==================================================




GLOBAL NAVIGATION

Create navigation for:

Home
Dashboard
Matches
Leagues
Teams
Players
Standings
Results
Favourites
Notifications
Profile
Admin

On mobile, use a compact navigation system that keeps the important sections easily accessible.

==================================================




HOME PAGE

Create a professional NOVA homepage containing:

NOVA branding

Short NOVA description

Featured/upcoming matches

Recent results

Featured leagues

Featured teams

Featured players

Favourite-related information for signed-in users

Sign in / Connect Discord button

Clear navigation

==================================================




AUTHENTICATION

Prepare the application for real Supabase authentication.

Discord should be the intended authentication provider.

IMPORTANT:

Do NOT create a fake login.

Do NOT pretend Discord is connected when it is not.

Keep authentication modular.

Never expose secrets in frontend code.

Use environment variables.

Prepare the project for Supabase Discord OAuth.

==================================================




USER PROFILES

Profiles should support:

Username

Display name

Avatar

Discord account

Discord ID

Favourite leagues

Favourite teams

Favourite players

Notifications

Preferences

==================================================




FAVOURITE SYSTEM ⭐

Create a complete favourites system.

Users must be able to favourite:

Leagues

Teams

Players

Each user’s favourites must appear in a dedicated “Favourites” section.

The user should be able to:

Add a league to favourites

Remove a league from favourites

Add a team to favourites

Remove a team from favourites

Add a player to favourites

Remove a player from favourites

The favourite state should be visible throughout the application.

For example:

Favourite button on team pages

Favourite button on player pages

Favourite button on league pages

Filled/active state when already favourited

==================================================




FAVOURITE NOTIFICATIONS

Users should receive notifications for things involving their favourites.

If a user favourites a LEAGUE, notify them when:

New fixtures are released

Matches are upcoming

A relevant match is scheduled/approaching

Other important league events occur

If a user favourites a TEAM, notify them when:

The team has an upcoming match

The team is playing today

A new fixture is released

The team receives a result

Relevant team events occur

If a user favourites a PLAYER, notify them when:

Their player has an upcoming match

Their player is playing

The player scores a goal

The player is transferred

The player changes team

Relevant player events occur

Create a notification centre where users can see:

Notification type

Related league/team/player

Message

Timestamp

Read/unread state

Use a proper notification data structure so these notifications can later be generated automatically by backend logic.

==================================================




FOLLOWING / PINNED TEAMS

Users should be able to follow teams.

Followed teams must be pinned to the top of team lists.

Example:

FOLLOWING
⭐ Team A
⭐ Team B

OTHER TEAMS
Team C
Team D
Team E

The ordering should automatically update when a user follows/unfollows a team.

==================================================




MATCH DAY SYSTEM 📅

Create a complete match-day browsing system.

The Matches page must show match days covering approximately two weeks before and two weeks after the current date.

The date navigation should include:

Yesterday

Today

Tomorrow

Then the surrounding dates

Approximately two weeks before

Approximately two weeks after

The current day should be clearly highlighted.

Each date is selectable.

When a date is selected, show every match scheduled for that date.

IMPORTANT:
Even when there are ZERO matches, the date must still appear.

For example:

TODAY
Wednesday 12 August

No matches today.

Do NOT hide dates with no matches.

Instead display:

“No matches today.”

For other dates with no matches:

“Thursday 13 August
No matches.”

==================================================




MATCH DAY CARDS

For each selected date, display matches as professional match cards.

Each match card should contain:

Home team

Away team

Team logos

Match time

Competition

League/division

Match status

Score if completed

If a match is not happening today, it can still be displayed in the date browsing system.

==================================================




UPCOMING MATCH MINI-SCREENS

If a user is browsing a different date and there is an upcoming match, support a compact match preview/mini-screen.

Example:

THURSDAY

14:30

Team A
vs
Team B

League Name

This should feel like a small match preview rather than taking over the entire page.

==================================================




MATCHES PAGE

Create:

Date selector

Yesterday / Today / Tomorrow controls

Two-week date range

Match cards

Empty-day states

Match details

Upcoming match previews

Favourite-related indicators

Example:

< Yesterday
TODAY
Tomorrow >

Wednesday 12 August

No matches today.

Thursday 13 August

14:30
Team A vs Team B

Friday 14 August

No matches.

==================================================




LEAGUES

Create a league directory.

Each league supports:

Name

Logo

Description

Season

Divisions

Teams

Fixtures

Results

Standings

Statistics

League page sections:

Overview
Standings
Fixtures
Results
Teams
Statistics

Users can favourite leagues.

==================================================




DIVISIONS

Support multiple divisions within leagues.

Each division should have:

Teams

Fixtures

Results

Standings

Statistics

==================================================




TEAMS

Create a complete team system.

Team directory:

Team logo

Team name

League

Division

Follow/favourite button

Followed teams pinned at top

Team page:

Logo

Name

League/division

Players

Staff

Upcoming fixtures

Results

Statistics

Favourite/follow button

==================================================




PLAYERS

Create a player directory with:

Search

Player cards

Player profiles

Player profile:

Username

Avatar

Discord account

Team

Position

Statistics

Appearances

Goals

Assists

Other relevant VRFS statistics

Favourite button

==================================================




FIXTURES

Fixtures should support:

Date

Time

Home team

Away team

League

Division

Status

Match details

Fixtures must feed into:

Match-day system

League pages

Team pages

Player pages

Favourite notifications

Standings

==================================================




RESULTS

Create completed match results.

Result page/card:

Home team

Away team

Final score

Date

Competition

Division

Match statistics where available

When a result is recorded, standings should be designed to update automatically.

==================================================




STANDINGS

Create professional league tables containing:

Position
Team
Played
Won
Drawn
Lost
Goals For
Goals Against
Goal Difference
Points

Support automatic calculation from results.

==================================================




TRANSFERS

Create the foundation for player transfers.

A transfer should contain:

Player

Previous team

New team

Date

Optional transfer details

When a favourite player is transferred, create a notification for users who favourite that player.

==================================================




GOALS / PLAYER EVENTS

Create the foundation for match/player events.

Support:

Goals

Player involved

Match

Team

Timestamp/minute where applicable

When a favourited player scores, generate a notification.

==================================================




NOTIFICATIONS

Create a dedicated Notifications page.

Support:

Unread/read states

Timestamps

Notification categories

Favourite-related notifications

Match notifications

Goal notifications

Transfer notifications

Fixture release notifications

Show an unread notification indicator in navigation.

==================================================




ADMIN / OVERSEER SYSTEM

Create an admin/Overseer dashboard.

Admins should be able to manage:

Leagues

Divisions

Teams

Players

Staff

Fixtures

Results

Transfers

Player events

Users

Roles

Notifications

Platform settings

Admin pages should use proper forms and tables.

Prepare role-based permissions so normal users cannot access administrative actions.

==================================================




SUPABASE DATABASE ARCHITECTURE

Prepare the application for Supabase.

Suggested tables:

profiles
leagues
divisions
teams
team_members
players
fixtures
results
standings
staff
user_roles
favourites
notifications
transfers
match_events

Important relationships:

profiles → favourites
profiles → notifications
profiles → team memberships
leagues → divisions
divisions → teams
divisions → fixtures
fixtures → results
fixtures → match events
players → teams
players → transfers
players → match events

Use proper relational structures rather than duplicating information.

==================================================




FAVOURITES DATABASE

The favourites system should support:

user_id
item_type
item_id
created_at

item_type can represent:

league
team
player

This should make the system scalable.

==================================================




NOTIFICATIONS DATABASE

Notifications should support:

id
user_id
type
title
message
related_type
related_id
read
created_at

This allows notifications to link directly to the relevant league/team/player/match.

==================================================




SECURITY

Never expose service-role keys.

Never expose Discord client secrets.

Use environment variables.

Use proper authentication.

Prepare admin permissions for secure server-side validation.

Sensitive operations should be handled through Supabase Edge Functions/server-side logic where required.

==================================================




DISCORD

Prepare real Discord OAuth integration.

Users should eventually be able to:

Sign in with Discord

Connect Discord to an existing account

View their Discord username

View their Discord avatar

Store Discord ID securely

Do not fake a Discord connection.

==================================================




MOBILE EXPERIENCE

This is extremely important.

Design primarily for iPhone.

Make:

Navigation mobile-friendly

Match cards responsive

Standings horizontally scrollable

Admin tables usable on mobile

Forms easy to use

Buttons large enough to tap

Date navigation swipe/scroll friendly

Favourites easy to access

Notifications easy to read

Desktop should still look professional.

==================================================




DATA / EMPTY STATES

Do not hide sections simply because there is no data.

For example:

Matches:

Wednesday 12 August

No matches today.

Teams:

No teams available yet.

Results:

No results yet.

Make empty states professional and useful.

==================================================




ARCHITECTURE

Keep these concerns separated:

UI/components
Routing
Authentication
Database access
Notifications
Admin logic
External integrations

Use reusable components for:

Match cards

Team cards

Player cards

League cards

Standings tables

Date selectors

Favourite buttons

Notification items

Admin tables

Forms

==================================================




FINAL REQUIREMENT

Build as much of the above as possible NOW.

Do not stop after creating a landing page.

Create the complete application shell, all major routes/pages, responsive layouts, reusable components, database-ready architecture, favourites system, match-day system, notification architecture, team following/pinning, league/division structure, fixtures, results, standings, transfers, player events and admin/Overseer interfaces.

If an external integration cannot be fully connected without credentials, build everything around it correctly and leave clearly defined environment-variable/configuration points.

MAXIMIZE FUNCTIONALITY PER GENERATION.

Do not waste this generation on minor cosmetic changes.

Logos attached.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f314a190-1f1b-4c9e-afc9-643188ee4b50).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
