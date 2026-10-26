# Adaptive end-to-end tests

Imported from public KlickerUZH commit `493cf936c0225f9a4f3947513ea8943d9bd2863a`.
Run through the host's Playwright configuration and disposable test environment.
The public spec files import these package entry points; the host supplies
shared fixtures, constants, global setup and browser configuration through
`@klicker-uzh/playwright/adaptive-host/*` exports. No second test runner or
database lifecycle is created here. AGPL-3.0 attribution is retained.
