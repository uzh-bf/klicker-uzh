# 12. Klicker declares design-token names, not their values

Under `@uzh-bf/design-system` v5, Klicker's `@theme` block keeps declaring the token
*names* its Tailwind utilities need, but their *values* are `var()` references into the
design system's runtime cascade rather than hardcoded colours. The block is a namespace
bridge, not a palette.

This looks like duplication and is not. The published `dist/design-system.css` is an
already-compiled Tailwind build: no `@theme` at-rule survives it, and every token lands
as a plain custom property under `:root, :host`. A consumer's own Tailwind compiler does
not read those as theme tokens, so it emits utilities only for names declared in the
consumer's own `@theme`. The design system's CSS contains utilities only for the classes
its own source happens to use — it emits `bg-uzh-blue-20` and `text-uzh-blue-100`, but not
`text-uzh-blue-60`, `bg-uzh-blue-80` or the bare `bg-uzh-blue`, all of which Klicker uses.
Deleting Klicker's `@theme` outright therefore removes roughly 460 live utility usages
with no build error, which is the exact silent-failure mode the v5 upgrade was meant to
avoid. Declaring names with `var()` values gives full utility coverage, zero duplicated
values, and working theme switching at the same time.

Three token classes fall out of this and are treated differently. Fifty-one are value
overrides — tokens the design system already owns where Klicker carries a literal — and
they are deleted, the design system's value winning. Most of these are bare v5 runtime
property names (`--primary`, `--ring`, `--sidebar-*`, `--chart-*`, `--radius`) left over
from a stock shadcn palette. Redeclaring one is worse than redundant: Klicker's `@theme`
emits it into `:root` at the same specificity as the design system's own
`[data-theme="uzh"]` block, so which value applies depends on source order. Eight are
genuine namespace bridges that map a runtime property into Tailwind's `--color-*`
namespace and are kept as references. The rest are extensions, kept with their usage count as
justification. The largest group is the six UZH colour families beyond blue and berry —
grey, red, darkgreen, yellow, turqoise and lightgreen. These are extensions only in effect:
the design system declares all six in its source with the same values and compiles them away
as unused, so Klicker should track its source rather than treating them as its own.

The bucket boundary is not "does v5 declare the token" but "must Klicker's own build emit
the utility". A token v5 declares can still need its name kept — the `--color-uzh-blue-*`
ramp is exactly that case.

The consequence to accept: the bridge file must be revisited whenever v5 renames or
retires a runtime property, and a token added to v5 is not automatically usable as a
Klicker utility until its name is declared in the bridge.
