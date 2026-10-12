# Map Tool update – 2026-10-09 (Draft – pending approval)

Prepared for Samantha Lujan. Based on GitHub `bi-visitanaheim/anaheim-map-tool` `main` @ `4f5bcb5` ("82"), which is the commit live at https://anaheim-map-tool.vercel.app/.

## Which local folder is current?

Neither OneDrive folder matches the live app exactly.

| Source | Commit / state | Matches live? |
|---|---|---|
| Vercel production (anaheim-map-tool.vercel.app) | `4f5bcb5` "82" (Jul 24, 2026) | — |
| GitHub `main` | `4f5bcb5` "82" | Yes |
| OneDrive `anaheim-map-maker` | git clone of the same repo, last fetched at `0fbc20c`, 17 commits behind | Same project, out of date |
| OneDrive `anaheim-map-maker-main` | ZIP download, no git, no Supabase code (older version) | No |

Use **`anaheim-map-maker`** after running `git pull`. Don't use `anaheim-map-maker-main`.

## Changes

1. **Hotel 68** renamed: "Cambria Hotel & Suites Anaheim Resort" becomes "SpringHill Suites Theme Park/Fairfield Inn Theme Park". The address and the 0.9 mi distance stay the same.
2. **Hotel 67** (Hampton Inn & Suites, 100 W. Katella Ave.): distance from ACC changed from 2.8 mi to **0.9 mi**.
3. **New hotel 73**, SunCoast Park Hotel, 1640 S. Clementine St., Anaheim, **0.8 mi** from ACC.
   - The map position (x 82, y 21.3) is an **approximation**, placed between Element by Westin (1600 S. Clementine) and Clementine Hotel (1700 S. Clementine). It's stored as a fallback in `hotels.ts`. Supabase `hotel_positions` still wins whenever a row exists for that hotel.
   - Lat/lng are left `null`, the same as Stanford Inn (id 72), because no verified coordinates were available. The app doesn't use lat/lng.
4. **No selection limit.** The 20-hotel cap is gone, and the counter now reads "Select hotels (N selected)".
5. **PDF export fits every hotel on one page.** The legend picks its column count (1–5), width, font size and entry style automatically. It never shrinks the map below 60% of its full size. In tests the font was 10 pt for 25 or fewer hotels, 7.75 pt for 40, and 5.75 pt for all 73, all on a single page. Extra pages are used only if a selection can't fit at all.

## To deploy (after approval)

```bash
cd "<OneDrive>/Map Tool/anaheim-map-maker"
git checkout main
git pull                    # brings the folder up to 4f5bcb5 (live)
git am "<path>/0001-Hotel-data-updates-unlimited-selection-one-page-PDF-.patch"
npm run build               # optional local check
git push                    # Vercel auto-deploys main to production
```

If `git am` gives you trouble, copy the files in `changed-files/src/...` over the same paths, then commit and push.

**Optional (recommended):** add a canonical Supabase row for SunCoast once its pin position is confirmed on the map:

```sql
insert into hotel_positions (hotel_id, x, y) values ('73', 82, 21.3);
```

## Verification done

- `tsc --noEmit` and ESLint report no errors on the changed files, and `vite build` succeeds.
- A headless browser test ran against a production build with mocked Supabase data, using live positions read on 2026-10-09:
  - empty selection: Export is disabled
  - 1, 10, 22 (selected by clicking), 25, 40 and 73 hotels: all markers render, and each PDF is 1 page with no text off the page
- Sample exports are in `test-exports/`.

## Still needs checking

- SunCoast pin placement on the map.
- Name styling: "SpringHill" uses Marriott's brand capitalization, which also matches the rest of the dataset.
- Whether Supabase `selected_hotels` has a foreign key or check constraint that would reject hotel 73 or numbers above 20. This couldn't be checked with read-only access. If saving fails after deploy, add the `hotel_positions` row above.
