# Account-consent prototype design review (A/B/C)

Senior design and UX review of the account-consent prototypes requested by the
2026-08-20 handoff. Reviewed as product designs, not only visual polish.

## Header block

- **Scope** — the three panels of
  `/tmp/klicker-assessment-account-prototype/index.html`: A (current
  createAccount baseline), B (createAccount with research + Learning Analytics
  decisions), C (assessment access via Switch edu-ID). States: initial, LA
  Ja/Nein, research Zulassen/Widersprechen, confirmation checked/unchecked,
  submit gating, accordions open, C notice-link jump, toast. Viewports:
  1200×1400 (panels at their fixed 1055px OLAT width), 700px (stacked squeeze
  zone), 375px (mobile). Locale: de only (the prototype ships only German).
- **Method** — full code read of `index.html` (297 lines, single file) plus a
  live browser pass against `python3 -m http.server 4173` in the Claude Code
  browser pane (Chromium-based, macOS). Hydration proven before any
  interaction finding (A's confirmation checkbox toggles submit). Geometry and
  contrast measured via in-page JS, not eyeballed. Single evaluator:
  severities are single-rater provisional (NN/g: one evaluator finds ~35% of
  problems). The prototype is throwaway code outside the repository; there is
  no commit hash — the snapshot is the file's 2026-08-20 16:26 mtime.
- **Frameworks** — Nielsen/Krug usability lens with the 0–4 severity scale;
  visual-craft lens informed by refactoring-ui; WCAG 2.2 AA spot checks
  (contrast, target size, live regions, name-in-label). Numeric rubric scoring
  is deliberately omitted: the prototype's visual system is explicitly not the
  system that ships, so a band score would rate throwaway CSS. Severities are
  kept.
- **Evidence** — states are reproducible from each finding's prose (panel +
  viewport + actions). Reference screenshots from the origin session live in
  the prototype directory (`three-page-comparison-*.png`); this review relied
  on live states, not those files.
- **Prior work integrated** — the 2026-08-20 handoff (review brief, settled
  semantics) and the Agy `gemini-3.7-flash-high` review recorded in it.

## Delta vs. prior review (Agy)

- **Fixed and confirmed live**: excessive B/C density (compact 3-item data
  summaries, accordions default-closed, dense chart removed); alarm-like
  warning panel (replaced by the neutral lock-note and a plain mechanics
  list); redundant analytics detail (single example card remains).
- **Still open, carried forward**: repeated status information (now F2/F3 —
  chips + LA status lines still double-encode the LA choice); repeated research
  wording (now F15 — legacy accordions and the new research section explain
  research twice without cross-reference); formal/informal language mismatch
  (now F10 — needs a decision, not a patch).
- **Ruled, not reopened**: research opt-out default; LA forced explicit
  choice with no default; submit gating on confirmation + LA; profile
  visibility fixed on in B; A kept untouched as baseline.

## Findings

Severity scale: 0 none · 1 cosmetic · 2 minor · 3 major · 4 catastrophic.
All severity-2+ findings below were visually confirmed in the live prototype
unless marked `(code)`.

### Severity 3

| ID | Finding |
|----|---------|
| F1 | **All-green dead submit.** In B and C, keep the research default "Zulassen", choose LA "Ja, teilnehmen", and leave the legal confirmation unchecked: both footer chips render green ("Forschung: zugelassen", "Learning Analytics: Ja"), yet submit stays disabled and swallows clicks. In every choice combination the chip row is silent about the confirmation — the one gating input the user may still need to act on — so the strongest completeness signal on the page misleads at the exact moment the user is stuck (worst in the all-green case, verified live). Violates visibility of system status and error prevention. Verified at 1200px on B; C shares the identical `syncSubmit` path (index.html:294, footers :227/:253). Fix directions: add a third chip for the confirmation, or replace `disabled` with `aria-disabled` + a pointed inline message on attempted submit, or visually mark the confirmation row as required once both decisions are made. |

### Severity 2

| ID | Finding |
|----|---------|
| F2 | **Two color languages for one state.** A selected "Widersprechen"/"Nein, nicht teilnehmen" card renders success-green (selection acknowledged — the right, consent-neutral call), while the footer chip and the LA status line recolor the same valid choice warning-amber ("Forschung: widersprochen", "Learning Analytics: Nein"). Green at the control, amber in the summary frames a legitimate "no" as a problem — a neutrality concern for consent UX, and an internal inconsistency. The unused `.choice-card.warn` style (index.html:122) is a leftover of the abandoned amber-card direction and should go. Chips should mark only *missing* input (amber) and treat both completed answers as neutral/done. Anchors: index.html:131–133, 146–149, 287–292. |
| F3 | **Duplicate live regions (code-inferred).** Each LA choice updates two `aria-live="polite"` elements at once — the inline status line and the footer chip (B: index.html:224 + :227) — so screen readers can be expected to announce the selection twice in different words ("Learning Analytics deaktiviert" then "Learning Analytics: Nein"); no screen-reader run was performed. Research choices update only the chip (their status elements don't exist — see F13). Keep one live region per fact; make the chip row `aria-hidden` or drop its live attribute. |
| F4 | **Contrast and type-size floor.** Measured ratios: choice-card copy on the checked green card 4.42:1 at 11px (index.html:121/127); `chip.warn strong` #9a7000 on #fff8e5 4.22:1 at the 10px chip size (colors :148–149, size :146) — this is the "Auswahl erforderlich" emphasis, the one chip that must be readable; A's unchecked confirmation red #dc2626 on #f1f5f9 4.41:1 at 11px (:81–82, baseline carry-over). All below WCAG AA 4.5:1 for normal text. Beyond the failures, 10px runs (chips, guarantees, analytics-note) are below any comfortable floor for consent-relevant text; in implementation use the design system's smallest sanctioned body size and re-check. |
| F5 | **One control pattern for two legal regimes.** Both sections sit under a single "Freiwillig: deine Entscheidungen" heading and use the identical two-up radio-card pattern, so at the interaction level an opt-out objection about *exports* and a mandatory explicit consent about *collection* look and feel like the same kind of question. The kickers do state the difference ("Standard: zugelassen" vs "Ausdrückliche Wahl erforderlich"), and LA carries more visual weight (example card, guarantees) — but the regime distinction lives in one line of 11px text while the controls scream "same thing". Differentiate above the kicker level: carry the state into the H4 line itself, or use a different control shape for the objection (e.g. a single toggle-out affordance) than for the forced binary choice. The handoff's conflation worry is real but structural, not copy-level. |
| F6 | **Scroll depth in the OLAT embed.** At 1055px, closed-accordion heights: A 594px, B 866px, C 832px; B's decision footer starts 773px from panel top. In an OLAT iframe of typical 600–800px height the required-choice signals and submit sit below the fold while the profile fields fill the first screen. Mitigations if embed heights are confirmed short: sticky decision footer inside the embed, or move the chip summary into the right pane above the fold. The in-flow amber "Auswahl erforderlich" status at the LA control (index.html:224) already helps once the user scrolls. |
| F10 | **Sie/du language split needs a decision.** C's approved notice is Sie-form ("Falls Sie der Verwendung … widersprechen möchten, wählen Sie «Widersprechen»") inside an otherwise du-form screen whose footer confirmation references that notice; B mixes new lowercase-du copy with the legacy capitalized-Du accordion texts. This is not a copy bug to patch — it needs the deliberate decision the handoff asks for (see decision callouts). |
| F12 | **Aggregate-retention clause reads as fine print and dangles.** "Bestehende Aggregate bleiben erhalten; sie werden nicht sofort neu berechnet" (index.html:224/250) is the hardest concept on the page and invites "when, then?" with no answer. Either the product truthfully commits to "werden nicht neu berechnet" or the actual recalculation trigger is named. The wording cannot be finalized until that semantic is pinned (decision callout D3). |
| F14 | **Confirmation row ergonomics.** The legally binding confirmation is a 19px checkbox (below the 24px WCAG 2.5.8 comfort floor; the clickable label mitigates) beside 11px text that at 1055px runs ~150 characters per line — far past readable measure for the one sentence users must actually parse. Cap the measure (~80ch), raise to the design system's body size, 24px control. Anchors: index.html:82–84, 144. |
| F15 | **Two uncoordinated research explanations in B.** The legacy accordion ("Wie werden meine Daten genutzt?" — anonymised research use, lecturers obliged to inform) and the new research decision section describe the same processing with different framing and no cross-reference; a careful reader cannot tell whether these are one regime or two. The legal-text set needs one consistency pass once the in-app objection is approved (D1); at minimum the new section should reference the accordion as the authoritative description. Anchors: index.html:217 vs :223. |

### Severity 1

| ID | Finding |
|----|---------|
| F7 | **Dead whitespace in C's left column.** With accordions closed, C's left-pane content ends 548px into an 832px panel, leaving 192px of empty space above the footer. Opening "Hinweis zur Datennutzung" by default would fill it (dead space drops to ~14px) *and* put the notice the confirmation references on screen — worth doing regardless of layout (the user confirms having read a text that is otherwise hidden behind an accordion). |
| F8 | **Glyph semantics.** The lock-note icon is "♧" — a card club suit standing in for a lock (index.html:106); summary icons "⚿ ◉ ▤ ◷" render inconsistently across platforms. The inline summary icons are aria-hidden (correct), but the lock glyph is CSS `::before` generated content with no aria-hidden, so screen readers expose it as noise inside C's key boundary sentence. In implementation use the design-system icon set with proper hiding. |
| F9 | **Accessible names diverge from visible headings.** Radiogroups carry constructed aria-labels ("Learning Analytics normale Seite", "Forschungsnutzung Assessment") instead of `aria-labelledby` to the visible section headings (index.html:223–224, 249–250). Related: the analytics example card puts `aria-label` on a role-less div (index.html:224, :250), which browsers do not expose — give it a real heading or a role plus `aria-labelledby` in implementation. |
| F11 | **A's profile-visibility control.** A is the untouched baseline, correctly so. The open question is the product page — covered as decision callout D4. |
| F13 | **Research feedback asymmetry (code).** `connectResearch` writes to status elements (`normal-research-status`) that don't exist — a guarded dead path (index.html:287, 293). LA gets an inline textual confirmation; research only gets the moving card highlight plus the distant chip. Harmless in the prototype; in implementation either add the research status line or delete the dead path. |

### Strengths (hold the line on these)

- The **split-panel IA** — required identity/data left, voluntary decisions
  right, one decision footer — is a genuine comprehension win over A's
  cramped two-column privacy panel, and C stays recognisably the same
  structure with identity inputs correctly removed.
- **Gating semantics are exactly right and verified**: no LA default, no
  preselection nudge, submit disabled until confirmation + LA, research
  default visible and honestly labeled ("Standard: zugelassen").
- **Selection acknowledgment is consent-neutral at the control**: a chosen
  "Nein" card gets the same green treatment as "Ja" — keep this and extend it
  to the chips (F2), don't regress it.
- The **3-item plain-language data summary** before the legal accordions is
  the single best comprehension improvement over A.
- **C's confirmation copy** ("Diese Bestätigung ist keine Einwilligung in
  Forschung oder Learning Analytics") cleanly separates acknowledgment from
  consent — a subtle, important legal-UX detail. The notice link that opens,
  focuses, and scrolls the accordion works and is good practice.
- The **lock-note boundary statement** in C (course participation mandatory;
  research and LA explicitly not part of it) is exactly the right sentence.
- **Benefit-first LA framing** with the "nur für dich sichtbar" example card
  and the scannable guarantees row states value before asking for a decision.
- **Responsive behavior is sound at the extremes**: no horizontal overflow at
  any tested width, clean single-column stack at 375px with 52px choice
  cards, full-width submit.

## Decision callouts — resolve before implementation

| ID | Decision | Recommendation |
|----|----------|----------------|
| D1 | **In-app objection replaces the approved email route.** Per the handoff (premise carried from there, not re-verified against the original notice, which is not in any reviewed artifact), the prototype replaces the approved email-based objection route with an in-app choice; C's notice therefore contains adapted wording ("wählen Sie «Widersprechen»" and the change/no-recall/no-backfill sentences). Modified approved legal text is unapproved text. | Get the amended notice re-approved before any implementation, comparing against the approved original side by side; treat the current wording as placeholder. |
| D2 | **Sie vs du (F10).** | Keep approved notices verbatim in their register (Sie if approved as Sie) inside a visually quoted "official notice" container; write all surrounding UI in du. A visible quote frame makes the register shift read as intentional rather than sloppy. Confirm with legal that framing the notice as a quoted document is acceptable. |
| D3 | **Aggregate recalculation story (F12).** "Not immediately recalculated" is not a commitment anyone can act on. | Decide the real semantic (never recalculated vs recalculated on next scheduled rebuild) and write that. |
| D4 | **Profile visibility fixed on — migration.** Removing the choice for *new* accounts is settled; but existing accounts that chose "Anonymous" were given a privacy promise A still displays. Silently flipping them visible would retroactively override an exercised privacy choice. | Remove the control from the product page when B ships; keep existing opted-out accounts anonymous until they actively re-decide (one-time prompt), and have legal confirm the Datenschutzbestimmungen/ToS text that promised the option is updated in step. |
| D5 | **Legal-text consistency pass (F15).** The four legacy accordion texts predate the in-app research objection and LA entirely. | One coordinated revision of the accordion set alongside D1, so the page contains exactly one authoritative description per processing purpose. |

## Requested recommendations

- **Research and LA: keep them separate choices.** They differ in legal basis
  (objection right vs explicit consent), in object (anonymised exports vs
  ongoing collection), and in default (allowed vs undecided). Merging would
  either force the stricter regime onto research or quietly weaken LA
  consent, and would guarantee the conflation the brief worries about. The
  cost of separation is the near-twin presentation — fix with F5's structural
  differentiation, not by merging.
- **LA scope: global now, not course-scoped.** One choice at account/access
  creation, changeable any time in profile settings (and re-surfaced in C for
  assessment cohorts). Course-scoped consent multiplies decisions students
  must make (consent fatigue for a population that includes reluctant
  assessment users), and the settled opt-out semantics — "opting out deletes
  personal LA data" — become materially harder to state and implement
  per-course (delete which course's data? what about cross-course
  aggregates?). Nothing in the prototype's benefit story is course-exclusive.
  Revisit course scoping only if a concrete course-level trust problem shows
  up in practice; the global model is forward-compatible with it.

## Concrete simplifications (priority order)

1. **R0 — F1 + F2 + F3 in one footer rework** (~half a day in the real
   component): three chips (Forschung / Learning Analytics / Bestätigung),
   each either neutral-done or amber-missing; one live region announcing the
   remaining-steps count; card green stays the only "answer" color.
   *Check: with both decisions made and confirmation unchecked, the footer
   names the confirmation as the missing step; screen reader announces each
   change once.*
2. **R1 — F5 differentiation + F12 wording** (copy + section-header tags, ~2h
   once D3 is decided). *Check: a cold reader can say in one sentence, per
   section, what is decided and what happens without action.*
3. **R2 — F4 + F14 type floor** (token swap in implementation, ~1h): smallest
   sanctioned body size everywhere consent-relevant, 24px checkbox, ~80ch
   measure on the confirmation. *Check: all measured ratios in the shipped
   B/C component ≥ 4.5:1 at final sizes; the A ratio (#dc2626 on #f1f5f9) is
   an existing-product defect to fix in the current page, not a prototype
   change.*
4. **R3 — F7 open C's notice by default; F8 real icons; F9 aria-labelledby;
   F13 dead-code removal** (~1h total, mechanical).
5. **Not in this roadmap**: D1–D5 (decisions, not implementation); any change
   to A (baseline stays frozen); OLAT sticky-footer work until real embed
   heights are known (F6 is conditional on them — measure in OLAT first).

## Environment notes (not product findings)

- The browser pane's mobile emulation (<768px width) captures screenshots at
  ~2× device scale, yielding zoomed crops; all narrow-viewport conclusions
  here rest on in-page JS geometry (offsetWidth/scrollWidth), which is
  unaffected.
- One `computer scroll` action timed out while the pane was hidden;
  `window.scrollTo` via the JS tool is the reliable path.
- The prototype's static server (`python3 -m http.server 4173`) was started
  for this review and stopped afterwards.
