# 11. The UZH theme is selected by a root data attribute, not a provider

Klicker opts into `@uzh-bf/design-system` v5's `uzh` theme by rendering
`data-theme="uzh"` on the `<html>` element in each app shell — `_document.tsx` for the
Pages Router apps and `app/layout.tsx` for `apps/chat` — and does not use the design
system's `ThemeProvider`. Klicker has never used the provider, so this records a choice
rather than a change.

The provider was the alternative. It offers runtime theme switching, which Klicker does
not need: every Klicker surface is UZH-branded and there is no user-facing or per-course
theme selector on the roadmap. It also carries a specific hazard. The provider's mount
effect writes `document.documentElement` unconditionally, so a provider whose
`theme`/`defaultTheme` disagrees with the shell attribute silently overwrites it after
hydration, producing a first-paint flash and a theme that depends on mount order. A
static attribute in the server-rendered shell has neither failure mode and costs one
line per app.

The consequence to accept: introducing runtime theme switching later means adding the
provider and keeping its props in sync with the shell attribute, not just dropping the
attribute. The attribute is also invisible to CSS-only tooling that renders fragments
outside the app shell, so component-level visual tests must set it themselves.
