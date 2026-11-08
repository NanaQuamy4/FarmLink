# FarmLink

A web platform that connects landowners who have idle farmland with youth farmers, and records the partnership from agreement to harvest split.

**Stack:** React 18 + Vite, Bootstrap 5 (custom theme), Supabase (Auth, PostgreSQL with Row Level Security, Realtime, Storage), Leaflet + OpenStreetMap, jsPDF and SheetJS for reports.

## Run it

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL editor**, paste the whole of `supabase/setup_all.sql` and run it. This creates the tables, rules, storage buckets and demo data.
3. Copy `.env.example` to `.env.local` and fill in the **Project URL** and **anon key** from *Project Settings → API*. Never use the `service_role` key in the app.
4. In *Authentication → URL Configuration*, set the Site URL to where the app runs (e.g. `http://localhost:5173`).
5. `npm install`, then `npm run dev`.

`npm test` runs the harvest split unit tests and the database tests (business rules and RLS, in an embedded Postgres). `npm run db:bundle` rebuilds `setup_all.sql` after changing a migration.

## Demo accounts

All passwords: `FarmLink#2026`. The login page has one-click buttons for these in development.

| Email | Role | What to try |
|---|---|---|
| ama@farmlink.test | Landowner (Bono East) | Review the Nkoranza group’s application, follow the Techiman deal, list a plot |
| kwame@farmlink.test | Farmer | Active season on the Techiman plot, post an update, record the harvest |
| group@farmlink.test | Farmer group (6 members) | Search and apply as a group |
| efua@farmlink.test | Farmer (Volta) | Completed season, ratings, produce listing |
| yaw@farmlink.test | Landowner (Volta) | Completed deal, rejected plot to fix and resubmit |
| officer@farmlink.test | Verifier, extension officer | Verify the Kintampo plot, mediate the open dispute, host sessions |
| community@farmlink.test | Verifier, community | Volta and Eastern regions |
| admin@farmlink.test | Administrator | Approve Samuel’s verifier request, reports and exports |
| buyer@farmlink.test | Buyer | Offers on tomatoes and pineapples |

## Where each feature lives

| ID | Where |
|---|---|
| FR1 | `src/pages/auth/*`, `src/app/guards.jsx`, roles in `profiles`, RLS in `0003_rls.sql` |
| FR2 | `src/pages/app/plots/PlotForm.jsx` (photos, map pin, documents) |
| FR3 | `src/pages/app/plots/FindLand.jsx` (filters, list and map) |
| FR4 | `Applications.jsx`, `ApplicationDetail.jsx`, `respond_to_application()` |
| FR5 | `src/components/ChatThread.jsx` (Supabase Realtime) |
| FR6 | `AgreementTab.jsx`, `propose_agreement()`, `confirm_agreement()` |
| FR7 | `SeasonTab.jsx`, `season_milestones` |
| FR8 | `src/lib/harvestSplit.js` and `calculate_harvest_split()`, `record_harvest()` |
| FR9 | `VerifyPlot.jsx`, `verify_plot()`, `DisputeTab.jsx`, `Disputes.jsx`, `update_dispute()` |
| FR10 | Notification triggers in `0002_functions.sql`, `NotificationBell.jsx` |
| FR11 | `AdminOverview.jsx`, `Admin.jsx` reports, `src/lib/exportReport.js` (PDF, Excel) |
| FR12 | `community/Groups.jsx` (groups, notice board, group chat) |
| FR13–14 | `community/Sessions.jsx`, `join_session()` records attendance |
| FR15–16 | `community/Market.jsx`, `respond_to_offer()` |
| FR17 | `ratings`, `community/PublicProfile.jsx`, `profile_stats()` |

## Design decisions

- **Video sessions open Jitsi Meet in a new tab** instead of embedding it. The public meet.jit.si server no longer allows embedding beyond a 5-minute demo; a new tab is free and unlimited. Attendance is recorded when the user clicks Join.
- **Sign-in is by email.** Phone sign-in needs a paid SMS provider. The phone number is stored on the profile (privately) and used for verification calls.
- **21 tables, not 20.** Phone numbers live in a separate `profile_contacts` table so they are only visible to the user, their deal partner, the assigned verifier and admins.
- **Plots stay hidden until verified** (Objective 1). Where a region has no verifier, an administrator can verify.
- **Harvest split rule:** the agreed input deduction is taken off the top and given to whoever supplied the inputs; the rest is split by percentage; rounding leftovers go to the farmer so the shares always add up.
- **Farmer groups** are farmer accounts marked as a group (name and member count), not a separate login.

## Photo credits

Landing page photos are from Wikimedia Commons (CC BY / CC BY-SA, authors listed on `/credits`) and Freepik (free licence, attribution on `/credits`).
