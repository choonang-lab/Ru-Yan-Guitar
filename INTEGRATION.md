# Integration sketch — merging the Sheet Player into the Mastery Path

Two apps describe the **same song** from two angles:

| | **Sheet Player** (`sheet-player`) | **Mastery Path** (this repo) |
|---|---|---|
| Role | The *player* | The *coach* |
| Has | `SONG.sections` data (23 sections), Web-Audio guitar engine, per-section `STRUM` patterns, tempo control, note+lyric highlight, per-section play | Graded curriculum (9 modules, checkpoints), **correct chord diagrams** (SVG, barres), progress tracking, metronome |
| Lacks | chord diagrams, curriculum, capo/fingering | the actual tab/notation, song audio, strum-pattern display |

Neither is complete alone. The learner should **read the bars, hear them, and follow the graded path in one place.** This is the plan to get there.

> **Root-cause note.** The bridge-chord divergence we just fixed (`Dm` vs `D`) happened because each app keeps its *own* copy of the song's chords. The single most important structural fix below is **Phase 1: one shared song-data file** — after that, the two apps cannot drift again.

---

## The data bridge: lesson → song section

Both apps already agree on the 23-section structure. The only missing link is an explicit map from each lesson to the Sheet Player section(s) it covers:

```js
// ruyan-section-map.js  (new)
const SECTION_MAP = {
  '3.3': ['Intro','间奏 (muted A)'],
  '4.1': ['Verse 1','Pre-chorus 1a 她的脸 (soft)','Pre-chorus 1b 有没有…不能在'],
  '4.2': ['Verse 2','Pre-chorus 2a 和眷恋 (soft)','Pre-chorus 2b 眼泪…机会将'],
  '5.1': ['Chorus 1','我欠了他…有没有 (E)','星星太阳万物都听我的指挥'],
  '5.2': ['Chorus 2','月亮不忙着圆缺…能听见'],
  '6.1': ['耳际眼前此生重演是我 (转C)'],
  '6.2': ['Bridge 来自漆黑 (转C)'],
  '6.3': ['我又是谁 (转C, soft)','Chorus 3 玫瑰 (转A)'],
  '7.1': ['Chorus 3b 诗篇','Chorus 4 花瓣','Chorus 4b 苦痛'],
  '8.1': ['Outro 双眼…无法无天','能听见 我不要告别 (palm-mute)','已经如烟 (roll, let ring)'],
  // Module 9 (integration) → whole song
};
```

Section names are the join key, so they must match exactly across both apps — another reason to share one data file.

---

## Phased plan

### Phase 0 — done
- Metronome added to the Mastery Path (Web-Audio click, look-ahead scheduler, tap tempo; lesson tempo chips launch it at their target BPM).
- Bridge chords reconciled to the Sheet Player's crop-verified reading (`D`, not `Dm`).

### Phase 1 — one source of truth for the song *(highest value, low risk)*
Extract `SONG` + the "expand to full song form" rebuild out of `sheet-player/index.html` into a standalone `ruyan-song.js` that both apps load:

```js
// ruyan-song.js
window.RUYAN_SONG = { title:'如烟 · 五月天', key:'A', bpm:76, beatsPerBar:4, sections:[ ... ] };
```

- Sheet Player: `const SONG = window.RUYAN_SONG;`
- Mastery Path: read progressions and strum patterns from the same object instead of hard-coding chord lists in the road map / lessons.

After this, a chord change edited once shows up correctly in both apps. **This is the durable fix for the divergence class of bug.**

### Phase 2 — give the player a control API
Teach `sheet-player` to accept a launch state via URL hash (cheapest) or `postMessage` (cleaner for an embed):

```js
// in sheet-player play/init
const p = new URLSearchParams(location.hash.slice(1));
// #section=Chorus%201&bpm=70&chordsOnly=1&loop=1
if (p.get('bpm'))       $('#bpm').value = +p.get('bpm');
if (p.get('chordsOnly'))$('#chk-melody').checked = false;
const secName = p.get('section');
if (secName) {
  const si = current.sections.findIndex(s => s.name === secName);
  if (si >= 0) play(current, si);      // player already supports play-from-section
}
```
Add a `loop` flag: when the transport reaches the end of the target section, restart it (small change to the `stop`-scheduling at the tail of `play()`).

### Phase 3 — embed the player inside each lesson
In the Mastery Path lesson detail, add a **"▶ Hear this section"** button next to the existing "♪ … · click" metronome chip. It opens the player in a modal iframe, scoped to the lesson's mapped section, **chords-only** (accompaniment focus) at the lesson's tempo:

```js
function hearSection(id){
  const secs = SECTION_MAP[id]; if(!secs) return;
  const l = lessonById(id), bpm = parseInt(l.tempo,10) || 76;
  const hash = `#section=${encodeURIComponent(secs[0])}&bpm=${bpm}&chordsOnly=1&loop=1`;
  openPlayerModal(`player/index.html${hash}`);   // player bundled under /player
}
```
Now a learner on "Chorus 1" taps once and hears exactly that section's accompaniment loop at 80 BPM, while reading the standards to pass.

### Phase 4 — surface what the player already knows
- **Strum display (fixes review gap #3):** the player's `STRUM` object encodes down/up/muted per beat. Render it as a `↓ ↓↑ ↓ ↓↑` / `×` strip in Module 3's strumming lessons, pulled from the shared data — no more "read the arrows in your tab."
- **Chord chips ↔ diagrams:** make each chord in the player's chip line link to this app's diagram for that chord, and each progression in the road map pull its exact order from `SONG.sections`.

### Phase 5 — optional full merge
Inline the player's audio + render module directly into this PWA so it's one offline app (one service worker, one install). More work; do it only once Phases 1–4 prove the UX.

---

## Division of authority (avoid re-diverging)
- **Progressions, section order, strum patterns, timing** → owned by `ruyan-song.js` (the player's verified data).
- **Chord shapes / fingering / capo** → owned by this app's chord-diagram reference.
- Everything cross-references those two; nothing re-states them.

## Effort / risk
| Phase | Effort | Risk | Payoff |
|---|---|---|---|
| 1 shared song data | S | low | kills the divergence bug class |
| 2 player hash API | S | low | makes the player embeddable |
| 3 lesson embed | M | low | read + hear + practise in one place |
| 4 strum + chord links | M | low | closes the last review gaps |
| 5 full inline merge | L | med | single PWA, best UX |

Recommended order: **1 → 2 → 3 → 4**, stopping to test after each. Phase 1 alone is worth doing immediately regardless of the rest.
