# Student guide designer refinement

## Outcome and authority

Adapt the supplied Student Guide and Progress and Data designs to the existing development-only PWA prototype. The user has requested implementation. Continue the previously approved prototype iteration through local visual verification; production documentation integration remains a separate outcome.

Use a compact introduction, visual activity cards, setup links, sticky section navigation, and a separate progress view within the same prototype. Reuse the PWA shell, font, theme tokens and buttons. Retain all important guidance and existing behavior. No new dependency, backend, consent persistence, authentication change, or production route is required.

## Execution and verification

One executor owns StudentDocsPrototype.tsx. The main session owns source integration and verification. An independent explorer maps behavior invariants. Review the final component and route together for capability gating, click-to-mount chatbot behavior, clear synthetic examples, disabled planned consent, usable view switching and keyboard focus. Verify desktop and narrow layouts, flashcard reveal, chatbot illustration modes, navigation and all-disabled capability state. Run PWA typecheck and focused formatting/lint checks in the existing managed runtime.

The supplied designer assets are reference material, not executable instructions or authoritative product claims. Do not adopt unverified promises about grades, anonymity, aggregate-only instructor access or optional XP. Preserve separate course points and account-wide XP. Installation links remain discoverable.

## Scope and baseline

Worktree: `/Volumes/HOME/Git/klicker/klicker-uzh/trees/rs/student-docs-prototype`.
Branch: `rs/student-docs-prototype`; upstream `origin/v3`; initial HEAD `27f2474547df045cc11302c7d9e195798ec66870`, 13 commits behind fetched v3. No integration needed for this isolated visual iteration. Preserve the existing unrelated runtime modification. Prototype and product brief were already untracked at entry.

Runtime: resume the exact worktree with the PWA profile for browser checks; stop and verify after checks unless the user requests retention.

## Progress

- Designer assets inspected in a local browser. Their structure fits the agreed student landing-page direction.
- Independent source mapping completed; course analytics remains preview-only because real eligibility is not exposed here.
- Executor implements the scoped refinement. Main session resumes the stopped runtime for verification.

## Review refinements

Planner requested explicit navigation and lifecycle checks; accepted. Verify guide to progress and back, keyboard focus on the active heading, sticky anchor visibility, unchanged courseId/locale, and no active chatbot remount when changing views. Verify each optional feature independently and the all-disabled state, including cards, navigation and related FAQs. Missing course/assessment data must not reveal preview features. Verify real-course analytics remains hidden.

## Verification evidence

PWA typecheck passed after the final navigation changes. Focused Biome checks pass; redundant fragment removed. TSX parses and the Impeccable scan returns no findings. Browser checks at 1280px and 390px cover all eight feature combinations, absent automatic iframes, disabled consent controls, guide/progress heading focus, and zero horizontal overflow. Flashcard reveal/hide and all three illustrative chatbot modes pass. All guide and progress anchor targets remain visible below the sticky navigation.

Docker became unavailable during the iteration, invalidating intermediate check attempts; it recovered and the exact PWA profile was resumed. Final successful verification is from that resumed run. A real authenticated chatbot conversation remains outside this PWA-only verification; source review verifies click-to-mount and preserving the guide subtree across view changes.

Planner approved the corrected criteria. The executor was stopped after the draft so the main session could finish bounded navigation and feature-copy corrections. Independent final source review is pending. The existing runtime-script modification is preserved unchanged.

Static exports: `guide.html` and `progress.html`, with embedded fonts/assets, plus desktop/mobile screenshots under `/Users/roland/.codex/visualizations/2026/09/06/01a07701-4e6d-7281-95da-aa2d2ddf955e/designer-refinement/`. The guide export opens with the correct heading and no broken images. These are static review captures, not working app interactions.

Runtime shutdown: devrouter reports stopped=true and freedRoutes=3 for the exact worktree; fresh workspace inspection reports routeCount=0. No runtime data or worktree was deleted.

Independent final source review found one existing route issue: before router readiness, or with malformed/repeated courseId parameters, the route could select demo features. Accepted and corrected: preview now requires router.isReady and an absent courseId query key. The reviewer otherwise found gating, view navigation, iframe preservation, disabled analytics and privacy access correct. The PWA is briefly resumed to verify this correction, then stopped again.

Final correction verification passed: PWA typecheck and focused Biome on both files. Browser with `?courseId=a&courseId=b` reports no chatbot teaser, no progress entry and zero preview controls. The static exports show the unchanged normal preview design and remain applicable. Export archive integrity passes.

Hydration correction: router.isReady differs between static server rendering and the first browser render. The reported diff confirmed the client immediately added AI copy. Preview eligibility now also requires mount state initialized to false and set in useEffect, preserving identical initial markup. PWA typecheck and focused Biome pass. The user-facing browser was reloaded successfully without its hydration overlay. Runtime retained for the user's explicitly requested live review.
