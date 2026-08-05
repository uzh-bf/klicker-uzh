## 2026-08-04

- **Update**: [auth-model](../auth-model.md) records that the PWA login page anchors return targets on a build-specific origin (`NEXT_PUBLIC_ASSESSMENT_URL` for the assessment build, `NEXT_PUBLIC_PWA_URL` otherwise, request `Host` as fallback), that anchoring assessment mode on the regular PWA origin is the #5166 regression that stranded students on an app without Edu-ID login, and that the auth app's `AUTH_STUDENT_ALLOWED_HOSTS` check is a second, independent gate on the `/student` return target.
