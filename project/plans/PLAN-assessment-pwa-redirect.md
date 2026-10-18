# Assessment PWA redirects

## Goal

Existing PWA links to assessment courses (overview, join, live quiz list) must
redirect to the assessment origin before PWA authentication or LTI handling.
Preserve locale, route and query parameters. Retain direct LiveQuiz redirects,
using the same URL handling for assessment redirects.

## Scope and boundaries

- Domain: Course and LiveQuiz `isAssessmentEnabled`; not leaderboard opt-in.
- Layers: frontend-pwa SSR helpers/pages, GraphQL StudentCourse boolean and a
  new public metadata operation; shared layout/header types follow their query
  result rather than the full schema type. No Prisma changes or mutations.
- Auth: metadata is already public; assessment authentication, invitations,
  participation and PIN checks remain enforced by the existing endpoints.
- No new UI strings, gamification, asynchronous work or seed requirements.
- One cohesive PR against v3. Existing generated links are outside this fix.
- Verify URL edge cases, course/quiz redirects and no-loop behavior; regenerate
  GraphQL, run repository checks/build and browser validation in the isolated
  user-authorized Devrouter environment.

## Progress

- Confirmed quiz redirects already exist; course entry points lack them.
- Added shared redirect URL handling and public course-mode lookup.
- PWA unit tests: 14 passed, including seven redirect cases; PWA typecheck passed.
- Browser: original v3 assessment course QR stays on source host; patched QR,
  overview and join routes redirect. Standard-course QR stays on source host.
  Locale and encoded/repeated query parameters survive, with no redirect loop.
- Local assessment and PWA share a build; deployed Edu-ID login and active-quiz
  PIN flows remain a validation gap.
- Independent review found no actionable issues. Production build passed all
  23 tasks after moving aside generated development route types. All seven lint
  tasks passed. Root verification must separate host-only Playwright checks
  from container checks; 39 launcher tests passed on the host.
