# CLAUDE.md — 如烟 · Mastery Path

Vanilla-JS PWA that teaches the guitar accompaniment for Mayday's 如烟 (王一编配, key A, no capo).
Live: https://choonang-lab.github.io/Ru-Yan-Guitar/ (GitHub Pages from `main`). No build step,
no framework. Node is only an offline test harness.

## Files
- `index.html` — the app (HTML + CSS + one bare inline `<script>`).
- `ruyan-song.js`, `player.js` — **vendored mirrors** of the canonical copies in the
  `choonang-lab/sheet-player` repo (song + strum + chord shapes; the SheetPlayer engine).
  Edit them THERE, then copy here and restore the one-line "VENDORED MIRROR" header.
- `sw.js` (network-first cache), `manifest.json`, `test-logic.js` (harness), `INTEGRATION.md` (history).

## Rules on every change
1. **Bump all four version markers together** on a shippable change, or phones serve stale files:
   `title="build">vN` in the header · `const CACHE = 'ruyan-vN'` in sw.js ·
   `ruyan-song.js?v=N` and `player.js?v=N` script URLs in index.html.
2. Parse-check, then run the harness — both must pass:
   `node -e "new Function(require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1]);console.log('parse OK')"`
   `node test-logic.js` (ALL GREEN). Any extra `<script>` tag must carry an attribute (e.g. `id=`),
   or the regex above picks up the wrong script.
3. **Every colour is a token** (`:root` + `:root[data-theme="dark"]`). Never hard-code a colour in
   CSS or generated markup; icons via `ico()`, never emoji. Chord diagrams are coloured by the
   `.cd-*` classes. Check both themes for contrast and phone width for sideways scroll.
4. **Lesson ids are progress keys** (localStorage `ruyan_lessons_v1`): never change or reuse one.
   On-screen numbers come from position (`lessonNo`). Meta lives in `ruyan_meta_v1`.
5. **Any new practice path must call `markDay()`** or that practice won't count toward the streak;
   show the streak with `curStreak()`.
6. Don't give host markup classes the player also uses (`.num`, `.bar`, `.note`, `.row`…): the
   inline player sits in this document and would inherit them.
7. Deploy only when the user says so (they say "push and merge"). Work on a branch.

## Pedagogy (v11, song-first)
Stages play the song from day 1 on **starter shapes** (Bm7 x20202, F#m7 xx4220, C#m7 x42100,
Fmaj7 xx3210 + open chords). Barres run alongside in the **Barre gym**: log strings ringing per day;
three logged days in a row at full strings swaps that barre into the song (`playShape`). Lessons
with `bpm:[start,goal]` have a tempo ladder up to 76 (the tab's tempo); their first standard is
ticked by "Clean twice at 76". Today = a 10-minute session (2 gym / 6 lesson / 2 play from the
top); "play from the top" = the longest run of started sections from the intro (`learntUpTo`).
