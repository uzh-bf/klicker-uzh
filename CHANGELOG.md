# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [3.0.0-alpha.36](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.35...v3.0.0-alpha.36) (2023-02-15)


### Bug Fixes

* **apps/frontend-*:** several fixes for kprim questions ([#3346](https://github.com/uzh-bf/klicker-uzh/issues/3346)) ([d31b02c](https://github.com/uzh-bf/klicker-uzh/commit/d31b02c7d6b5eee89859c4531b10bea5552d19e1))
* **packages/graphql:** make displayMode nullable ([876dd4d](https://github.com/uzh-bf/klicker-uzh/commit/876dd4d7883d38dafed69c5787555deb113d1ff1))

## [3.0.0-alpha.35](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.34...v3.0.0-alpha.35) (2023-02-14)


### Features

* add displayMode for choice-based questions (as a list or as a grid) ([#3345](https://github.com/uzh-bf/klicker-uzh/issues/3345)) ([3874f10](https://github.com/uzh-bf/klicker-uzh/commit/3874f10e8d251eea558b347205739407d3f108f7))


### Bug Fixes

* **packages/prisma:** add migration for question display mode ([378424c](https://github.com/uzh-bf/klicker-uzh/commit/378424caabacaeb2006fc886f926cb1d0b4bb92e))

## [3.0.0-alpha.34](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.33...v3.0.0-alpha.34) (2023-02-14)


### Bug Fixes

* **packages/graphql:** make self query unauthenticated but return null if not logged in ([3525354](https://github.com/uzh-bf/klicker-uzh/commit/352535459ceab0ec29864411e2dbaaf25625006d))

## [3.0.0-alpha.33](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.32...v3.0.0-alpha.33) (2023-02-14)


### Bug Fixes

* **packages/graphql:** mismatch in context of basic course info ([4fdede2](https://github.com/uzh-bf/klicker-uzh/commit/4fdede2e8432b1846105f28512dd8ad5f33ce1d4))

## [3.0.0-alpha.32](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.31...v3.0.0-alpha.32) (2023-02-14)


### Bug Fixes

* **packages/graphql:** make basic course information publicly accessible ([1862b04](https://github.com/uzh-bf/klicker-uzh/commit/1862b047c6c980c221a1da43f2dc8fadefe5fc75))

## [3.0.0-alpha.31](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.30...v3.0.0-alpha.31) (2023-02-14)


### Bug Fixes

* **packages/graphql:** make pointsMultiplier nullable on questionData ([e07ee0c](https://github.com/uzh-bf/klicker-uzh/commit/e07ee0c956aa99d64905c395e6af223bcb320897))

## [3.0.0-alpha.30](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.29...v3.0.0-alpha.30) (2023-02-14)


### Enhancements

* **apps/frontend-manage:** misc. layout improvements on the question pool ([c0dea69](https://github.com/uzh-bf/klicker-uzh/commit/c0dea696b0b181c91d4f801a0f8ea5e05f8d8395))

## [3.0.0-alpha.29](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.28...v3.0.0-alpha.29) (2023-02-13)


### Enhancements

* basic handling for images within question contents and answer options ([280ef2f](https://github.com/uzh-bf/klicker-uzh/commit/280ef2f92129b1cdaa0c3765c8d785a492bf6d27))

## [3.0.0-alpha.28](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.27...v3.0.0-alpha.28) (2023-02-13)


### Bug Fixes

* **apps/frontend-*:** update SSR api url, reduce editor height ([5d5ae72](https://github.com/uzh-bf/klicker-uzh/commit/5d5ae72643adc1fb8533254202433d95bc07651e))


### Deployment

* use dynamic APP_VERSION to prevent commits ([0069ca6](https://github.com/uzh-bf/klicker-uzh/commit/0069ca631e4c19a7cb94f4a69efe71e35f1bfcb4))

## [3.0.0-alpha.27](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.26...v3.0.0-alpha.27) (2023-02-13)


### Bug Fixes

* **apps/frontend-*:** update SSR domain for continued v2 naming ([3c4e360](https://github.com/uzh-bf/klicker-uzh/commit/3c4e360c0f71bf4d57956e93921e06931e3a6696))

## [3.0.0-alpha.26](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.25...v3.0.0-alpha.26) (2023-02-13)


### Bug Fixes

* **apps/frontend-*:** ensure that Unauthorized error matches what is sent by the backend ([cd7db32](https://github.com/uzh-bf/klicker-uzh/commit/cd7db32d0edbe912384707ab1b56b2e0d7984d65))


### Deployment

* latest alpha ([d72061c](https://github.com/uzh-bf/klicker-uzh/commit/d72061cf8b864f8db410e41414b58f45abe62cc4))

## [3.0.0-alpha.25](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.24...v3.0.0-alpha.25) (2023-02-13)


### Deployment

* ensure that tag still matches current v2 naming, fix checksum generation, add control frontend ([d37fb4c](https://github.com/uzh-bf/klicker-uzh/commit/d37fb4c7644e02ae8258ab798588b871cc3adf60))

## [3.0.0-alpha.24](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.23...v3.0.0-alpha.24) (2023-02-13)


### Bug Fixes

* **apps/frontend-*:** update overrides for next apps ([f533035](https://github.com/uzh-bf/klicker-uzh/commit/f533035e126b9ebaf5b5b3f39ddd17385d6489ec))

## [3.0.0-alpha.23](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.22...v3.0.0-alpha.23) (2023-02-13)


### Bug Fixes

* **frontend-manage:** fix NaN values in tables and bar charts ([#3327](https://github.com/uzh-bf/klicker-uzh/issues/3327)) ([418f01e](https://github.com/uzh-bf/klicker-uzh/commit/418f01eb05dd6ac61275f5e2e580f365c7279e11))


### Enhancements

* **frontend-manage:** separate toggle functionality for live Q&A and confusion feedback ([#3325](https://github.com/uzh-bf/klicker-uzh/issues/3325)) ([d8f8c5f](https://github.com/uzh-bf/klicker-uzh/commit/d8f8c5f453911d7c102417a174f44fb62b2ccd22))


### Refactors

* move from nexus to pothos with prisma integration and plugins ([#3189](https://github.com/uzh-bf/klicker-uzh/issues/3189)) ([b525faf](https://github.com/uzh-bf/klicker-uzh/commit/b525faffd6aeb98fa507325f4040f93e6f3be009))

## [3.0.0-alpha.22](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.21...v3.0.0-alpha.22) (2023-02-09)


### Features

* **frontend-manage:** add session creation wizard ([#3320](https://github.com/uzh-bf/klicker-uzh/issues/3320)) ([c22c82a](https://github.com/uzh-bf/klicker-uzh/commit/c22c82abecbdded1bf65058fd5cace6bc6e19c65))


### Refactors

* **frontend-manage:** ensure that state logic on evaluation view works as expected ([#3306](https://github.com/uzh-bf/klicker-uzh/issues/3306)) ([1dae48b](https://github.com/uzh-bf/klicker-uzh/commit/1dae48b46e235fc3c5e592b68d4bc57cc539cbc0))


### Other

* **frontend-manage:** add pause button between session blocks ([#3308](https://github.com/uzh-bf/klicker-uzh/issues/3308)) ([61abd7c](https://github.com/uzh-bf/klicker-uzh/commit/61abd7c16425a7aadf3905d813414f45cc59d580))


### Enhancements

* **frontend-control:** various improvements for the controller app ([#3309](https://github.com/uzh-bf/klicker-uzh/issues/3309)) ([e9e3a7e](https://github.com/uzh-bf/klicker-uzh/commit/e9e3a7e56ea0189c7e3bd32cb40e3ca73caba9c6))

## [3.0.0-alpha.21](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.20...v3.0.0-alpha.21) (2023-02-03)

## [3.0.0-alpha.20](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.19...v3.0.0-alpha.20) (2023-02-03)

## [3.0.0-alpha.19](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.16...v3.0.0-alpha.19) (2023-02-03)


### Features

* **frontend-manage:** enable configuration of colors for courses ([#3301](https://github.com/uzh-bf/klicker-uzh/issues/3301)) ([e1fb124](https://github.com/uzh-bf/klicker-uzh/commit/e1fb124d6f021477d89b90838556ec93d0ba232b))
* **frontend-manage:** enable searching and sorting in question pool ([#3284](https://github.com/uzh-bf/klicker-uzh/issues/3284)) ([542d9b7](https://github.com/uzh-bf/klicker-uzh/commit/542d9b71fb0734ea79db84c96a3911adacaf1662))


### Bug Fixes

* **apps/backend-docker:** ensure that session-based caching works with the new yoga app ([c092ad7](https://github.com/uzh-bf/klicker-uzh/commit/c092ad7d63f97a491d4103005b4b27159c358747))
* **packages/graphql:** add manual unauthorized error on fetching participations to ensure PWA login redirect ([681d5e9](https://github.com/uzh-bf/klicker-uzh/commit/681d5e932248e97eb98db40890a8e59117088a85))


### Enhancements

* **apps/backend-docker:** upgrade graphql-yoga and set-up CSRF protection plug-in ([4065288](https://github.com/uzh-bf/klicker-uzh/commit/4065288936565a0a11b6da487f99e081c93d9fd3))
* set-up persisted queries and CSRF ([#3288](https://github.com/uzh-bf/klicker-uzh/issues/3288)) ([f1956b3](https://github.com/uzh-bf/klicker-uzh/commit/f1956b3fd5824f75488e358058b9d06e7d07d9f6))

## [3.0.0-alpha.18](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.17...v3.0.0-alpha.18) (2023-01-29)


### Enhancements

* **apps/backend-docker:** upgrade graphql-yoga and set-up CSRF protection plug-in ([4065288](https://github.com/uzh-bf/klicker-uzh/commit/4065288936565a0a11b6da487f99e081c93d9fd3))
* set-up persisted queries and CSRF ([#3288](https://github.com/uzh-bf/klicker-uzh/issues/3288)) ([f1956b3](https://github.com/uzh-bf/klicker-uzh/commit/f1956b3fd5824f75488e358058b9d06e7d07d9f6))

## [3.0.0-alpha.17](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.16...v3.0.0-alpha.17) (2023-01-29)


### Bug Fixes

* **apps/backend-docker:** ensure that session-based caching works with the new yoga app ([c092ad7](https://github.com/uzh-bf/klicker-uzh/commit/c092ad7d63f97a491d4103005b4b27159c358747))
* **packages/graphql:** add manual unauthorized error on fetching participations to ensure PWA login redirect ([681d5e9](https://github.com/uzh-bf/klicker-uzh/commit/681d5e932248e97eb98db40890a8e59117088a85))

## [3.0.0-alpha.16](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.15...v3.0.0-alpha.16) (2023-01-28)


### Deployment

* move podAnnotations back into template ([394559e](https://github.com/uzh-bf/klicker-uzh/commit/394559e362160cc718edf7182f17a313c443bf60))

## [3.0.0-alpha.15](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.14...v3.0.0-alpha.15) (2023-01-28)


### Deployment

* move pod annotations to values.yaml ([32d0d84](https://github.com/uzh-bf/klicker-uzh/commit/32d0d842209cdf1cf97259263c27f0ef0bf14da8))


### Enhancements

* **apps/frontend-manage:** improve evaluation layout (resize/scroll) and show notification if questionIx not available ([#3285](https://github.com/uzh-bf/klicker-uzh/issues/3285)) ([1fa60d7](https://github.com/uzh-bf/klicker-uzh/commit/1fa60d72fde34db742dfb1a30bbd5542dcb00298))

## [3.0.0-alpha.14](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.13...v3.0.0-alpha.14) (2023-01-28)


### Deployment

* add annotations for config, secret, and release to ensure redeploy on changes ([87ca3aa](https://github.com/uzh-bf/klicker-uzh/commit/87ca3aa36dce6470deda2d0c80259b6c412a9b98))

## [3.0.0-alpha.13](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.12...v3.0.0-alpha.13) (2023-01-28)


### Bug Fixes

* **apps/frontend-*:** ensure URLs for pwa, manage, and control are set in QA configs ([99e24b1](https://github.com/uzh-bf/klicker-uzh/commit/99e24b1a759cc28b77836b6bb8c7e8b13ad43373))

## [3.0.0-alpha.12](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.11...v3.0.0-alpha.12) (2023-01-28)

## [3.0.0-alpha.11](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.10...v3.0.0-alpha.11) (2023-01-28)


### Deployment

* use chart version for image tag to ensure correct image is deployed ([3305d7d](https://github.com/uzh-bf/klicker-uzh/commit/3305d7d17c1403d52d782296799593dd393cfca8))

## [3.0.0-alpha.10](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.9...v3.0.0-alpha.10) (2023-01-28)


### Bug Fixes

* **apps/frontend-*:** update SSR api urls for new chart naming ([99ee2f1](https://github.com/uzh-bf/klicker-uzh/commit/99ee2f18ed536162179d53de11bdc66c003fb428))


### Other

* **packages/response*:** ensure that eslint does not reference nonexistent base config ([49ecc96](https://github.com/uzh-bf/klicker-uzh/commit/49ecc9607d8c32a478c3ccaaad7c811725e5e5c8))

## [3.0.0-alpha.9](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.8...v3.0.0-alpha.9) (2023-01-28)

## [3.0.0-alpha.8](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.7...v3.0.0-alpha.8) (2023-01-28)


### Features

* **apps/office-addin:** add initial POC for content/taskpane add-in in Microsoft PowerPoint ([#3173](https://github.com/uzh-bf/klicker-uzh/issues/3173)) ([81ff43f](https://github.com/uzh-bf/klicker-uzh/commit/81ff43f4a0298f2107894386fef2b1a58c4eab70))
* **frontend-control:** embed links on controller frontend ([#3282](https://github.com/uzh-bf/klicker-uzh/issues/3282)) ([103bcc4](https://github.com/uzh-bf/klicker-uzh/commit/103bcc44dece9b5175404bc48c2e0f386706df28))


### Build and CI

* apply codeql only to the v3 branch ([10b29fb](https://github.com/uzh-bf/klicker-uzh/commit/10b29fb47c074fc965fd8e348702269185ced4fb))
* update codeql actions to v2 ([1b6c226](https://github.com/uzh-bf/klicker-uzh/commit/1b6c226caa11afa89f3030fd7ba3848963a3a3a5))
* update dependabot branch to v3 ([8b2065f](https://github.com/uzh-bf/klicker-uzh/commit/8b2065f89348497d01235faed79832d8dfa5279b))


### Enhancements

* **frontend-control:** show next block on controller app as well ([#3283](https://github.com/uzh-bf/klicker-uzh/issues/3283)) ([78a099a](https://github.com/uzh-bf/klicker-uzh/commit/78a099a0e0a8ba74347b4bed6c9c40af36d03ab2))

## [3.0.0-alpha.7](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.6...v3.0.0-alpha.7) (2023-01-25)


### Bug Fixes

* **deploy:** ensure that the secret for frontend-control is present ([4889b27](https://github.com/uzh-bf/klicker-uzh/commit/4889b2751b00fb754d2180aeb649a5177e4c34d2))

## [3.0.0-alpha.6](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.5...v3.0.0-alpha.6) (2023-01-25)


### Bug Fixes

* **deploy:** add config map for frontend-control ([0fad5ef](https://github.com/uzh-bf/klicker-uzh/commit/0fad5ef4ec3c2590eb18f93e2b8ec9b24a48e19b))

## [3.0.0-alpha.5](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.4...v3.0.0-alpha.5) (2023-01-25)


### Enhancements

* **deploy:** add frontend-control to helm chart ([3890e49](https://github.com/uzh-bf/klicker-uzh/commit/3890e49e6e197130c905c8503b05344b8c806659))

## [3.0.0-alpha.4](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.3...v3.0.0-alpha.4) (2023-01-25)


### Other

* **packages/prisma:** use TEST seed in QA ([b41d41d](https://github.com/uzh-bf/klicker-uzh/commit/b41d41d25eae87975e91f19e41d94a810ff073c2))


### Deployment

* use /login as routes for readiness and liveness probes ([3cd7b94](https://github.com/uzh-bf/klicker-uzh/commit/3cd7b9431e05496d152288d14da1a52e684d7004))

## [3.0.0-alpha.3](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.2...v3.0.0-alpha.3) (2023-01-24)


### Other

* add seed directory to gitignore ([b5d92a8](https://github.com/uzh-bf/klicker-uzh/commit/b5d92a8b2412f4ad8bc17bb9ba9bcf5b1a520282))
* readd seed submodule ([d9e3c44](https://github.com/uzh-bf/klicker-uzh/commit/d9e3c44abebee697792c690b41e1c2cc95df1c8e))
* remove seed submodule ([1d70b79](https://github.com/uzh-bf/klicker-uzh/commit/1d70b799886cb7aaa4a5c77d1db6b610f88221f7))

## [3.0.0-alpha.2](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.1...v3.0.0-alpha.2) (2023-01-24)


### Build and CI

* try chart release action with SKIP_EXISTING=false ([ed2d1d9](https://github.com/uzh-bf/klicker-uzh/commit/ed2d1d981ccf28e37480df8339dd63fd82dc4734))

## [3.0.0-alpha.1](https://github.com/uzh-bf/klicker-uzh/compare/v3.0.0-alpha.0...v3.0.0-alpha.1) (2023-01-24)


### Features

* introduce token-based login mechanism for controller app ([#3262](https://github.com/uzh-bf/klicker-uzh/issues/3262)) ([e49c555](https://github.com/uzh-bf/klicker-uzh/commit/e49c55587fdae378970ddda77b2225b168499e99))


### Enhancements

* **frontend-manage:** add basic tag management ([#3255](https://github.com/uzh-bf/klicker-uzh/issues/3255)) ([aec7c9e](https://github.com/uzh-bf/klicker-uzh/commit/aec7c9e1601e4b03b0950b1d7a8d1853f4390910))
* **frontend-manage:** introduce session cancellation functionality ([#3256](https://github.com/uzh-bf/klicker-uzh/issues/3256)) ([032394d](https://github.com/uzh-bf/klicker-uzh/commit/032394dc3a56f5b7e3c73ce9814faef070a2f1bb))


### Refactors

* **frontend-manage:** extract useNavigationArrow component to design-system ([9474e45](https://github.com/uzh-bf/klicker-uzh/commit/9474e4543ddbfb952be98317d49882d395fd3e62))


### Deployment

* update chart lockfiles for latest redis bitnami chart ([8277731](https://github.com/uzh-bf/klicker-uzh/commit/82777314e95ad50ebfe1d3fd6c7398e615027d8a))
* update redis bitnami chart version to latest ([fb2cd1c](https://github.com/uzh-bf/klicker-uzh/commit/fb2cd1cba3adfbc812e0e3bd2b3c8455299c5156))


### Build and CI

* add the bitnami repo before running chart release ([992f165](https://github.com/uzh-bf/klicker-uzh/commit/992f1654ece922844dfb4a67aa27b1a077ba4dfe))
* add workflow for chart releases to gh pages ([d69e3d9](https://github.com/uzh-bf/klicker-uzh/commit/d69e3d9411f251b2b7a2f8dd470fdb786851e541))


### Other

* more updates for the new v3 naming ([2511d41](https://github.com/uzh-bf/klicker-uzh/commit/2511d41224128602892aef3d9008e930bf406673))
* **packages/prisma:** adjust tsconfig ([#3261](https://github.com/uzh-bf/klicker-uzh/issues/3261)) ([329346a](https://github.com/uzh-bf/klicker-uzh/commit/329346a6c6f8601ddc74bb40d9389e4ee9fa592c))
* **packages/prisma:** merge seed data from submodule ([#3259](https://github.com/uzh-bf/klicker-uzh/issues/3259)) ([1dc61ed](https://github.com/uzh-bf/klicker-uzh/commit/1dc61ed5f3ec580bbec00e23dc1136f55e391cfb))
* **packages/prisma:** remove seed submodule, reclone ([6f3cbbb](https://github.com/uzh-bf/klicker-uzh/commit/6f3cbbb1dbb9a619d88d5e846cf0548ab648cbd7))
* update versions in package files to fix npm install ([d0db610](https://github.com/uzh-bf/klicker-uzh/commit/d0db610e85d7795f18c7b5bdf95a6ec7a1a3f403))

## [3.0.0-alpha.0](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.117...v3.0.0-alpha.0) (2023-01-22)


### Features

* **frontend-control:** introduce new controller app for live sessions ([#3224](https://github.com/uzh-bf/klicker-uzh/issues/3224)) ([5b6f4ad](https://github.com/uzh-bf/klicker-uzh/commit/5b6f4ad5d2dc470dbc030f82ea2c9616c1e47eb5))


### Bug Fixes

* **frontend-manage:** fix issue with scrolling on menu bar ([#3254](https://github.com/uzh-bf/klicker-uzh/issues/3254)) ([826679a](https://github.com/uzh-bf/klicker-uzh/commit/826679ac69cbda1f0a0930da4240be91436ae794))
* **frontend-manage:** fix session editing bugs ([#3191](https://github.com/uzh-bf/klicker-uzh/issues/3191)) ([bbef64a](https://github.com/uzh-bf/klicker-uzh/commit/bbef64a88933585b85ed9070eb8e50cbb6402058))
* **frontend-pwa:** remove wrong notification badges from pwa mobile menu bar ([19746cc](https://github.com/uzh-bf/klicker-uzh/commit/19746ccf18335f677a88e01b7773dbae98c86033))


### Dependencies

* upgrade turbo and prisma packages ([854090b](https://github.com/uzh-bf/klicker-uzh/commit/854090b788ec96f8d448efbc87b417303cdbdf86))


### Enhancements

* **cypress:** rework selectors for data-cy, add draft workflow for GH actions ([#3187](https://github.com/uzh-bf/klicker-uzh/issues/3187)) ([85f3358](https://github.com/uzh-bf/klicker-uzh/commit/85f3358352586f723093eca091eb32292e702a9a))
* **frontend-control:** update layout and add navigation elements in menu bar on mobile ([aa2d321](https://github.com/uzh-bf/klicker-uzh/commit/aa2d321c36a60765ab70208b53bb36f9708f720d))
* **frontend-manage:** add custom toast component to sesson creation forms ([#3207](https://github.com/uzh-bf/klicker-uzh/issues/3207)) ([3335b03](https://github.com/uzh-bf/klicker-uzh/commit/3335b030dd65fdb9189fdb3207f6f058f25487ff))
* **frontend-manage:** add possibility to embed evaluation leaderboard ([61532c6](https://github.com/uzh-bf/klicker-uzh/commit/61532c6c95e4620339af0da8b1ada763a39249de))
* **frontend-manage:** add reordering possiblities for session creation forms ([#3206](https://github.com/uzh-bf/klicker-uzh/issues/3206)) ([12f8fe9](https://github.com/uzh-bf/klicker-uzh/commit/12f8fe9f89d052189e025a7625101fc120dbc5e6))
* **frontend-manage:** allow editing micro and live sessions ([#3190](https://github.com/uzh-bf/klicker-uzh/issues/3190)) ([b13035b](https://github.com/uzh-bf/klicker-uzh/commit/b13035b55a8785bf6424ccd059401e3b77f0bbf1))
* **frontend-manage:** display course join link and PIN through QR code ([#3192](https://github.com/uzh-bf/klicker-uzh/issues/3192)) ([e760a0c](https://github.com/uzh-bf/klicker-uzh/commit/e760a0c720fc2090f7517865345aa8304c91491d))
* **frontend-manage:** navigation on evaluation using keyboard arrow keys ([#3253](https://github.com/uzh-bf/klicker-uzh/issues/3253)) ([cf78738](https://github.com/uzh-bf/klicker-uzh/commit/cf787384a521fac45240e945b807ddfa74849558))


### Other

* **frontend-manage:** fix minor style issues on manage frontend ([#3249](https://github.com/uzh-bf/klicker-uzh/issues/3249)) ([a6bfd67](https://github.com/uzh-bf/klicker-uzh/commit/a6bfd67166938422a88417e7f6b342c81368f07a))
* **frontend-manage:** minor improvements on session creation and histogram statistics ([30f12c8](https://github.com/uzh-bf/klicker-uzh/commit/30f12c8280874492e204460ed83cff3a864049ba))
* **frontend-manage:** refactor shortening logic of choices on evaluation view ([#3205](https://github.com/uzh-bf/klicker-uzh/issues/3205)) ([56e251e](https://github.com/uzh-bf/klicker-uzh/commit/56e251e3bea85a8da3574a7c0fd2f07b6fa9a094))
* rename deployment artifacts to v3 ([1ac3573](https://github.com/uzh-bf/klicker-uzh/commit/1ac35738a50a22caabf1cd667442f4535575991b))
* update maintainers and contributors ([40576d9](https://github.com/uzh-bf/klicker-uzh/commit/40576d9262a986dda629a003aaa44c5a55030813))
* upgrade node to 18.13 ([be7a828](https://github.com/uzh-bf/klicker-uzh/commit/be7a8280eff4a377b2d236c21ad0ff748aa34458))

## [2.0.0-alpha.117](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.116...v2.0.0-alpha.117) (2022-12-28)


### Bug Fixes

* **frontend-*:** add prettier and imports plugin as explicit deps ([d1e3e21](https://github.com/uzh-bf/klicker-uzh/commit/d1e3e21dd6dbf5ab3022134b889e6ab73fc0dbae))

## [2.0.0-alpha.116](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.115...v2.0.0-alpha.116) (2022-12-28)


### Dependencies

* upgrade design system with relaxed peer deps ([5cd9fdb](https://github.com/uzh-bf/klicker-uzh/commit/5cd9fdb1581cc4979665f3862e6b960815fc2a44))

## [2.0.0-alpha.115](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.114...v2.0.0-alpha.115) (2022-12-28)


### Bug Fixes

* **frontend-*:** update override for new next version ([8f89cba](https://github.com/uzh-bf/klicker-uzh/commit/8f89cba6eed93218337458c68f08f0c7f83fe0b0))

## [2.0.0-alpha.114](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.113...v2.0.0-alpha.114) (2022-12-28)


### Features

* **frontend-manage:** add session creation forms for micro-sessions and learning elements ([#3176](https://github.com/uzh-bf/klicker-uzh/issues/3176)) ([481a48c](https://github.com/uzh-bf/klicker-uzh/commit/481a48cd4f7c1af60d3c4af6ab69797e0279e9b1))


### Deployment

* prod upgrade ([dbf009c](https://github.com/uzh-bf/klicker-uzh/commit/dbf009c7559864c608d61f83b432cb292f261a33))


### Other

* add devbox.json for initial testing ([747f737](https://github.com/uzh-bf/klicker-uzh/commit/747f737c9e118d380b8de75aefd417007d8fb811))
* cleanup of deps files for devcontainer ([ae31f60](https://github.com/uzh-bf/klicker-uzh/commit/ae31f6099e21808ca07048cdb982323824051c50))
* generate initial devcontainer with devbox ([a42c9dc](https://github.com/uzh-bf/klicker-uzh/commit/a42c9dc520635366aeb17532348a0681014198fb))
* lockfile maintenance ([318f0ac](https://github.com/uzh-bf/klicker-uzh/commit/318f0ac1857cf1c65e567da02a7be47a8265931f))
* remove devbox.json from .dockerignore to allow devcontainer build ([e83e633](https://github.com/uzh-bf/klicker-uzh/commit/e83e6334a9600e1f731f593fb611acdeb36dfa7c))
* remove experimental devcontainer ([0c7c2c9](https://github.com/uzh-bf/klicker-uzh/commit/0c7c2c9568c49e5f3b5bd36b58ba9066f9a1cf57))
* update recommended vscode extensions ([d59c54f](https://github.com/uzh-bf/klicker-uzh/commit/d59c54ff3b8a64f9bd897a81381293bd26a13475))


### Dependencies

* upgrade graphql-yoga to v3 and minor upgrades for other packages ([#3186](https://github.com/uzh-bf/klicker-uzh/issues/3186)) ([84e312a](https://github.com/uzh-bf/klicker-uzh/commit/84e312a99ba34b06a784a9c6987c1bad456414a2))

## [2.0.0-alpha.113](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.112...v2.0.0-alpha.113) (2022-12-22)


### Bug Fixes

* **packages/prisma:** build openssl musl lib ([2469232](https://github.com/uzh-bf/klicker-uzh/commit/2469232e7cf91e266f9070d0c7d1edec2c0399a3))

## [2.0.0-alpha.112](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.111...v2.0.0-alpha.112) (2022-12-22)


### Dependencies

* upgrade prisma ([9b186bf](https://github.com/uzh-bf/klicker-uzh/commit/9b186bff0d23c5c36ccfc151db6a24c1246d1eb6))

## [2.0.0-alpha.111](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.110...v2.0.0-alpha.111) (2022-12-22)


### Deployment

* update production version ([be0b44f](https://github.com/uzh-bf/klicker-uzh/commit/be0b44fe6776716e1e2fa78718fc0a1ae9caf940))

## [2.0.0-alpha.110](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.109...v2.0.0-alpha.110) (2022-12-22)


### Bug Fixes

* **apps/frontend-manage:** remove scrolling in creation forms for now ([7a9a60a](https://github.com/uzh-bf/klicker-uzh/commit/7a9a60afd927c0dcf6df56f6c68cd9f3e71ea631))
* **frontend-*:** fix issues with numerical questions ([#3167](https://github.com/uzh-bf/klicker-uzh/issues/3167)) ([e841590](https://github.com/uzh-bf/klicker-uzh/commit/e84159093988cb2eb3f2212e4a6038014db36217))
* **frontend-manage:** ensure that statistics checkboxes are rescaled on evaluation on textSize change ([7338a1e](https://github.com/uzh-bf/klicker-uzh/commit/7338a1e1e73a044fdca208d4c6688a6b39ed5348))
* **frontend-manage:** fix issues that session list is not up to date on session creation forwarding ([fc72c44](https://github.com/uzh-bf/klicker-uzh/commit/fc72c44b13898a4beea077ca51dec0b0dc0d2bd1))
* **frontend-pwa:** fix footer position on learning elements and micro learnings ([6d5fd61](https://github.com/uzh-bf/klicker-uzh/commit/6d5fd61ae13d12ae06f0a84882b59c6175943cdc))
* **packages/prisma:** add migration for achievements ([efe1722](https://github.com/uzh-bf/klicker-uzh/commit/efe17223819f5b8706372ee55302d46bff22a6df))


### Refactors

* extend theme and replace custom colors through theme colors ([#3168](https://github.com/uzh-bf/klicker-uzh/issues/3168)) ([aaa8533](https://github.com/uzh-bf/klicker-uzh/commit/aaa8533bfc5ad16c68c4f630441e126d1f4200b3))


### Enhancements

* **frontend-manage:** add possibility to embed direct evaluation links ([#3175](https://github.com/uzh-bf/klicker-uzh/issues/3175)) ([0cc20bc](https://github.com/uzh-bf/klicker-uzh/commit/0cc20bcbd637bd7be8cc12a619bd6ea136ff9393))
* **frontend-manage:** reintroduce dnd-functionality to live session creation ([#3174](https://github.com/uzh-bf/klicker-uzh/issues/3174)) ([ef34999](https://github.com/uzh-bf/klicker-uzh/commit/ef349990ff2219daa7508e866271ddb699e40bcb))
* **manage-frontend:** add additional confirmation for question deletion ([#3166](https://github.com/uzh-bf/klicker-uzh/issues/3166)) ([cd955ce](https://github.com/uzh-bf/klicker-uzh/commit/cd955ce1c8ea18b1b60b9191916da4733d57bc9e))


### Other

* adapt commands for achievement seeding ([29169d9](https://github.com/uzh-bf/klicker-uzh/commit/29169d9e936c45e9bf09a188651b43b5ceeea5fa))
* add achievements seed ([3780c27](https://github.com/uzh-bf/klicker-uzh/commit/3780c27aebe7b5b38e13058a900363a792b46efb))
* add cypress setup and initial e2e tests ([#3126](https://github.com/uzh-bf/klicker-uzh/issues/3126)) ([4f4945c](https://github.com/uzh-bf/klicker-uzh/commit/4f4945c811d648d883896ff214f78fc857d1b7b1))
* lockfile maintenance ([a5e6f78](https://github.com/uzh-bf/klicker-uzh/commit/a5e6f781039a20c90203a23e94dc322143884001))
* release prod 109 ([43fc674](https://github.com/uzh-bf/klicker-uzh/commit/43fc6747d5bb6d61a35b4c29d819c4bd55e6e3c0))
* seed update ([12d6fdf](https://github.com/uzh-bf/klicker-uzh/commit/12d6fdf18c7493b7c9504106f8904504efb6ccb7))
* seed update ([4e2aeea](https://github.com/uzh-bf/klicker-uzh/commit/4e2aeeaf99753e4d3c289068fd8ba48d7bc9af6d))
* seed update for week 13 ([4a21d1b](https://github.com/uzh-bf/klicker-uzh/commit/4a21d1b4a561cd4c5d149fba8dc265e616775cbf))

## [2.0.0-alpha.109](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.108...v2.0.0-alpha.109) (2022-12-12)


### Features

* foundations of customizable achievements and rewards ([#3150](https://github.com/uzh-bf/klicker-uzh/issues/3150)) ([b469693](https://github.com/uzh-bf/klicker-uzh/commit/b4696939ce44700ce3ad8ab5763a7d7496660ad4))


### Bug Fixes

* **packages/grading:** ensure that solution ranges contain at least one of the borders ([c8883bc](https://github.com/uzh-bf/klicker-uzh/commit/c8883bc7d05db06bc70883a25bf3dfc990cd92bb))


### Refactors

* **frontend-manage:** update and adapt select component ([#3129](https://github.com/uzh-bf/klicker-uzh/issues/3129)) ([6778ac3](https://github.com/uzh-bf/klicker-uzh/commit/6778ac38c981b3b2c38ef231c43a866b39b4d4f2))
* restructure className attributes across all components after design-system update ([#3148](https://github.com/uzh-bf/klicker-uzh/issues/3148)) ([a4e72fd](https://github.com/uzh-bf/klicker-uzh/commit/a4e72fd5708fffce89e03cf67cff93c4bd93b541))


### Other

* **deploy:** update production version ([58c8c36](https://github.com/uzh-bf/klicker-uzh/commit/58c8c36bfb5afa77bc748d39718ac7be2b4c3614))
* seed update ([31c837b](https://github.com/uzh-bf/klicker-uzh/commit/31c837bf1827676b311ab80c6da828d64c6d865d))
* seed update ([cb0afe1](https://github.com/uzh-bf/klicker-uzh/commit/cb0afe1318738476403a1d81f431321df1b07ba3))
* submodule update ([fe8b36d](https://github.com/uzh-bf/klicker-uzh/commit/fe8b36d5292eda1803b4b88e1aced2b8641b59c3))


### Enhancements

* **frontend-manage:** add possibility to change text size on evaluation ([#3149](https://github.com/uzh-bf/klicker-uzh/issues/3149)) ([e7a0671](https://github.com/uzh-bf/klicker-uzh/commit/e7a06712a956120105e192b789a6923332c64aba))
* **frontend-manage:** replace custom header with navbar component from design-system ([#3132](https://github.com/uzh-bf/klicker-uzh/issues/3132)) ([3af70e2](https://github.com/uzh-bf/klicker-uzh/commit/3af70e293bf979e1c20988a31a31e3f28c940212))

## [2.0.0-alpha.108](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.107...v2.0.0-alpha.108) (2022-12-01)


### Enhancements

* **frontend-manage:** add course leaderboard statistics ([#3127](https://github.com/uzh-bf/klicker-uzh/issues/3127)) ([b1c76be](https://github.com/uzh-bf/klicker-uzh/commit/b1c76bed990793c4a5336e131f9118e891d06d74))
* implement basic sorting for sessions depending on status ([#3128](https://github.com/uzh-bf/klicker-uzh/issues/3128)) ([88a7f61](https://github.com/uzh-bf/klicker-uzh/commit/88a7f61d5f013c5e1bfded3363760aec7df2c79c))


### Other

* lockfile maintenance ([2e9fc48](https://github.com/uzh-bf/klicker-uzh/commit/2e9fc483d12fd968293673cad732c06bf18bb25a))
* lockfile maintenance ([b4738bd](https://github.com/uzh-bf/klicker-uzh/commit/b4738bd7aca8727d3a0f8e99cdc2053853172931))
* seed update ([4ccbda1](https://github.com/uzh-bf/klicker-uzh/commit/4ccbda115cfb638603d943c561bc164c1905d8f8))
* seed update for BF1 week 12 ([9cce7a8](https://github.com/uzh-bf/klicker-uzh/commit/9cce7a85674a6aa4a68231234380256854a1c6bb))
* submodule update ([8a1fe93](https://github.com/uzh-bf/klicker-uzh/commit/8a1fe938900c634b193a3bbb0e8fbf7d809e7941))

## [2.0.0-alpha.107](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.106...v2.0.0-alpha.107) (2022-11-29)


### Other

* production version ([10b49c8](https://github.com/uzh-bf/klicker-uzh/commit/10b49c86316a3b9b781a2908b891a3c5472014df))


### Enhancements

* **packages/graphql:** shuffle instances before ordering by last response ([c99f0f4](https://github.com/uzh-bf/klicker-uzh/commit/c99f0f4d52d071f20f561db5e505b42d9c8addf6))

## [2.0.0-alpha.106](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.105...v2.0.0-alpha.106) (2022-11-29)


### Bug Fixes

* leaderboard logic ([d4e735a](https://github.com/uzh-bf/klicker-uzh/commit/d4e735aa031d9c5b56d4457233acfc8fb086fd0d))

## [2.0.0-alpha.105](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.104...v2.0.0-alpha.105) (2022-11-29)


### Bug Fixes

* **packages/graphql:** ensure that score and pointsawarded can be floats ([33e619e](https://github.com/uzh-bf/klicker-uzh/commit/33e619ee489cfdde477eb3b99140bb9298bb23fe))


### Other

* lockfile maintenance ([aa703b2](https://github.com/uzh-bf/klicker-uzh/commit/aa703b2790144c0375bb0c7f25fc7cf6c25e874f))

## [2.0.0-alpha.104](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.103...v2.0.0-alpha.104) (2022-11-29)


### Features

* add points multiplicator on learning elements and questions ([#3124](https://github.com/uzh-bf/klicker-uzh/issues/3124)) ([56a651f](https://github.com/uzh-bf/klicker-uzh/commit/56a651febabda2b601c148a0d0fb47227cfce042))


### Bug Fixes

* **frontend-manage:** fix initialization of choices on question creation ([0e5f713](https://github.com/uzh-bf/klicker-uzh/commit/0e5f713cc7fc305c7a2935800e39f23e66693f28))


### Deployment

* update production version ([b908e56](https://github.com/uzh-bf/klicker-uzh/commit/b908e561da7b9891b5211e324d55129ed203d2b0))


### Documentation

* update README for v3 ([#3080](https://github.com/uzh-bf/klicker-uzh/issues/3080)) ([6f196ea](https://github.com/uzh-bf/klicker-uzh/commit/6f196ea4642daf85765876300a7ecfb70a306077))


### Dependencies

* upgrade to next 13 ([#3100](https://github.com/uzh-bf/klicker-uzh/issues/3100)) ([5c21755](https://github.com/uzh-bf/klicker-uzh/commit/5c21755bf4ada5d9b07055d9fed31bf66f566f9d))


### Other

* **packages/graphql:** add .env.template ([e3db957](https://github.com/uzh-bf/klicker-uzh/commit/e3db957d9ca3501badef9d7b8bb3e8f176a0443c))
* **packages/prisma:** add INITIAL_PASSWORD to .env.template ([0e05cb0](https://github.com/uzh-bf/klicker-uzh/commit/0e05cb07760c826c2bdde63426ab67c91a4988f6))
* **packages/prisma:** seed update ([7ff53e7](https://github.com/uzh-bf/klicker-uzh/commit/7ff53e76ac972ea970eaacc8f3620265f4a5e000))
* **packages/prisma:** seed update ([9e09d3c](https://github.com/uzh-bf/klicker-uzh/commit/9e09d3c9589c96d9ae515f899f6f9f00b8db0137))
* **packages/prisma:** seed update ([5cb7aa8](https://github.com/uzh-bf/klicker-uzh/commit/5cb7aa8051f93553db498f968f9f437840cb0398))
* **README:** fix docs link and add discussion link ([5703b48](https://github.com/uzh-bf/klicker-uzh/commit/5703b48cfa92b0b29924a5ab4435ef502ba784dd))
* seed update for week 11 BF1 ([213f608](https://github.com/uzh-bf/klicker-uzh/commit/213f608951408bd45683356c824a4f4dac3aee0e))


### Refactors

* **frontend-manage:** move collapsible on session list to design-system ([#3105](https://github.com/uzh-bf/klicker-uzh/issues/3105)) ([5c3377e](https://github.com/uzh-bf/klicker-uzh/commit/5c3377e8a794a8edd9104493d75b5c8677be1460))


### Enhancements

* create course overview ([#3074](https://github.com/uzh-bf/klicker-uzh/issues/3074)) ([a2975cb](https://github.com/uzh-bf/klicker-uzh/commit/a2975cbfa350e4c7beda9147138612efadaa0148))
* **frontend-*:** add maximum length to feedbacks and responses ([#3123](https://github.com/uzh-bf/klicker-uzh/issues/3123)) ([571f7ce](https://github.com/uzh-bf/klicker-uzh/commit/571f7ce3e6311baa2b9336082362adecdd342ab5))
* **frontend-manage:** add question collapse to evaluation page ([#3063](https://github.com/uzh-bf/klicker-uzh/issues/3063)) ([69d8481](https://github.com/uzh-bf/klicker-uzh/commit/69d84815d3e7fa2f43283753ae561ecccbae5a80))
* **frontend-manage:** add tag highlighting for filtered tags ([#3125](https://github.com/uzh-bf/klicker-uzh/issues/3125)) ([eb3639d](https://github.com/uzh-bf/klicker-uzh/commit/eb3639de4173498356f835262a1ddcd97f27f2c3))
* **frontend-manage:** reintroduce tag filtering ([#3073](https://github.com/uzh-bf/klicker-uzh/issues/3073)) ([789e23b](https://github.com/uzh-bf/klicker-uzh/commit/789e23ba7381acb588d1fd176c573e804e37ed68))
* implement improved session list ([#3077](https://github.com/uzh-bf/klicker-uzh/issues/3077)) ([66310e4](https://github.com/uzh-bf/klicker-uzh/commit/66310e48f44ba19d450c7d67718540816b501def))

## [2.0.0-alpha.103](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.102...v2.0.0-alpha.103) (2022-11-21)


### Bug Fixes

* quickfix to ensure that login buttons do not influence style on landing page ([d25acf7](https://github.com/uzh-bf/klicker-uzh/commit/d25acf7551f81f9c2aeaac9d1efe2cc3d795ef77))


### Enhancements

* finalize evaluation page ([#3057](https://github.com/uzh-bf/klicker-uzh/issues/3057)) ([220c012](https://github.com/uzh-bf/klicker-uzh/commit/220c0125ad93bedaf3bf28e1b6aef1c8791f6a9d))


### Other

* **docs:** add updates to development page and link to concept ([b2a96ef](https://github.com/uzh-bf/klicker-uzh/commit/b2a96ef90100180fe7e0c98d583750c5349f7236))
* **docs:** ensure that sticky login and signup buttons are again shown on the entire landing page ([0f284c2](https://github.com/uzh-bf/klicker-uzh/commit/0f284c2eea3fd7490bbdda69722b3cd941d9f756))
* prod release upgrade ([5b42d27](https://github.com/uzh-bf/klicker-uzh/commit/5b42d27b8eba335289a69c54fef7949bcc978575))
* seed update ([bfa8417](https://github.com/uzh-bf/klicker-uzh/commit/bfa8417746b65b60d19305834d10cea348e16a65))

## [2.0.0-alpha.102](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.101...v2.0.0-alpha.102) (2022-11-11)


### Bug Fixes

* ensure that courseId is fetched for learning element repetition ([8df5a12](https://github.com/uzh-bf/klicker-uzh/commit/8df5a12084531988f114500afc05b96b558f2c50))

## [2.0.0-alpha.101](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.100...v2.0.0-alpha.101) (2022-11-10)


### Features

* learning element repetition on index page ([8575bc9](https://github.com/uzh-bf/klicker-uzh/commit/8575bc944eb8346d5d6db5fd0cfbf32086b84519))


### Other

* **packages/prisma:** update seed with draft microlearning bf1 week 09 ([7850490](https://github.com/uzh-bf/klicker-uzh/commit/7850490d9a0c219d75f8c73393f1c9e3eda36e4d))

## [2.0.0-alpha.100](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.99...v2.0.0-alpha.100) (2022-11-10)


### Features

* new evaluation page ([#3023](https://github.com/uzh-bf/klicker-uzh/issues/3023)) ([64ef4e3](https://github.com/uzh-bf/klicker-uzh/commit/64ef4e3d3ae79b85890eed63e543248d9f92f53b))


### Other

* **deploy:** update production version ([d7af987](https://github.com/uzh-bf/klicker-uzh/commit/d7af987efcb9cddf1ea1b77b7ebce6c55da91daf))

## [2.0.0-alpha.99](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.98...v2.0.0-alpha.99) (2022-11-09)


### Enhancements

* **apps/frontend-pwa:** enlarge text for podium ([3c8cea0](https://github.com/uzh-bf/klicker-uzh/commit/3c8cea078b837fc5588c447a274028e74ebe8046))

## [2.0.0-alpha.98](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.97...v2.0.0-alpha.98) (2022-11-09)


### Other

* **deploy:** update version of prod deployment ([a9cbf9f](https://github.com/uzh-bf/klicker-uzh/commit/a9cbf9fc01070826c9bb05ad9c0bb36171c2585a))


### Enhancements

* **frontend-pwa:** add survey promotion and remove points on podium ([e574566](https://github.com/uzh-bf/klicker-uzh/commit/e5745660ca95218faa2f4c5b122564247e992e37))

## [2.0.0-alpha.97](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.96...v2.0.0-alpha.97) (2022-11-08)


### Bug Fixes

* **apps/frontend-pwa:** only show bf champion if any awards are defined ([293eafd](https://github.com/uzh-bf/klicker-uzh/commit/293eafd7f4ee6cea825fdb4ba45b156debc1eb36))


### Other

* lockfile maintenance ([0bb53fb](https://github.com/uzh-bf/klicker-uzh/commit/0bb53fb342ff6dd91e2b6562f30f6125281e6a3b))

## [2.0.0-alpha.96](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.95...v2.0.0-alpha.96) (2022-11-08)


### Features

* basic awards with manual assignment ([#3042](https://github.com/uzh-bf/klicker-uzh/issues/3042)) ([499ead8](https://github.com/uzh-bf/klicker-uzh/commit/499ead8c115f789ee34484f25a4631ac8179d1c1))


### Enhancements

* implement modified and improved grading functions for point distribution ([#3031](https://github.com/uzh-bf/klicker-uzh/issues/3031)) ([e7b433b](https://github.com/uzh-bf/klicker-uzh/commit/e7b433bb40370d715af53636a38862da1b7362e4))

## [2.0.0-alpha.95](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.94...v2.0.0-alpha.95) (2022-11-08)


### Enhancements

* **apps/frontend-pwa:** add text-ellipsis on overflowing participant name ([6f39af8](https://github.com/uzh-bf/klicker-uzh/commit/6f39af8bdd8244f4db69cd5efd3f71e3721f2098))

## [2.0.0-alpha.94](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.93...v2.0.0-alpha.94) (2022-11-08)


### Enhancements

* **apps/frontend-*:** small styling improvements for in-frame pages ([351a351](https://github.com/uzh-bf/klicker-uzh/commit/351a351711742aac145e840fbecbcaefead7d232))

## [2.0.0-alpha.93](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.92...v2.0.0-alpha.93) (2022-11-07)


### Other

* **apps/backend-responses:** log the request method ([1e42eb7](https://github.com/uzh-bf/klicker-uzh/commit/1e42eb7f81ddc70521f5a4d6403861afae95612f))

## [2.0.0-alpha.92](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.91...v2.0.0-alpha.92) (2022-11-07)


### Bug Fixes

* add 20 seconds buffer at the end of scheduled block close ([19dd416](https://github.com/uzh-bf/klicker-uzh/commit/19dd41691dca93298aaf0dff50875ca79aaea035))

## [2.0.0-alpha.91](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.90...v2.0.0-alpha.91) (2022-11-07)


### Bug Fixes

* dates for group task, sizing of clue text ([f3816b2](https://github.com/uzh-bf/klicker-uzh/commit/f3816b2778b18c5cd0fc8eb328bbd7dbc1ebfb4c))

## [2.0.0-alpha.90](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.89...v2.0.0-alpha.90) (2022-11-07)


### Bug Fixes

* **apps/frontend-manage:** remove sample solution coloring on entries of evaluation ([57e2879](https://github.com/uzh-bf/klicker-uzh/commit/57e2879a374e6bb0e8f7353426e8e7de3989cabf))

## [2.0.0-alpha.89](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.88...v2.0.0-alpha.89) (2022-11-07)


### Bug Fixes

* show unavailability of group activity and link to it from the group page ([3ea971a](https://github.com/uzh-bf/klicker-uzh/commit/3ea971adaab054b02a86784c6a9652fcb7c08ca3))

## [2.0.0-alpha.88](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.87...v2.0.0-alpha.88) (2022-11-07)


### Enhancements

* **apps/backend-response-processor:** add a heartbeat when pinged ([cace206](https://github.com/uzh-bf/klicker-uzh/commit/cace2063088270360c685464d52a4cd8aa4c288a))

## [2.0.0-alpha.87](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.86...v2.0.0-alpha.87) (2022-11-07)


### Features

* add group activities ([#3027](https://github.com/uzh-bf/klicker-uzh/issues/3027)) ([5224744](https://github.com/uzh-bf/klicker-uzh/commit/52247440dc492cfeb4a738f66653099bea397fc9))


### Enhancements

* basic live session creation form ([#3002](https://github.com/uzh-bf/klicker-uzh/issues/3002)) ([78afb74](https://github.com/uzh-bf/klicker-uzh/commit/78afb745b8ccaec9226687f0845b53bdf616c2cb))


### Other

* **packages/prisma:** seed update ([c03dd84](https://github.com/uzh-bf/klicker-uzh/commit/c03dd84c176eb7689a7813af87d5e0f7fa47a7a7))
* prod release ([e38d0da](https://github.com/uzh-bf/klicker-uzh/commit/e38d0da00df5e4d0ce9e9958aa180a71404f9d69))
* seed update ([d7c0d7f](https://github.com/uzh-bf/klicker-uzh/commit/d7c0d7f9b60fbb77a0dfec297c9aa3ec413ba1bc))
* seed update ([689e66d](https://github.com/uzh-bf/klicker-uzh/commit/689e66d69fad75dc33c3f30ac89b40d65c6d23fa))
* seed update for ami week 7 ([d1c2602](https://github.com/uzh-bf/klicker-uzh/commit/d1c26024265e74d48a80195cef40c98c8c8024ea))
* seed update for ami week 7 ([f469852](https://github.com/uzh-bf/klicker-uzh/commit/f469852cda2896ae451d655975e67242e2d59711))
* update local settings files with new queue name ([fa09602](https://github.com/uzh-bf/klicker-uzh/commit/fa09602c7260b1f8246762f3796a5fd1071fd247))

## [2.0.0-alpha.86](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.85...v2.0.0-alpha.86) (2022-10-31)


### Bug Fixes

* **packages/prisma:** update seed for TEST ([2783730](https://github.com/uzh-bf/klicker-uzh/commit/27837305f0cd60a0c57198b95c70829984e33b41))


### Other

* seed update ([cca623f](https://github.com/uzh-bf/klicker-uzh/commit/cca623f501793a49a4733cd526d126890744e39b))


### Enhancements

* implement quick wins for timed session blocks and session timeline ([db2d1e9](https://github.com/uzh-bf/klicker-uzh/commit/db2d1e963a5be97a5bc2dc42a088e930635a05ed))

## [2.0.0-alpha.85](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.84...v2.0.0-alpha.85) (2022-10-29)


### Deployment

* upgrade to 84 ([10418e2](https://github.com/uzh-bf/klicker-uzh/commit/10418e2a29c20a166cd31e3d3b7accb891f7b7c1))


### Enhancements

* add scheduled deactivation of session blocks with time limit ([7346406](https://github.com/uzh-bf/klicker-uzh/commit/734640694c1cd61ad5501ab9803a6b2dc21bf42c))
* **apps/frontend-pwa:** allow nonsequential execution of learning element ([16b1fdd](https://github.com/uzh-bf/klicker-uzh/commit/16b1fdd0ca025496ea9038cdacad100db28467a6))

## [2.0.0-alpha.84](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.83...v2.0.0-alpha.84) (2022-10-27)


### Bug Fixes

* **apps/frontend-pwa:** return if no previous entry ([267c2cd](https://github.com/uzh-bf/klicker-uzh/commit/267c2cd3173c2e75e1d9394c1473eb3b6de39024))

## [2.0.0-alpha.83](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.82...v2.0.0-alpha.83) (2022-10-27)


### Bug Fixes

* **apps/backend-docker:** allow session leaderboard for everyone ([feb98ae](https://github.com/uzh-bf/klicker-uzh/commit/feb98ae0936ccdca7bf23ca9785549cb840f7589))


### Other

* **deploy:** scale to 3 replicas ([35a8582](https://github.com/uzh-bf/klicker-uzh/commit/35a858201e8a1167a7d32483785b7b49f563ea48))

## [2.0.0-alpha.82](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.81...v2.0.0-alpha.82) (2022-10-26)


### Bug Fixes

* parse cookie ([97baed4](https://github.com/uzh-bf/klicker-uzh/commit/97baed43468941b66b1c243529254855535d021f))

## [2.0.0-alpha.81](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.80...v2.0.0-alpha.81) (2022-10-26)


### Bug Fixes

* leaderboard when nothing active ([d5eb5b5](https://github.com/uzh-bf/klicker-uzh/commit/d5eb5b57ca1cb544c053d3baf752c8ab7c0aea73))

## [2.0.0-alpha.80](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.79...v2.0.0-alpha.80) (2022-10-26)


### Bug Fixes

* final fixes ([7ef7470](https://github.com/uzh-bf/klicker-uzh/commit/7ef74703d181d9323bf56e93a2b1689aa2caa99d))


### Other

* release update for prod ([738625d](https://github.com/uzh-bf/klicker-uzh/commit/738625d80a46810a3ee44003ca5d539e4048c338))

## [2.0.0-alpha.79](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.78...v2.0.0-alpha.79) (2022-10-26)


### Features

* **apps/frontend-manage:** add session leaderboard to evaluation screen ([256f130](https://github.com/uzh-bf/klicker-uzh/commit/256f130f4f9a8c11566519a94f39850913892289))


### Other

* **deploy:** update production image tag ([62753aa](https://github.com/uzh-bf/klicker-uzh/commit/62753aa927af0f9099121ad5d24ea0efa9edab20))

## [2.0.0-alpha.78](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.77...v2.0.0-alpha.78) (2022-10-26)


### Other

* seed week 6 ([a8601ea](https://github.com/uzh-bf/klicker-uzh/commit/a8601eaca9150ce613fac282637235201c67ee0b))

## [2.0.0-alpha.77](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.76...v2.0.0-alpha.77) (2022-10-26)


### Features

* add a basic version of the session leaderboard ([#2993](https://github.com/uzh-bf/klicker-uzh/issues/2993)) ([41c7a01](https://github.com/uzh-bf/klicker-uzh/commit/41c7a0162e384e2a5fab24c7111f48c960d2338a))


### Bug Fixes

* **apps/backend-response-processor:** round points awarded before commit ([bdb79b0](https://github.com/uzh-bf/klicker-uzh/commit/bdb79b08ea71b4c4cec60e12b2bf48493cc54018))
* **apps/backend-response*:** improve points scheme for gamified sessions ([339e598](https://github.com/uzh-bf/klicker-uzh/commit/339e5980460049e3b09661c07b01c0f3d2aa827b))
* **apps/backend-responses:** ensure that response timestamp is in seconds ([b38b438](https://github.com/uzh-bf/klicker-uzh/commit/b38b4384b2cd78987f48667089af6699fb828f37))


### Dependencies

* upgrade all dependencies ([#2983](https://github.com/uzh-bf/klicker-uzh/issues/2983)) ([d393d77](https://github.com/uzh-bf/klicker-uzh/commit/d393d77b1751efa00b4b8018cb2d09a07030a99a))


### Other

* **apps/frontend-pwa:** mention null groups on leaderboard ([5b4cba4](https://github.com/uzh-bf/klicker-uzh/commit/5b4cba4a60a2ee1f7dea28021da154c96509a068))
* lockfile maintenance ([4a45118](https://github.com/uzh-bf/klicker-uzh/commit/4a45118d42ecf7739a43a629140fe69e9147f927))
* seed update ([0dae20c](https://github.com/uzh-bf/klicker-uzh/commit/0dae20c63f1b93d119f92e6001f3defe7014eb72))


### Enhancements

* **apps/backend-response*:** add sentry for errors ([22f3d63](https://github.com/uzh-bf/klicker-uzh/commit/22f3d6343da2f3312ff982b8e78167291e7c4073))
* **apps/backend-response*:** improve logic in response backends ([#2994](https://github.com/uzh-bf/klicker-uzh/issues/2994)) ([95ea244](https://github.com/uzh-bf/klicker-uzh/commit/95ea244746fa94be5ad1688aee75d1bce0801bbd))
* **apps/frontend-pwa:** improve group leaderboard structure ([2a6d813](https://github.com/uzh-bf/klicker-uzh/commit/2a6d8134fc5c9a72a14c35471ca995443a761215))
* **apps/frontend-pwa:** refetch queries after pin-based join ([5bc7533](https://github.com/uzh-bf/klicker-uzh/commit/5bc7533a66632bd773bbfc373e2af9e46b0edc3a))
* create page that allows users to join courses based on ID and PIN ([#2979](https://github.com/uzh-bf/klicker-uzh/issues/2979)) ([ee17023](https://github.com/uzh-bf/klicker-uzh/commit/ee17023247a525ba75364b32016a8da688bf8aef))
* implement pin structure for joining courses ([#2984](https://github.com/uzh-bf/klicker-uzh/issues/2984)) ([5a2b402](https://github.com/uzh-bf/klicker-uzh/commit/5a2b4026f84340f044b2e0c2e0120f3d02194c67))

## [2.0.0-alpha.76](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.75...v2.0.0-alpha.76) (2022-10-24)


### Bug Fixes

* **apps/backend-response-processor:** don't throw on missing response or instance info (ignore) ([18393b2](https://github.com/uzh-bf/klicker-uzh/commit/18393b2449251c60bf61021a0b6b582a5248c030))


### Other

* lockfile maintenance ([4ad3cf0](https://github.com/uzh-bf/klicker-uzh/commit/4ad3cf0707b8d449607e6b01653ce3c50279753c))
* seed update ([0f191fb](https://github.com/uzh-bf/klicker-uzh/commit/0f191fb3c82749c0c9f45355a55e39221f631311))
* seed update ([b13a581](https://github.com/uzh-bf/klicker-uzh/commit/b13a581f70172a66d1403f57db1ab1cbe6e86707))

## [2.0.0-alpha.75](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.74...v2.0.0-alpha.75) (2022-10-24)

## [2.0.0-alpha.74](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.73...v2.0.0-alpha.74) (2022-10-24)


### Deployment

* **apps/backend-response-processor:** update workflow ([50d8eac](https://github.com/uzh-bf/klicker-uzh/commit/50d8eac3612ae5648ca20f301bfbe785cbf7418a))

## [2.0.0-alpha.73](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.72...v2.0.0-alpha.73) (2022-10-24)


### Bug Fixes

* **apps/frontend-manage:** ensure that strings in answer feedbacks etc. are nullable ([c78f9f3](https://github.com/uzh-bf/klicker-uzh/commit/c78f9f3d0c5e4226239a1b99a84a7c1f1966753a))


### Other

* **frontend-manage:** fix line height issues and remove ctrl c combination for code formatting ([aea2b2e](https://github.com/uzh-bf/klicker-uzh/commit/aea2b2e672c9ca1fc734dc1bcdf7d0d33ac392ce))
* lockfile maintenance ([b8b5706](https://github.com/uzh-bf/klicker-uzh/commit/b8b5706c10cad0f53ae3ca4824d22ce42603b8db))
* **packages/prisma:** update seed commands ([db1c19f](https://github.com/uzh-bf/klicker-uzh/commit/db1c19f0c18f447074618a1c88c9481c120f02d2))
* seed update ([77fceaf](https://github.com/uzh-bf/klicker-uzh/commit/77fceafcf19c789178997003510ae9c32dfbf99e))

## [2.0.0-alpha.72](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.71...v2.0.0-alpha.72) (2022-10-23)


### Other

* **apps/backend-response-processor:** assert that redis is available ([0fdacad](https://github.com/uzh-bf/klicker-uzh/commit/0fdacad8c838651a6779a200fe1e19f76f6c027d))
* **apps/backend-response-processor:** remove ping function ([9736c14](https://github.com/uzh-bf/klicker-uzh/commit/9736c1453621b2b1d8d6c5bd491dabb8dcff6204))

## [2.0.0-alpha.71](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.70...v2.0.0-alpha.71) (2022-10-23)


### Bug Fixes

* **apps/backend-response*:** use cross-env to not fail windows build in GH actions ([f4c15cf](https://github.com/uzh-bf/klicker-uzh/commit/f4c15cf5073f19b3e937a6eedf7641f732de56cf))
* **apps/backend-responses:** install tsup in dev mode ([c83f296](https://github.com/uzh-bf/klicker-uzh/commit/c83f296a0563200e07f176b2f3110053f8258869))
* remove .ts from funcignore ([b738a4f](https://github.com/uzh-bf/klicker-uzh/commit/b738a4f22000865472e529318d25cfee0a49fead))


### Other

* **packages/prisma:** seed update ([4c3678b](https://github.com/uzh-bf/klicker-uzh/commit/4c3678bef8930ec9db74c06f60aa225313145ec1))

## [2.0.0-alpha.70](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.69...v2.0.0-alpha.70) (2022-10-23)


### Features

* refactor response inflow to queue-based processing ([#2978](https://github.com/uzh-bf/klicker-uzh/issues/2978)) ([6a6aa3f](https://github.com/uzh-bf/klicker-uzh/commit/6a6aa3f103663b4cc82c68584ddb185fc97df43a))


### Bug Fixes

* **apps/backend-response-processor:** add app setting binding for dynamic queue name ([2440bf3](https://github.com/uzh-bf/klicker-uzh/commit/2440bf36659dac41c61e27e3f714b43d3787093c))
* **apps/backend-response-processor:** ensure that jsonwebtoken is installed ([4f9a82d](https://github.com/uzh-bf/klicker-uzh/commit/4f9a82d2c769db8717d524ed8de9b9a6797c0afe))
* **apps/backend-responses:** remove out binding ([8b9ca52](https://github.com/uzh-bf/klicker-uzh/commit/8b9ca52bed0b652ad4a3df9cab1ed12d5afdf361))
* **apps/frontend-pwa:** update layouts on leaderboard ([af8e1b0](https://github.com/uzh-bf/klicker-uzh/commit/af8e1b094bdf7bebd50d00197e722931bd47fbda))
* naming of backend response processor function in workflow ([6f24482](https://github.com/uzh-bf/klicker-uzh/commit/6f2448214bb2cdcede2546fe61fb7a97c5cd737f))
* update deploy for qa response-processor function ([4eb8313](https://github.com/uzh-bf/klicker-uzh/commit/4eb8313ebdb67b34b2ee9b8b116f5ad551876791))


### Enhancements

* improve response queue logic ([85f35c8](https://github.com/uzh-bf/klicker-uzh/commit/85f35c85b22687ff53e7aeba47aba9e3bde6338c))


### Other

* **apps/backend-response-processor:** add ping trigger for uptime ([f42e4a6](https://github.com/uzh-bf/klicker-uzh/commit/f42e4a6be1f882f46981ce87eb0705c199bba277))
* deployment of alpha 69 ([573e7ea](https://github.com/uzh-bf/klicker-uzh/commit/573e7ea5fb9df7648e76693f915e2cb41fd559e7))
* lockfile maintenance ([2355bd2](https://github.com/uzh-bf/klicker-uzh/commit/2355bd2089e2bb8fb55cc84b10018ebc4c8c45eb))
* lockfile maintenance ([047b777](https://github.com/uzh-bf/klicker-uzh/commit/047b777fd8d5f8a415ea5d41a4023af4bd423298))
* migrate azure functions to tsup ([9d2ef06](https://github.com/uzh-bf/klicker-uzh/commit/9d2ef06d3eb57eb1ef3c719d9cac7d3ebd3ca618))
* **packages/graphql:** microlearning bf1 week 5 ([9dea526](https://github.com/uzh-bf/klicker-uzh/commit/9dea526bba0886fc52ad8d1ec0f44ae4e0283d1b))
* **packages/prisma:** add migration for question response details ([ebd11af](https://github.com/uzh-bf/klicker-uzh/commit/ebd11af7a8c8741dd0623615c25627ca0b0d9307))
* **packages/prisma:** update prisma interactions to enforce correct .env files per environment ([30efcbf](https://github.com/uzh-bf/klicker-uzh/commit/30efcbf0eac89fa2d22078d8cf45344668d17dc4))
* seed update ([467392d](https://github.com/uzh-bf/klicker-uzh/commit/467392dacf31b2596ce8cfb46f49d38c2d17bc77))

## [2.0.0-alpha.69](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.68...v2.0.0-alpha.69) (2022-10-18)


### Bug Fixes

* update build structure for shared-components ([2f37e43](https://github.com/uzh-bf/klicker-uzh/commit/2f37e43363757ff97cc43ab20a7b38379dc375ef))

## [2.0.0-alpha.68](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.67...v2.0.0-alpha.68) (2022-10-18)


### Features

* add question pool and manipulation capabilities ([#2913](https://github.com/uzh-bf/klicker-uzh/issues/2913)) ([6013cd8](https://github.com/uzh-bf/klicker-uzh/commit/6013cd868d120d33e060afcfe636b085c66c0b13))


### Other

* **deploy/env-prod:** update production deployment with apha 67 ([cc7b65b](https://github.com/uzh-bf/klicker-uzh/commit/cc7b65b74ca17745faa738183573fdf7dc54a2d6))

## [2.0.0-alpha.67](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.66...v2.0.0-alpha.67) (2022-10-18)


### Bug Fixes

* remove question type import ([3f75d49](https://github.com/uzh-bf/klicker-uzh/commit/3f75d49a80cdf59b891908f247c0c98a0ffd14dd))


### Other

* **deploy:** upgrade production environment ([529e372](https://github.com/uzh-bf/klicker-uzh/commit/529e3720254016099668df6e6e2af6eb2c11bc8a))
* lockfile maintenance ([be74335](https://github.com/uzh-bf/klicker-uzh/commit/be74335638c633d8859b9aa09d4dda5fea54cc2b))
* **packages/prisma:** update seed commands ([6f4ab09](https://github.com/uzh-bf/klicker-uzh/commit/6f4ab0989bd3d0bf2d49374348074f85d5eebdfa))
* seed update ([47ebf52](https://github.com/uzh-bf/klicker-uzh/commit/47ebf52c7a6ab21eaa4b3beb5d49137691737c3c))
* seed update ([21e13b4](https://github.com/uzh-bf/klicker-uzh/commit/21e13b460c10790d5a8187f84b114152916fbaf9))
* seed update ([420f28d](https://github.com/uzh-bf/klicker-uzh/commit/420f28d7dea17957d79269658ec9be467301605b))
* seed update ([be0b377](https://github.com/uzh-bf/klicker-uzh/commit/be0b377141298be0e0c7b3b042c4362ec8038fa8))
* seed update ([4559942](https://github.com/uzh-bf/klicker-uzh/commit/4559942939a990e89e4bffb2c9c2967133b7c855))
* update seed with test data ([95f7f2a](https://github.com/uzh-bf/klicker-uzh/commit/95f7f2ad4494a19ca1c1421fca31227fdb89856a))


### Enhancements

* **apps/frontend-pwa:** new group visualization ([0808419](https://github.com/uzh-bf/klicker-uzh/commit/08084198a139782513a91e4430b90fd916e911ea))

## [2.0.0-alpha.66](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.65...v2.0.0-alpha.66) (2022-10-09)


### Bug Fixes

* **deploy:** ensure that cron schedule is quoted ([eaf3b04](https://github.com/uzh-bf/klicker-uzh/commit/eaf3b048cf3e6b912704a13c2cf4e3c17613dc56))
* **packages/graphql:** ensure that singleplayer groups get zero points for members ([4a87a82](https://github.com/uzh-bf/klicker-uzh/commit/4a87a826543d98cddcf11ba5c45998bc040ba330))


### Enhancements

* **deploy:** dynamic cron schedules in chart ([be94751](https://github.com/uzh-bf/klicker-uzh/commit/be9475104ffb197e2eccfa4d03433280187d019e))


### Other

* **deploy:** update production deployment ([8641cbf](https://github.com/uzh-bf/klicker-uzh/commit/8641cbff848bdb8954ae461744bc76034e5e2231))

## [2.0.0-alpha.65](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.64...v2.0.0-alpha.65) (2022-10-09)


### Bug Fixes

* **deploy:** use args for the curl container ([167d026](https://github.com/uzh-bf/klicker-uzh/commit/167d026f7ba7def7ac84852440925516bc3eacff))
* **packages/graphql:** ensure the matching leaderboard is used in average group score computation ([7243ce0](https://github.com/uzh-bf/klicker-uzh/commit/7243ce0cac6ada8af53f977ae3fd0e139fad11b6))


### Enhancements

* **apps/frontend-pwa:** improve group and leaderboard display ([06ad275](https://github.com/uzh-bf/klicker-uzh/commit/06ad2750c800a3ced1fba0c030b353c4e156af89))


### Other

* **deploy:** add heartbeats for group scores ([a896fba](https://github.com/uzh-bf/klicker-uzh/commit/a896fba370baa809a851e65fb1f9a6bc0ae36fad))

## [2.0.0-alpha.64](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.63...v2.0.0-alpha.64) (2022-10-09)


### Enhancements

* improve groups logic with average score cronjob ([#2955](https://github.com/uzh-bf/klicker-uzh/issues/2955)) ([4d86e60](https://github.com/uzh-bf/klicker-uzh/commit/4d86e60a769e08baea65e3bd43f93bbb4aa4cd41))

## [2.0.0-alpha.63](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.62...v2.0.0-alpha.63) (2022-10-08)


### Features

* participant groups and leaderboards ([#2905](https://github.com/uzh-bf/klicker-uzh/issues/2905)) ([0833cca](https://github.com/uzh-bf/klicker-uzh/commit/0833cca54fe2945bf33b55da26fd1465997d7b5d))


### Other

* final seed update for AMI week 3 ([02d6177](https://github.com/uzh-bf/klicker-uzh/commit/02d6177db91160fbfbbcee3f872926829d9b22cb))
* lockfile maintenance ([478ab07](https://github.com/uzh-bf/klicker-uzh/commit/478ab07f94a8504c56afe868e6df259d24dc63e5))
* **packages/graphql:** add npm script for push send ([63fd7be](https://github.com/uzh-bf/klicker-uzh/commit/63fd7beaaeb3787080f300f0bddefe97a13212db))
* seed update ([0d7fec6](https://github.com/uzh-bf/klicker-uzh/commit/0d7fec6c9834df7fa898bd13cb4604af5f3e6aff))
* seed update ([c9719fc](https://github.com/uzh-bf/klicker-uzh/commit/c9719fc81c210c4bdf38f5d282b92fa8d7fe913e))
* seed update ([0c31291](https://github.com/uzh-bf/klicker-uzh/commit/0c3129163257bc86f53ef510ef17c8627b4ed306))
* seed update ([d51af43](https://github.com/uzh-bf/klicker-uzh/commit/d51af438dacf72f1e2f32eed69e19c2b9fcf312b))
* seed update ([b0a9ded](https://github.com/uzh-bf/klicker-uzh/commit/b0a9ded595b45ff27118fce9629c8cd2129451ba))
* seed update ([a22b5f3](https://github.com/uzh-bf/klicker-uzh/commit/a22b5f306843c6e1db76154c5b031916f69a800a))
* seed update ([f5b88b1](https://github.com/uzh-bf/klicker-uzh/commit/f5b88b11843cd21bf05ba2e2cadc2f9a4c0741e3))
* update seed ([5dee789](https://github.com/uzh-bf/klicker-uzh/commit/5dee7899391fadfd131c4df0f9e26f5a1f572f64))

## [2.0.0-alpha.62](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.61...v2.0.0-alpha.62) (2022-09-29)


### Other

* disable sentry in frontends for now ([974641a](https://github.com/uzh-bf/klicker-uzh/commit/974641a8e6dc45611cff48e947ac30e1b4096379))

## [2.0.0-alpha.61](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.60...v2.0.0-alpha.61) (2022-09-29)


### Features

* **frontend-manage:** readd filtering possibilities for feedback section ([#2922](https://github.com/uzh-bf/klicker-uzh/issues/2922)) ([5ba37ee](https://github.com/uzh-bf/klicker-uzh/commit/5ba37ee23d719a658ee7fa61a97d2003364e8820))


### Bug Fixes

* **apps/frontend-pwa:** participant token before redirect on join page ([846b2f0](https://github.com/uzh-bf/klicker-uzh/commit/846b2f0aa638af06a32d4e3a90d3e3761efd3834))


### Deployment

* add sentry config to deployments ([b848476](https://github.com/uzh-bf/klicker-uzh/commit/b848476e9d220de44418cd85f78ef4c734550677))


### Other

* **apps/frontend-manage:** basic sentry setup ([2bf09c6](https://github.com/uzh-bf/klicker-uzh/commit/2bf09c6c41e2e65d8cb2830a4d70535818d90c1f))
* **apps/frontend-pwa:** basic sentry setup ([f487be5](https://github.com/uzh-bf/klicker-uzh/commit/f487be5a572271e25754bab58c7dde8941cf0579))
* **packages/graphql:** improve push sending util to loop through subscriptions ([6d9eb3b](https://github.com/uzh-bf/klicker-uzh/commit/6d9eb3b7382ca74411febc0ba7aaea041697ec4f))
* **packages/prisma:** update seed ([8ff3830](https://github.com/uzh-bf/klicker-uzh/commit/8ff3830100735642781cad53def84619b04a043d))
* submodule seed update ([a1c6297](https://github.com/uzh-bf/klicker-uzh/commit/a1c629759e4c5bda383d9a0026f2c1fe7872bbf3))
* upgrade deployed version ([fa9a440](https://github.com/uzh-bf/klicker-uzh/commit/fa9a44090c1a3f8f51773ebe35ecdb30c4d257de))


### Enhancements

* **apps/frontend-manage:** add evaluation link to a session ([73b70a4](https://github.com/uzh-bf/klicker-uzh/commit/73b70a465641d2efba5bb24547b7be670e57f938))
* rework of navigation on session evaluation, improve coloring of charts ([#2936](https://github.com/uzh-bf/klicker-uzh/issues/2936)) ([86e5401](https://github.com/uzh-bf/klicker-uzh/commit/86e5401aa6158cdaef0e0b376de571ca7cdc0aec))

## [2.0.0-alpha.60](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.59...v2.0.0-alpha.60) (2022-09-26)


### Other

* **packages/graphql:** rebuild generated artifacts ([98954ea](https://github.com/uzh-bf/klicker-uzh/commit/98954eaacad0032a151b4b123bb1b7705eeb805e))


### Enhancements

* basic evaluation page for SC ([7a7a6db](https://github.com/uzh-bf/klicker-uzh/commit/7a7a6db13fa3dc0de69d4e9eb5d50bd02b27bb3d))

## [2.0.0-alpha.59](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.58...v2.0.0-alpha.59) (2022-09-25)


### Features

* graphql subscriptions for feedbacks with websockets ([#2912](https://github.com/uzh-bf/klicker-uzh/issues/2912)) ([5c50541](https://github.com/uzh-bf/klicker-uzh/commit/5c50541fb51124361f66d4958b13cb2ecbacb2e3))


### Deployment

* add rollout scripts for container restart ([50b8dfd](https://github.com/uzh-bf/klicker-uzh/commit/50b8dfd0d681be0b8e66b44e27d9976294b3d042))
* use app version for sentry release, add DEBUG env value for backend ([8ed0441](https://github.com/uzh-bf/klicker-uzh/commit/8ed0441000d1fbf66ee6f80591a6b4b32c032966))


### Other

* **apps/backend-docker:** add DEBUG to disable error masking ([9ba8684](https://github.com/uzh-bf/klicker-uzh/commit/9ba8684a329d7fcc552e83ea39b90ad3a675cd96))
* **apps/backend-docker:** disable sentry envelop plugin for now ([e8e84f3](https://github.com/uzh-bf/klicker-uzh/commit/e8e84f3de9ef7133c7876eafeaab8f8860c01072))
* lockfile maintenance ([aab69aa](https://github.com/uzh-bf/klicker-uzh/commit/aab69aa702536e5132e81fa092e3b2d458a7b673))
* **packages/prisma:** add initial migration based on qa/prod db state ([d07f2c0](https://github.com/uzh-bf/klicker-uzh/commit/d07f2c02a917c0dbd24521e632f18e71ff0bb7b7))
* **packages/prisma:** ensure that migrate reset runs the seeds afterwards ([07d8539](https://github.com/uzh-bf/klicker-uzh/commit/07d85391dd71393453b8484928087b2463fb38f6))
* remove migrations ([98c6a08](https://github.com/uzh-bf/klicker-uzh/commit/98c6a08d9d0edacfce0b83b21e822b37c768152a))

## [2.0.0-alpha.58](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.57...v2.0.0-alpha.58) (2022-09-25)


### Bug Fixes

* **apps/frontend-pwa:** ensure negative numbers can be entered for numerical questions ([db7d147](https://github.com/uzh-bf/klicker-uzh/commit/db7d147c2dfe3f6144d06606d2de0aa9fcfcaaf7))
* enable retry link in PWA to allow for SSE after initial failure ([#2911](https://github.com/uzh-bf/klicker-uzh/issues/2911)) ([93b1e60](https://github.com/uzh-bf/klicker-uzh/commit/93b1e6080ed0cc566526da2d770e0ba6517c7af6))


### Deployment

* move vercel dev deployments to workflow drafts (disable) ([f27c724](https://github.com/uzh-bf/klicker-uzh/commit/f27c724a94690606ad509602601ae378a2c065b2))


### Other

* add priority classname to deployments, add empty AMI micro rep to seed ([10a9532](https://github.com/uzh-bf/klicker-uzh/commit/10a9532b1116c0eed8e8251f16feb1c67d23c094))
* add submodule for seeding ([c3c5ca8](https://github.com/uzh-bf/klicker-uzh/commit/c3c5ca8df75cb16985d8261c991c1a07767db905))
* evaluate yoga link ([277a51e](https://github.com/uzh-bf/klicker-uzh/commit/277a51e92ece3b832dfd2fc541ee9c51a864ad62))
* lockfile maintenance ([620a7d0](https://github.com/uzh-bf/klicker-uzh/commit/620a7d0cb5cd0a9ac8d510121a082d63ba8ae09a))
* **packages/prisma:** add seed for AMI lecture ([0ecd4f4](https://github.com/uzh-bf/klicker-uzh/commit/0ecd4f489cf567512a02127a0a16b983f136907d))
* update dependabot config ([a459bd9](https://github.com/uzh-bf/klicker-uzh/commit/a459bd9e4b7c9cb7c9f33bb75ca92df65a0b70e0))
* update seed submodule ([d64458c](https://github.com/uzh-bf/klicker-uzh/commit/d64458c0b56afada20f7ca947ff365528bfe33c7))
* update seed submodule ([e9c465b](https://github.com/uzh-bf/klicker-uzh/commit/e9c465be06f33e7b9fbc5a61fb46aa53a4260ab0))

## [2.0.0-alpha.57](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.56...v2.0.0-alpha.57) (2022-09-24)


### Deployment

* use redis master as a caching connection ([6c8e61a](https://github.com/uzh-bf/klicker-uzh/commit/6c8e61a84058888ee4c0f808e6709ce24152bc8d))


### Enhancements

* **frontend-*:** improve header and tab title naming, upgrade next to 12.3.1 ([8b2044b](https://github.com/uzh-bf/klicker-uzh/commit/8b2044b8365068062bab352dc5bb4d05e0d9308e))
* **packages/prisma:** improve upsertion of existing elements, extend seed for BF1 and AMI ([caf454a](https://github.com/uzh-bf/klicker-uzh/commit/caf454ac34fcb5f96329d042fad06df3b57e3d65))

## [2.0.0-alpha.56](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.55...v2.0.0-alpha.56) (2022-09-22)


### Features

* session leaderboards and evaluation, subscriptions ([#2894](https://github.com/uzh-bf/klicker-uzh/issues/2894)) ([e06a59d](https://github.com/uzh-bf/klicker-uzh/commit/e06a59d7413d4d5bc163264cd56cbd708dada2c6))


### Bug Fixes

* **apps/frontend-pwa:** only show profile creation button if logged in ([eaf9e4a](https://github.com/uzh-bf/klicker-uzh/commit/eaf9e4a46f9a9efcb0d320e82f5b21d61c2bded7))


### Deployment

* update chart for redis and sentry ([09a3f61](https://github.com/uzh-bf/klicker-uzh/commit/09a3f618a40891f3250527d3e183f11c8d93b091))


### Enhancements

* **packages/prisma:** add order for blocks and instances ([31cdb3c](https://github.com/uzh-bf/klicker-uzh/commit/31cdb3c86f8ffe5f5d9e6ce5632227bb803f5fc4))


### Other

* add version update for chart v2 version ([00f70f2](https://github.com/uzh-bf/klicker-uzh/commit/00f70f2f2ebc12688863069eb013c4f590112c0c))
* **apps/frontend-pwa:** stubs for group join and group create ([c25c522](https://github.com/uzh-bf/klicker-uzh/commit/c25c522899ebcc9d35186ebb87f1640408c1eb7a))
* **packages/prisma:** add AMI color ([8794ea6](https://github.com/uzh-bf/klicker-uzh/commit/8794ea6ade70dab817a0ef10cd168aeefe12d91c))
* seed updates ([5524ed7](https://github.com/uzh-bf/klicker-uzh/commit/5524ed7f81e30479b9a2c905f5c618028cddb3b3))
* update AMI seed for first question set ([#2896](https://github.com/uzh-bf/klicker-uzh/issues/2896)) ([66dcee0](https://github.com/uzh-bf/klicker-uzh/commit/66dcee034a18323a393651a4d4c75252e5fbf401))

## [2.0.0-alpha.55](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.54...v2.0.0-alpha.55) (2022-09-20)


### Bug Fixes

* show all participations (not only active), show all leaderboard entries ([9206cb1](https://github.com/uzh-bf/klicker-uzh/commit/9206cb1fe907051dafaf02d3652c7644634c1790))


### Other

* **packages/prisma:** update seed ([387d237](https://github.com/uzh-bf/klicker-uzh/commit/387d23777626c4f9d938f8eaaead25501815b647))

## [2.0.0-alpha.54](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.53...v2.0.0-alpha.54) (2022-09-20)


### Other

* lockfile maintenance ([3309ed9](https://github.com/uzh-bf/klicker-uzh/commit/3309ed90b0511fda8171c213332c39b098cc5273))

## [2.0.0-alpha.53](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.52...v2.0.0-alpha.53) (2022-09-20)


### Other

* **apps/backend-docker:** ensure SENTRY env variables are read implicitly ([3529e82](https://github.com/uzh-bf/klicker-uzh/commit/3529e8253a506435891e7ab6282d10e8fa49d25f))

## [2.0.0-alpha.52](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.51...v2.0.0-alpha.52) (2022-09-20)


### Enhancements

* **apps/backend-docker:** setup sentry with envelop integration ([b9abfd2](https://github.com/uzh-bf/klicker-uzh/commit/b9abfd29e8d27e008c1ee4dd6c94386d989e5f00))

## [2.0.0-alpha.51](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.50...v2.0.0-alpha.51) (2022-09-20)


### Enhancements

* improve layout of formulas in feedbacks ([d4b7ac1](https://github.com/uzh-bf/klicker-uzh/commit/d4b7ac1759144104c43ee5e36770227ee3ab2824))

## [2.0.0-alpha.50](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.49...v2.0.0-alpha.50) (2022-09-20)


### Bug Fixes

* **apps/frontend-pwa:** show self entry on leaderboard even when not included ([feefaee](https://github.com/uzh-bf/klicker-uzh/commit/feefaee38eb444f19e0c5a54ff0f8f15552f82d7))


### Deployment

* setup local redis cache for the QA environment ([0ac8855](https://github.com/uzh-bf/klicker-uzh/commit/0ac88552bfb7e4d2469d535b8fb4b9480b93d64b))


### Enhancements

* **packages/graphql:** return the participant id on leaderboard entries ([3b2fbac](https://github.com/uzh-bf/klicker-uzh/commit/3b2fbac52bb696ffd5d94e3812b657e6cd593e28))
* **packages/prisma:** add question instance type ([32ca9b3](https://github.com/uzh-bf/klicker-uzh/commit/32ca9b302b7738cec9249b9756ed59102fabf96c))


### Other

* lockfile maintenance ([f052e83](https://github.com/uzh-bf/klicker-uzh/commit/f052e832d6e84f935061caf70c216048d32de2b1))
* lockfile maintenance ([4bab93f](https://github.com/uzh-bf/klicker-uzh/commit/4bab93f1bc32e518fb9169a211358115ccff02b2))

## [2.0.0-alpha.49](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.48...v2.0.0-alpha.49) (2022-09-20)


### Bug Fixes

* **apps/frontend-pwa:** issue in courseID index ([1727795](https://github.com/uzh-bf/klicker-uzh/commit/17277955ec018882f7e86338ac4af8ec87a438be))


### Other

* move frontend .env to klicker.uzh.ch ([b12d7b8](https://github.com/uzh-bf/klicker-uzh/commit/b12d7b8be6cf0623931f5c768595a7590e599d0a))
* update BF seed for micro testing ([63a9264](https://github.com/uzh-bf/klicker-uzh/commit/63a92640e6658b0debfbdd74c4883eb446164405))

## [2.0.0-alpha.48](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.47...v2.0.0-alpha.48) (2022-09-19)


### Other

* add templates for SC and KPRIM ([144898f](https://github.com/uzh-bf/klicker-uzh/commit/144898ffe3dad0b256c1d3715bb85a12464cfe11))
* lockfile maintenance ([cb79507](https://github.com/uzh-bf/klicker-uzh/commit/cb79507a9b348802fc94868dedda18d3c52f23bf))
* **packages/graphql:** prepare basic web push example script ([9bd480d](https://github.com/uzh-bf/klicker-uzh/commit/9bd480dfdc2f6d10396acd7bc42062ac9c698833))


### Enhancements

* **apps/frontend-pwa:** improve layout across micro session and learning element, improve consistency, add markdown for feedbacks on options ([88afc13](https://github.com/uzh-bf/klicker-uzh/commit/88afc13982e5499d31bb28847183fd8be5e7f6ce))
* mark micro sessions as completed, show evaluation screen ([40922be](https://github.com/uzh-bf/klicker-uzh/commit/40922be4c8d5fd228a266c35d77cf3c100f0b89b))

## [2.0.0-alpha.47](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.46...v2.0.0-alpha.47) (2022-09-19)


### Bug Fixes

* **apps/backend-docker:** finalize sorting logic for leaderboard ([e0490cf](https://github.com/uzh-bf/klicker-uzh/commit/e0490cfe6d7a76567db513f4cc8b430e46075c19))

## [2.0.0-alpha.46](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.45...v2.0.0-alpha.46) (2022-09-19)


### Enhancements

* improve leaderboard logic for removal of self on leave ([82cf837](https://github.com/uzh-bf/klicker-uzh/commit/82cf8372f97565fe4a05b577c791a80deefb5f32))

## [2.0.0-alpha.45](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.44...v2.0.0-alpha.45) (2022-09-19)


### Bug Fixes

* **apps/frontend-pwa:** ensure a message is displayed on the learning element evaluation ([3772295](https://github.com/uzh-bf/klicker-uzh/commit/3772295837b88ddae30dd979d033eba0f784d0a6))

## [2.0.0-alpha.44](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.43...v2.0.0-alpha.44) (2022-09-19)


### Bug Fixes

* **apps/backend-docker:** evaluate ARG ENV approach for NODE_ENV ([b09dbf4](https://github.com/uzh-bf/klicker-uzh/commit/b09dbf4f680fb8832351c245e74eb66d0e499c93))
* ensure leaderboard entries are not cached ([8f72ea8](https://github.com/uzh-bf/klicker-uzh/commit/8f72ea8c0d68b11eb296238530e413c5d0d10c20))
* use dynamic start url redirect ([f90e585](https://github.com/uzh-bf/klicker-uzh/commit/f90e585d5d622225293a25a94360f6ce8af3323c))


### Other

* release update ([7a47e50](https://github.com/uzh-bf/klicker-uzh/commit/7a47e5095c0023618136b1edeebd7645d4308789))


### Enhancements

* quick wins and sorting of leaderboard ([dc6099f](https://github.com/uzh-bf/klicker-uzh/commit/dc6099f28eadc2471d62796cfb414c5cc2a73de1))

## [2.0.0-alpha.43](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.42...v2.0.0-alpha.43) (2022-09-19)


### Bug Fixes

* **apps/frontend-pwa:** ensure that participation can be undefined ([7226eee](https://github.com/uzh-bf/klicker-uzh/commit/7226eeee4d30ca03271348cfbc2b59fe5feb418b))
* **apps/frontend-pwa:** use placeholder svg avatar from s3 ([1ab3069](https://github.com/uzh-bf/klicker-uzh/commit/1ab3069ef3bdc9d76cc6d71cb5aee30a03659350))


### Other

* **packages/prisma:** rename BF1 stuff to BFI ([6c896dd](https://github.com/uzh-bf/klicker-uzh/commit/6c896ddf61ee5d6c292d83cc969742ddbbdcd785))


### Deployment

* update params for deployments of v2 ([9778d7e](https://github.com/uzh-bf/klicker-uzh/commit/9778d7e5a52ed99a0dc51a306801cbf89b118b41))

## [2.0.0-alpha.42](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.41...v2.0.0-alpha.42) (2022-09-18)


### Other

* lockfile maintenance ([84c6a09](https://github.com/uzh-bf/klicker-uzh/commit/84c6a095c529125291c71d8cbcf599b6ea639d40))


### Enhancements

* **apps/frontend-pwa:** extend leaderboard for real data ([8a0a63e](https://github.com/uzh-bf/klicker-uzh/commit/8a0a63ec4c0bd2717f5968e41a2e289ca3f74e70))
* **packages/graphql:** implement logic for leaderboard ([810dcfd](https://github.com/uzh-bf/klicker-uzh/commit/810dcfd4126d33395d93c9b65f754d5302ec9090))

## [2.0.0-alpha.41](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.40...v2.0.0-alpha.41) (2022-09-18)


### Features

* **packages/graphql:** implement logic for points award in learning elements ([122b501](https://github.com/uzh-bf/klicker-uzh/commit/122b5011d1b927ab8d3a87172177575132894841))


### Bug Fixes

* **apps/backend-docker:** ensure that self query is public, update caching logic ([dd5899c](https://github.com/uzh-bf/klicker-uzh/commit/dd5899c6b9f9de1889303601c393e1df3db82e2c))


### Deployment

* build docker backend on tags ([b38c43b](https://github.com/uzh-bf/klicker-uzh/commit/b38c43b6c2211220729136790d94a73fd99a39c6))


### Enhancements

* **apps/frontend-pwa:** add initial display of points awarded ([d10e521](https://github.com/uzh-bf/klicker-uzh/commit/d10e521bf05f35c925748c30fb46d5fef208c6a7))
* **packages/prisma:** add lastAwardedAt timestamp for question responses ([3fe6f33](https://github.com/uzh-bf/klicker-uzh/commit/3fe6f33b11e856a148c9980f9c2977e3de06c575))
* **packages/prisma:** improve data model for points logic ([4cb5a18](https://github.com/uzh-bf/klicker-uzh/commit/4cb5a18c8c3a96e6c5d791b017f3e54a27390754))

## [2.0.0-alpha.40](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.39...v2.0.0-alpha.40) (2022-09-18)


### Bug Fixes

* add sameSite none to cookies ([204f02c](https://github.com/uzh-bf/klicker-uzh/commit/204f02cfcf90f65607638ec5282012eca9293c2e))
* **apps/frontend-pwa:** ensure window is used from optional global ([a037f68](https://github.com/uzh-bf/klicker-uzh/commit/a037f68135cd1a5b763b50d3da7101c6dc72fb05))

## [2.0.0-alpha.39](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.38...v2.0.0-alpha.39) (2022-09-18)


### Enhancements

* **apps/frontend-pwa:** profile update and dynamic redirect if avatar is unset, hide buttons when in frames ([70e9de5](https://github.com/uzh-bf/klicker-uzh/commit/70e9de5c7e1d9a585cee8177368eadc234639152))
* **packages/graphql:** basic password update via profile ([32637c1](https://github.com/uzh-bf/klicker-uzh/commit/32637c1ffec62ae3e02555fd9e002d0b5a1170fb))

## [2.0.0-alpha.38](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.37...v2.0.0-alpha.38) (2022-09-18)


### Bug Fixes

* **apps/frontend-*:** use status code for server side redirects ([d1732d3](https://github.com/uzh-bf/klicker-uzh/commit/d1732d3cbff71edaacd5de9674869360e1dbfb91))

## [2.0.0-alpha.37](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.36...v2.0.0-alpha.37) (2022-09-18)


### Other

* cleanup docker files, add docker compose for frontends ([5e7d624](https://github.com/uzh-bf/klicker-uzh/commit/5e7d624b707fd991b28b2691d6cfb9ed05d34f9c))
* lockfile maintenance ([49ea727](https://github.com/uzh-bf/klicker-uzh/commit/49ea727b5bc4deb6d36a5c9cebca57b69607372b))


### Enhancements

* **apps/frontend-manage:** disable compression on nextjs side, add modularize imports for ramda ([2746172](https://github.com/uzh-bf/klicker-uzh/commit/2746172827375cfa18131f24c58193dbd42a1c36))
* **apps/frontend-pwa:** improve LTI flow with welcome page redirect, APP_SECRET from process.env ([4508000](https://github.com/uzh-bf/klicker-uzh/commit/4508000e25bebb5c415a4d1b695538463fbe12fa))
* **packages/prisma:** add cascade delete on push subscription ([7daf62e](https://github.com/uzh-bf/klicker-uzh/commit/7daf62ea9e3b0f94b86442462b1732b7466ef6ac))
* rework docker-based deployment approach with build arguments and SSR api urls ([a76f0ca](https://github.com/uzh-bf/klicker-uzh/commit/a76f0ca4d7f3efef2421c0cb27750f66fbc81553))

## [2.0.0-alpha.36](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.35...v2.0.0-alpha.36) (2022-09-18)


### Bug Fixes

* **packages/graphql:** fix type issues and add logging in LTI participant ([d224352](https://github.com/uzh-bf/klicker-uzh/commit/d2243526a572e28e82a4c146e812a8547494cb9d))


### Deployment

* add basic rollout script for QA environment ([746e4f9](https://github.com/uzh-bf/klicker-uzh/commit/746e4f9209fc266759c52ab52ec29db74eab47ff))


### Other

* add prettierrc in all directories, remove design system dependency ([f9154bd](https://github.com/uzh-bf/klicker-uzh/commit/f9154bde3e53fc69d7a78c4266fe1b1b7d9a940d))
* lockfile maintenance ([5258d6c](https://github.com/uzh-bf/klicker-uzh/commit/5258d6c60d0efeb8c100cbe5dbe722c505a8a13e))
* modify prettierrc in markdown package for cjs, reformat everything ([31648ce](https://github.com/uzh-bf/klicker-uzh/commit/31648ce7cb9d9434b6a7b751e97aa7cce29b2241))
* move seeding to the prisma package ([ad02533](https://github.com/uzh-bf/klicker-uzh/commit/ad02533b27d259d738ae6fbd27cd129a4f2aaaac))
* **packages/prisma:** update seed for learning elements (module 2) ([8059a35](https://github.com/uzh-bf/klicker-uzh/commit/8059a359818ac62a88241f3106d94b80da7ffd83))

## [2.0.0-alpha.35](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.34...v2.0.0-alpha.35) (2022-09-18)


### Bug Fixes

* **apps/frontend-pwa:** add clothing avatar options ([0d6e2ae](https://github.com/uzh-bf/klicker-uzh/commit/0d6e2ae685c7532b2b4200dc266e7ba8381124c4))
* **packages/graphql:** add option for avatar clothing ([eff19ab](https://github.com/uzh-bf/klicker-uzh/commit/eff19ab32d63d05c9395d5b29a7b6df0747d65bd))


### Other

* add linkTo for BF1 seeded sessions ([8192182](https://github.com/uzh-bf/klicker-uzh/commit/8192182129086781780a17bd01e4f285af963081))
* **apps/backend-docker:** add local dev mode ([28944f6](https://github.com/uzh-bf/klicker-uzh/commit/28944f64c29d7b2c177b7bd4ebb0d0f616554926))


### Enhancements

* **apps/frontend-pwa:** improve index page display, add error handlin in participant token fetcher ([e0dc902](https://github.com/uzh-bf/klicker-uzh/commit/e0dc902b5021987d81982e8dacbcf265fddddc27))
* **packages/graphql:** add linkTo and micro session start and end date to graphql schema ([258675b](https://github.com/uzh-bf/klicker-uzh/commit/258675b14cfac959f18c47f0561d96cd59dd911b))
* **packages/prisma:** add linkTo to datamodel of sessions ([b0dd219](https://github.com/uzh-bf/klicker-uzh/commit/b0dd219f2cf90eaf07ce89637c27a67a894d3400))

## [2.0.0-alpha.34](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.33...v2.0.0-alpha.34) (2022-09-18)


### Bug Fixes

* **apps/frontend-pwa:** ensure request from lti is passed correctly ([5132fcc](https://github.com/uzh-bf/klicker-uzh/commit/5132fcc9328eaa79b623b9563a96fc0a57c59139))


### Other

* move backend-sls workflows to drafts ([1820037](https://github.com/uzh-bf/klicker-uzh/commit/18200374ebfa09fa330ca05b56174c323f023919))
* reformat ([4fccddb](https://github.com/uzh-bf/klicker-uzh/commit/4fccddb53360dc7897a534d5fdf41cc51d12fa64))

## [2.0.0-alpha.33](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.32...v2.0.0-alpha.33) (2022-09-18)


### Bug Fixes

* **packages/graphql:** make everything in ParticipantLearningData optional ([cf2c47e](https://github.com/uzh-bf/klicker-uzh/commit/cf2c47e6b6e40d2b470f0e81f70b7266b17fbe8e))


### Other

* lockfile maintenance ([acb4039](https://github.com/uzh-bf/klicker-uzh/commit/acb40393ae4bb8f13e6cca99bbd925120e419a56))


### Deployment

* add extended config for production deployment with backend-docker ([0f243f9](https://github.com/uzh-bf/klicker-uzh/commit/0f243f9642ba6dbd92fd865ab62ed30800bd8926))

## [2.0.0-alpha.32](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.31...v2.0.0-alpha.32) (2022-09-18)


### Bug Fixes

* **apps/backend-docker:** ensure api is under /api/graphql ([e312b07](https://github.com/uzh-bf/klicker-uzh/commit/e312b078ae85ac062b88aa78491180749e3c3026))
* **apps/backend-responses:** add get to methods that should be handled ([66bde66](https://github.com/uzh-bf/klicker-uzh/commit/66bde66df7b94f7cbd9d69250d9c5e976b1ebaeb))
* **apps/backend-sls:** add get to methods that should be handled ([019eb2c](https://github.com/uzh-bf/klicker-uzh/commit/019eb2cf59c9efcb7bf07c4ee3cbda2bb14d1af6))


### Deployment

* **apps/backend-docker:** extend chart for v2 deployment with doppler-based config ([48cc293](https://github.com/uzh-bf/klicker-uzh/commit/48cc2935b6b2933d5a036b74d354733908c7aed8))


### Other

* add docker backend to docker-compose definition for local testing ([4e46b20](https://github.com/uzh-bf/klicker-uzh/commit/4e46b20b81776bc17a14060534f1586553d72627))
* **apps/backend-*:** move singleton initializers out of handler function ([6467b67](https://github.com/uzh-bf/klicker-uzh/commit/6467b6799942a9d3aa23ac96f5da04358c3eb8bd))
* **apps/backend-docker:** add initial alternative backend with docker-based express ([811e5dc](https://github.com/uzh-bf/klicker-uzh/commit/811e5dce2243afac7deee8fef16274aef28b7b9b))
* **apps/backend-responses:** evaluate getRedis approach ([23b2dde](https://github.com/uzh-bf/klicker-uzh/commit/23b2dde58f9e97d32717c120488c15bb43d9770e))
* **apps/backend-sls:** add console logging in host.json ([ea63b19](https://github.com/uzh-bf/klicker-uzh/commit/ea63b198d7cf61324f7e0b4cc519d8dd42f6a2c1))
* **apps/backend-sls:** evaluate disabling all envelop plugins ([1378047](https://github.com/uzh-bf/klicker-uzh/commit/13780477d89786aa41b8953cdda88b2485c4525c))
* **apps/backend-sls:** investigate singleton-based approach for cached app ([c928123](https://github.com/uzh-bf/klicker-uzh/commit/c9281233c88973f05287cddc333300812948d289))
* **apps/backend-sls:** use only parser and validation cache and no redis response cache ([2ef84bf](https://github.com/uzh-bf/klicker-uzh/commit/2ef84bff2355565853675bda29955a8a78dbe56e))
* **packages/prisma:** switch to musl prisma client ([c41573a](https://github.com/uzh-bf/klicker-uzh/commit/c41573a852e35faf15db113569721a918678eb4f))

## [2.0.0-alpha.31](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.30...v2.0.0-alpha.31) (2022-09-17)


### Bug Fixes

* **apps/frontend-pwa:** always use chest as body type ([12b332e](https://github.com/uzh-bf/klicker-uzh/commit/12b332e1bdd3a85dbcf88aaef68190fe315d34e4))


### Deployment

* update tag for production deploy ([d7ba94d](https://github.com/uzh-bf/klicker-uzh/commit/d7ba94d01254eecec884a091e5e01b782ff01c6e))


### Other

* **apps/backend-sls:** improve tests with extended matchers ([222d6a7](https://github.com/uzh-bf/klicker-uzh/commit/222d6a777004c0f45e95ade5b02ef5aaaa1512be))
* **apps/frontend-pwa:** replace body with clothing in avatar generation script ([71b723b](https://github.com/uzh-bf/klicker-uzh/commit/71b723b872ccbb6ef1c5573de03c321ca858db24))
* lockfile maintenance ([ea0fe15](https://github.com/uzh-bf/klicker-uzh/commit/ea0fe150452be6e9be12639c542b390ba70e25df))


### Enhancements

* add JWT-based verification on LTI registration endpoint ([d1f9800](https://github.com/uzh-bf/klicker-uzh/commit/d1f98000b23c7a0e1a72927bc90f48d567f99927))
* **apps/backend-responses:** return 200 on GET to the add response endpoint ([40cbf04](https://github.com/uzh-bf/klicker-uzh/commit/40cbf047cce8d6c8f7b97f5b2d46cb74c4dcf241))
* **apps/backend-sls:** return 200 on GET to the add response endpoint ([d159ef9](https://github.com/uzh-bf/klicker-uzh/commit/d159ef9ef992140c962170b3db193e13bce87fa4))
* **apps/frontend-pwa:** improve page data fetching logic and use participant token in embeddable pages ([390b4e3](https://github.com/uzh-bf/klicker-uzh/commit/390b4e3eda9d830e07bbf76796340c798ca43c55))
* **packages/graphql:** improve logic for participant registration from LTI ([4da5ce0](https://github.com/uzh-bf/klicker-uzh/commit/4da5ce0428e993342882a196b3ddd0a6520239d9))

## [2.0.0-alpha.30](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.29...v2.0.0-alpha.30) (2022-09-17)


### Deployment

* add initial HPA for new prod deployment ([e04a2eb](https://github.com/uzh-bf/klicker-uzh/commit/e04a2ebba0e1a7edfbd6bc2fd83c107a162dd0ef))
* use double domains for production v2 deploy ([eda8b84](https://github.com/uzh-bf/klicker-uzh/commit/eda8b8471b76a9905099c95975f73195b7d8548d))


### Enhancements

* add dynamic redirect after login in PWA ([3cbce1c](https://github.com/uzh-bf/klicker-uzh/commit/3cbce1cbcaaf0284811e53255d5df39bbe4b1114))

## [2.0.0-alpha.29](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.28...v2.0.0-alpha.29) (2022-09-17)


### Deployment

* create separate actions workflow for production and qa images ([1cef351](https://github.com/uzh-bf/klicker-uzh/commit/1cef3514879d833530421c5e676556117b0fadfc))
* ensure that .env.qa in frontend-manage build action is renamed correctly ([4127e06](https://github.com/uzh-bf/klicker-uzh/commit/4127e06b128ead844210e09a5135ace8705955db))
* improve restrictions on when actions are run ([1c94b3a](https://github.com/uzh-bf/klicker-uzh/commit/1c94b3ac26a69e39e70337141872d067abcd8b59))

## [2.0.0-alpha.28](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.27...v2.0.0-alpha.28) (2022-09-17)


### Other

* **packages/graphql:** improve queries to ensure ids are included ([30d9819](https://github.com/uzh-bf/klicker-uzh/commit/30d981941264d7cbacb2579829847a249a49be54))


### Enhancements

* **apps/frontend-*:** ensure all headers contain name, course name, color; update favicons ([ae6e68d](https://github.com/uzh-bf/klicker-uzh/commit/ae6e68d8caffb6de8927a6fa3b9379b40cd1579f))
* **apps/frontend-pwa:** improve PWA layout and ensure course color is displayed ([137a288](https://github.com/uzh-bf/klicker-uzh/commit/137a2882ac5893847310641cd629d0b0623b44c4))

## [2.0.0-alpha.27](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.26...v2.0.0-alpha.27) (2022-09-17)


### Bug Fixes

* **apps/frontend-pwa:** add vapid public key to env ([4ee31c0](https://github.com/uzh-bf/klicker-uzh/commit/4ee31c08420cdbb1c77e272b776543e178370473))
* **apps/frontend-pwa:** inject thesans font declarations and preload the fonts ([40bcd80](https://github.com/uzh-bf/klicker-uzh/commit/40bcd803be615cda5b0e85c3fa7d77dfdc1e08e8))


### Other

* **apps/backend-sls:** ensure seeded microlearning is active for testing ([12cc7f0](https://github.com/uzh-bf/klicker-uzh/commit/12cc7f03dbb41ed4003095e7b265ebcc79f01e3c))
* **apps/frontend-pwa:** hardcoded chest for avatar ([7be0a84](https://github.com/uzh-bf/klicker-uzh/commit/7be0a8435481194b22f654a6ebd1af3221db4bd8))
* lockfile maintenance ([ccde59c](https://github.com/uzh-bf/klicker-uzh/commit/ccde59cda4dedcdfb2670bf2e325147e10315e64))
* upgrade design system and reformat ([6a8ab48](https://github.com/uzh-bf/klicker-uzh/commit/6a8ab48ea9bdaf1757bf538a4174d150babcdaf7))


### Deployment

* **env-prod-v2:** create initial deployment config for production env ([b649c1c](https://github.com/uzh-bf/klicker-uzh/commit/b649c1c1c055954277fb1d4d46b91374b7a9f2ab))


### Dependencies

* upgrade to latest design system package ([dd6aec1](https://github.com/uzh-bf/klicker-uzh/commit/dd6aec1f59b13e15ffcd94eb946a33303d0c7ded))


### Enhancements

* **apps/frontend-pwa:** miscellaneous layouting improvements ([b22de24](https://github.com/uzh-bf/klicker-uzh/commit/b22de24e8999e9c47434eeb96c3c290e0a7eb7fb))
* improve logic for subscribe to push, make avatar optional ([7526810](https://github.com/uzh-bf/klicker-uzh/commit/7526810821aeb2c788c04f00abbd2c3e718c4fd4))
* **packages/prisma:** make the avatar optional and unset per default ([658e9b6](https://github.com/uzh-bf/klicker-uzh/commit/658e9b6c9735fc8b31ca80e55871bd9e905a5bb6))

## [2.0.0-alpha.26](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.25...v2.0.0-alpha.26) (2022-09-16)


### Features

* add cockpit lecturer view for running session including db interactions ([#2879](https://github.com/uzh-bf/klicker-uzh/issues/2879)) ([3adb461](https://github.com/uzh-bf/klicker-uzh/commit/3adb4616696640c4ec1fae69b100f9480f95865c))
* **apps/frontend-pwa:** create very basic leaderboard ([c142803](https://github.com/uzh-bf/klicker-uzh/commit/c142803334184163a1fbb87858dc751e4c76fd28))


### Bug Fixes

* **apps/frontend-pwa:** use server side props on join page to allow embed in OLAT ([8c54f31](https://github.com/uzh-bf/klicker-uzh/commit/8c54f31b52a8aaf5cbaeb78883766f996f8f6ae9))


### Other

* lockfile maintenance ([3e3da0b](https://github.com/uzh-bf/klicker-uzh/commit/3e3da0b77d90e7f2c9c798fd10b3ff261a0211e9))

## [2.0.0-alpha.25](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.24...v2.0.0-alpha.25) (2022-09-16)


### Bug Fixes

* **apps/frontend-manage:** ensure build outputs standalone and does not fail for eslint issues ([56b8746](https://github.com/uzh-bf/klicker-uzh/commit/56b87461ac344d498405ad21608ff6b1a7b543a0))
* **apps/frontend-pwa:** ensure avatar paths are dynamic, use svg for avatars for now ([e5258b1](https://github.com/uzh-bf/klicker-uzh/commit/e5258b1e3c83f55ab4b1cbbc2c2a27e36ae75012))
* **apps/frontend-pwa:** ensure default production endpoints are matching schema: ([68d9921](https://github.com/uzh-bf/klicker-uzh/commit/68d9921c713dbf7f5c611042621d6539ddaf3992))
* **apps/frontend-pwa:** ensure installation prompt for PWA shows up ([#2892](https://github.com/uzh-bf/klicker-uzh/issues/2892)) ([8668d53](https://github.com/uzh-bf/klicker-uzh/commit/8668d53b11cb2ea512e48fd2fead2019c2680b01))
* **apps/frontend-pwa:** improve cookie redirection login on learning element ([ee166d4](https://github.com/uzh-bf/klicker-uzh/commit/ee166d450c364e4bfd02dc9f1f622708ea0abec8))
* **apps/frontend-pwa:** migrate learning element to server side props ([e0c5975](https://github.com/uzh-bf/klicker-uzh/commit/e0c597517a63cd9002a320fc6ba3e6056502049a))
* **apps/frontend-pwa:** remove trailing slash from avatar base path ([5755389](https://github.com/uzh-bf/klicker-uzh/commit/5755389350549e608429be3ed74cc23fe6c04013))
* **apps/frontend-pwa:** use .next() to return from middleware ([02d8472](https://github.com/uzh-bf/klicker-uzh/commit/02d8472b2ea1c3adb2b154c40258bc3ed51001fc))
* **apps/frontend-pwa:** use server side props for learning element ([ba249cd](https://github.com/uzh-bf/klicker-uzh/commit/ba249cd4ac1bf1a2ebcbaf8557f405e6081266d3))


### Other

* **apps/frontend-manage:** install missing packages and add some for consistency ([28f6bfd](https://github.com/uzh-bf/klicker-uzh/commit/28f6bfdbc717c791a15b7ed581d57ebb11d9be5b))
* **apps/frontend-pwa:** evaluate middleware instead of server side props ([a844ffb](https://github.com/uzh-bf/klicker-uzh/commit/a844ffb4165409689b10f12fbe943f299307386c))
* lockfile maintenance ([d121f31](https://github.com/uzh-bf/klicker-uzh/commit/d121f315374563ee36c9b58bc1cc19efcb65ebc5))


### Enhancements

* **apps/frontend-pwa:** add notifications to prompt user to install PWA ([#2891](https://github.com/uzh-bf/klicker-uzh/issues/2891)) ([6a5a985](https://github.com/uzh-bf/klicker-uzh/commit/6a5a98512f08f660e8bb3193e56c634d49d16c65))
* **apps/frontend-pwa:** ensure middleware is skipped if a participant token is available ([c1bbc0c](https://github.com/uzh-bf/klicker-uzh/commit/c1bbc0c2e180a74426211649f00c83e0a896d687))


### Deployment

* add a new chart for klicker-uzh-v2 deployment ([46283b2](https://github.com/uzh-bf/klicker-uzh/commit/46283b29fd764a2ff594789f78895676e1c2e1f4))
* add basic action for frontend-pwa docker build ([31114f2](https://github.com/uzh-bf/klicker-uzh/commit/31114f2d362c054b7e805e86704e38988283688c))
* add basic docker build action for manage frontend ([4006c29](https://github.com/uzh-bf/klicker-uzh/commit/4006c29c8f8cff9b21be6bf6db64790347a79bdc))
* add frontend manage to chart v2 ([2a40aac](https://github.com/uzh-bf/klicker-uzh/commit/2a40aace62b4a650e4dbf11138719ce1608a84be))
* adjust generated actions workflows for production and QA azure functions ([f4b2865](https://github.com/uzh-bf/klicker-uzh/commit/f4b28651ada530eb0fed96a79f4e65b4e22dd744))
* **apps/frontend-pwa:** initial docker setup for production deploy ([cb702f8](https://github.com/uzh-bf/klicker-uzh/commit/cb702f8903433fe0eef28941f7336316aacda985))
* ensure workflows are only triggered on v2 and tags ([7a36ce6](https://github.com/uzh-bf/klicker-uzh/commit/7a36ce6d6fb7471e34cd99bb1212dd2ac84d1f44))
* fix dockerfile path for PWA image ([cbdcf30](https://github.com/uzh-bf/klicker-uzh/commit/cbdcf300ef3fbccd4557f348849eb083c8f82e6f))
* remove old workflows for azure function deployment (rs) ([225644b](https://github.com/uzh-bf/klicker-uzh/commit/225644b030a6ee95ceedb496e1bec214415c4320))
* update resource definitions and use rolling update ([5ac1507](https://github.com/uzh-bf/klicker-uzh/commit/5ac1507be994b8480f5bc5d90f05a13cfbd49268))

## [2.0.0-alpha.24](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.23...v2.0.0-alpha.24) (2022-09-16)


### Features

* add backend persistence for push subscriptions ([7a42ad3](https://github.com/uzh-bf/klicker-uzh/commit/7a42ad391b9747bf0e76f54489428feb8df6e4bf))
* **apps/frontend-manage:** add qr page that displays qr to join page with new logo ([9d87ccf](https://github.com/uzh-bf/klicker-uzh/commit/9d87ccff17d83b9b0a67a0f3b88c207997983c29))
* **apps/frontend-pwa:** add logic to login page and connect index to backend ([#2878](https://github.com/uzh-bf/klicker-uzh/issues/2878)) ([9b5bc78](https://github.com/uzh-bf/klicker-uzh/commit/9b5bc78ff2069504ae66acae9648e4bed503d831))
* profile setup (username, avatar) and PWA layout improvements ([#2809](https://github.com/uzh-bf/klicker-uzh/issues/2809)) ([3ffc30d](https://github.com/uzh-bf/klicker-uzh/commit/3ffc30d0eb960fcbcd045a99c3eeb998ebfa993b))


### Bug Fixes

* **apps/backend-responses:** ensure that grading package is installed ([29b0630](https://github.com/uzh-bf/klicker-uzh/commit/29b0630cfc35cf7c62519adba3777b66e7b8ed38))
* more efficient implementations and fixes for session list and logout functionalities ([#2877](https://github.com/uzh-bf/klicker-uzh/issues/2877)) ([1afc57b](https://github.com/uzh-bf/klicker-uzh/commit/1afc57bc476215f001ce4cb245c0e12bbed9282f))
* **packages/graphql:** remove ids from logout mutations ([bb7d35e](https://github.com/uzh-bf/klicker-uzh/commit/bb7d35e0f1334760824d3716c3d04730c34fb4b5))


### Dependencies

* upgrade everything to latest version ([#2880](https://github.com/uzh-bf/klicker-uzh/issues/2880)) ([ba28b47](https://github.com/uzh-bf/klicker-uzh/commit/ba28b47902ca8d5766705c21d79978ac2df7cb3d))


### Enhancements

* rework seed, improve layout of PWA, error boundary and error pages ([#2887](https://github.com/uzh-bf/klicker-uzh/issues/2887)) ([f58b8f6](https://github.com/uzh-bf/klicker-uzh/commit/f58b8f6ee416211c8d8fdbcbd8897d31aae71033))


### Other

* add script for avatar generation ([d3b0cec](https://github.com/uzh-bf/klicker-uzh/commit/d3b0cecc832490cbb7a41c35b4ba8cab5ffa5f22))
* adjust test timeout ([ccb7d9c](https://github.com/uzh-bf/klicker-uzh/commit/ccb7d9ccb42fc69a37cb08efda0ae183687c9831))
* disable typescript build checks for nextjs apps ([d6e8043](https://github.com/uzh-bf/klicker-uzh/commit/d6e80437c5c904b330799a0cb40e6e8203624431))
* lockfile maintenance ([1d6a0a6](https://github.com/uzh-bf/klicker-uzh/commit/1d6a0a6671abf9343c0731946aeb12db4de0145c))
* lockfile maintenance ([6e78239](https://github.com/uzh-bf/klicker-uzh/commit/6e7823910ad270d771c549f43200fcb1ae1552b8))
* lockfile maintenance ([4610a5c](https://github.com/uzh-bf/klicker-uzh/commit/4610a5c2b2d827c25e60a4b01dbc0bc903ec7f71))
* redeploy ([4dcaa65](https://github.com/uzh-bf/klicker-uzh/commit/4dcaa659ad42752d3f6ca3c71a8ce44775d9eca7))
* remove cruft ([23bce5c](https://github.com/uzh-bf/klicker-uzh/commit/23bce5c5a44a481495e013d7d19cd7af72a8731f))

## [2.0.0-alpha.23](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.21...v2.0.0-alpha.23) (2022-09-14)


### Features

* add confusion feedback functionality to live sessions ([#2865](https://github.com/uzh-bf/klicker-uzh/issues/2865)) ([a5baac8](https://github.com/uzh-bf/klicker-uzh/commit/a5baac84e95d9687a7c34aa3c05c295949b98df7))
* add feedback structure and corresponding queries and mutations for live sessions ([#2852](https://github.com/uzh-bf/klicker-uzh/issues/2852)) ([3de9fd0](https://github.com/uzh-bf/klicker-uzh/commit/3de9fd0463125db087655e15483b703bc025b020))
* **apps/frontend-pwa:** add a join page with next ISR ([#2871](https://github.com/uzh-bf/klicker-uzh/issues/2871)) ([586f123](https://github.com/uzh-bf/klicker-uzh/commit/586f123e356f0203e1b078b98f6f4c542cb57d7b))
* basic index page in PWA ([#2843](https://github.com/uzh-bf/klicker-uzh/issues/2843)) ([02783ff](https://github.com/uzh-bf/klicker-uzh/commit/02783ff6ecdfd05c7697d142ea3e835486eefdd1))
* block deactivation with redis persistence, leaderboard computation ([#2851](https://github.com/uzh-bf/klicker-uzh/issues/2851)) ([2df3c1a](https://github.com/uzh-bf/klicker-uzh/commit/2df3c1a6b5e16a502e5367d21f1c11b5a1a62815))
* implement session list with corresponding query and logout functionality ([#2875](https://github.com/uzh-bf/klicker-uzh/issues/2875)) ([3f10950](https://github.com/uzh-bf/klicker-uzh/commit/3f10950c6d7f12ea8031bada2dbf67601706fe8f))
* implement user login functionality for manage frontend ([#2873](https://github.com/uzh-bf/klicker-uzh/issues/2873)) ([24e5a01](https://github.com/uzh-bf/klicker-uzh/commit/24e5a0101a7cd74727bd3409c91c06825d397eab))
* initial microlearning session playthrough ([#2872](https://github.com/uzh-bf/klicker-uzh/issues/2872)) ([359598e](https://github.com/uzh-bf/klicker-uzh/commit/359598e597a79f78bb49277d1a0590caf6246109))
* initial session creation and start ([#2819](https://github.com/uzh-bf/klicker-uzh/issues/2819)) ([deed5c8](https://github.com/uzh-bf/klicker-uzh/commit/deed5c87a1f6854f462fcb5a6768c128330aadea))
* processing responses ([#2840](https://github.com/uzh-bf/klicker-uzh/issues/2840)) ([3e7c62d](https://github.com/uzh-bf/klicker-uzh/commit/3e7c62d8c0012afd7c81127f40eba3f63ce77c4b))
* rebuild join page ([#2800](https://github.com/uzh-bf/klicker-uzh/issues/2800)) ([3fa059c](https://github.com/uzh-bf/klicker-uzh/commit/3fa059c934bcd389fc3863e6f217e678e926eb94))


### Bug Fixes

* **apps/backend-*:** fix builds for azure functions ([7556261](https://github.com/uzh-bf/klicker-uzh/commit/7556261ae85bd003b74054d0dbc356089672921c))
* **apps/frontend-learning:** fix type issues ([a35e02a](https://github.com/uzh-bf/klicker-uzh/commit/a35e02a259557064c90033648ff2fdd08cb95073))
* **apps/frontend-manage:** fix missing base url in tsconfig ([2922505](https://github.com/uzh-bf/klicker-uzh/commit/2922505019fec8966f1313602b676751cbd296e7))
* **apps/frontend-pwa:** fix type issues ([d5e18de](https://github.com/uzh-bf/klicker-uzh/commit/d5e18de7c730bd65e1ded70d8f468062249e9eaf))
* **packages/graphql:** pass the color param to create course ([e764a5c](https://github.com/uzh-bf/klicker-uzh/commit/e764a5c8b527bbac8dce63cc6d2066ab190aac52))
* remove duplicate tests ([2a9b6cb](https://github.com/uzh-bf/klicker-uzh/commit/2a9b6cb53934babfdabd641e106fa3ca0d9b23e7))


### Refactors

* merge frontend-learning into frontend-pwa ([#2863](https://github.com/uzh-bf/klicker-uzh/issues/2863)) ([8904d3d](https://github.com/uzh-bf/klicker-uzh/commit/8904d3d6294b7e60df93f75e6d091af2bc931f55))


### Enhancements

* add responses, mobile layout changes ([#2842](https://github.com/uzh-bf/klicker-uzh/issues/2842)) ([1fba672](https://github.com/uzh-bf/klicker-uzh/commit/1fba672925720d125ed44e71af52aac0739937d9))
* add simple self query for profile page ([b4ba1bc](https://github.com/uzh-bf/klicker-uzh/commit/b4ba1bc788b9d5be44a34872d74bad837a628111))
* **apps/frontend-pwa:** add api endpoint for avatar generation ([05f99ba](https://github.com/uzh-bf/klicker-uzh/commit/05f99ba1ec4aa9e70e9f03e0c4b5d3b68ee61150))
* **apps/frontend-pwa:** further improvements for feedbacks ([6b5ec65](https://github.com/uzh-bf/klicker-uzh/commit/6b5ec6530163b8e2b0dafc80153c6d8e7bad820c))
* **apps/frontend-pwa:** improve layout of learning element ([92b319d](https://github.com/uzh-bf/klicker-uzh/commit/92b319d0738c87e363c3626e4eb14e2be4a7cbb3))
* **backend-sls:** implement feedback creation in test suite ([#2864](https://github.com/uzh-bf/klicker-uzh/issues/2864)) ([94b74a6](https://github.com/uzh-bf/klicker-uzh/commit/94b74a61ce7a14e8e73b39ba87b89992a3fbb8b2))
* create course and extend integration test ([#2850](https://github.com/uzh-bf/klicker-uzh/issues/2850)) ([9b64e2c](https://github.com/uzh-bf/klicker-uzh/commit/9b64e2c1d967f600cfd5b8077e0c6e19ff7e295c))
* display leaderboard entries and small PWA improvements ([#2862](https://github.com/uzh-bf/klicker-uzh/issues/2862)) ([f111dc4](https://github.com/uzh-bf/klicker-uzh/commit/f111dc463d6e625c3aa3e514ee61ea3e9e34bcba))
* features and improvements for the live session page ([#2867](https://github.com/uzh-bf/klicker-uzh/issues/2867)) ([b4a0bcd](https://github.com/uzh-bf/klicker-uzh/commit/b4a0bcd60942bff08ea30e95e3e3cd6bc991547d))
* **frontend-pwa:** add react-loader-spinner ([1c2ec17](https://github.com/uzh-bf/klicker-uzh/commit/1c2ec17e0a45ecc20add40523ec32f554608d4b6))
* improve learning element ([474ef06](https://github.com/uzh-bf/klicker-uzh/commit/474ef066dc891f439a6b8b037e23489ecacd7579))
* initial add response procedure ([fe11d25](https://github.com/uzh-bf/klicker-uzh/commit/fe11d25b5efe1ccdc89ca7deb83151f97552c62d))
* initial improvements on learning element design ([#2868](https://github.com/uzh-bf/klicker-uzh/issues/2868)) ([bd4df0b](https://github.com/uzh-bf/klicker-uzh/commit/bd4df0b133a2f28a0c150f3bd806520a389f00dc))
* mobile layout framework and logic for local response storage ([#2841](https://github.com/uzh-bf/klicker-uzh/issues/2841)) ([56e80f5](https://github.com/uzh-bf/klicker-uzh/commit/56e80f51fee9b9eff2583ea6ffc0867efc643c16))


### Other

* add API_DOMAIN and COOKIE_DOMAIN to templates ([456a16b](https://github.com/uzh-bf/klicker-uzh/commit/456a16b803abe449efa9bbe9762602c484dca791))
* adjust naming of workflow for backend-responses ([5d6dfb5](https://github.com/uzh-bf/klicker-uzh/commit/5d6dfb59e731532eb919ad9afd03b7208bb6ec78))
* **apps/frontend-pwa:** update webp with lossless ([2c16354](https://github.com/uzh-bf/klicker-uzh/commit/2c163543b014b9f8794df3b23c43cdf1500ebeb4))
* **backend-*:** fix text suite and config for the cache to work as expected ([a39874e](https://github.com/uzh-bf/klicker-uzh/commit/a39874e37578a980b1a754726a7509c2a8ad8ec1))
* **frontend-pwa:** replace next image by next future image for question attachment rendering ([6206659](https://github.com/uzh-bf/klicker-uzh/commit/62066595b3f2eb99d82d72aef7cd6c5a1e0a2591))
* local development with docker-based redis and postgres ([237ba16](https://github.com/uzh-bf/klicker-uzh/commit/237ba16bb6afee0062048c594998c69c6544b6c6))
* lockfile maintenance ([b935137](https://github.com/uzh-bf/klicker-uzh/commit/b93513777a7b4677f57e0cdb4849e5a4bdc5d16b))
* lockfile maintenance ([70115fb](https://github.com/uzh-bf/klicker-uzh/commit/70115fb9f260fb18edbb21c88a7209eeeaea964a))
* one more upgrade of design system ([24e95d0](https://github.com/uzh-bf/klicker-uzh/commit/24e95d0fb7c150b695465f1a290b7116e568923e))
* **release:** 2.0.0-alpha.22 ([8aa6043](https://github.com/uzh-bf/klicker-uzh/commit/8aa6043be8f64898679e8efcb80a58a983ddd75a))
* update [@klicker-uzh](https://github.com/klicker-uzh) packages as peer deps ([30ebb3c](https://github.com/uzh-bf/klicker-uzh/commit/30ebb3c5003593faeada7cffe8957c410152d586))
* update design system and run prettier across packages ([71ed011](https://github.com/uzh-bf/klicker-uzh/commit/71ed0113458320e64962f27484a32775efbde71f))
* update versioning ([c0f8a50](https://github.com/uzh-bf/klicker-uzh/commit/c0f8a506f42ed76bcf39819b574b8d693d8e3f0f))
* version bump ([fb69b1e](https://github.com/uzh-bf/klicker-uzh/commit/fb69b1e399f263aeef627ce8c2f5193e90da4fb1))

## [2.0.0-alpha.22](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.21...v2.0.0-alpha.22) (2022-09-08)


### Features

* basic index page in PWA ([#2843](https://github.com/uzh-bf/klicker-uzh/issues/2843)) ([02783ff](https://github.com/uzh-bf/klicker-uzh/commit/02783ff6ecdfd05c7697d142ea3e835486eefdd1))
* initial session creation and start ([#2819](https://github.com/uzh-bf/klicker-uzh/issues/2819)) ([deed5c8](https://github.com/uzh-bf/klicker-uzh/commit/deed5c87a1f6854f462fcb5a6768c128330aadea))
* processing responses ([#2840](https://github.com/uzh-bf/klicker-uzh/issues/2840)) ([3e7c62d](https://github.com/uzh-bf/klicker-uzh/commit/3e7c62d8c0012afd7c81127f40eba3f63ce77c4b))
* rebuild join page ([#2800](https://github.com/uzh-bf/klicker-uzh/issues/2800)) ([3fa059c](https://github.com/uzh-bf/klicker-uzh/commit/3fa059c934bcd389fc3863e6f217e678e926eb94))


### Enhancements

* add simple self query for profile page ([b4ba1bc](https://github.com/uzh-bf/klicker-uzh/commit/b4ba1bc788b9d5be44a34872d74bad837a628111))
* **frontend-pwa:** add react-loader-spinner ([1c2ec17](https://github.com/uzh-bf/klicker-uzh/commit/1c2ec17e0a45ecc20add40523ec32f554608d4b6))
* initial add response procedure ([fe11d25](https://github.com/uzh-bf/klicker-uzh/commit/fe11d25b5efe1ccdc89ca7deb83151f97552c62d))
* mobile layout framework and logic for local response storage ([#2841](https://github.com/uzh-bf/klicker-uzh/issues/2841)) ([56e80f5](https://github.com/uzh-bf/klicker-uzh/commit/56e80f51fee9b9eff2583ea6ffc0867efc643c16))


### Other

* local development with docker-based redis and postgres ([237ba16](https://github.com/uzh-bf/klicker-uzh/commit/237ba16bb6afee0062048c594998c69c6544b6c6))
* lockfile maintenance ([70115fb](https://github.com/uzh-bf/klicker-uzh/commit/70115fb9f260fb18edbb21c88a7209eeeaea964a))
* one more upgrade of design system ([24e95d0](https://github.com/uzh-bf/klicker-uzh/commit/24e95d0fb7c150b695465f1a290b7116e568923e))
* update design system and run prettier across packages ([71ed011](https://github.com/uzh-bf/klicker-uzh/commit/71ed0113458320e64962f27484a32775efbde71f))
* update versioning ([c0f8a50](https://github.com/uzh-bf/klicker-uzh/commit/c0f8a506f42ed76bcf39819b574b8d693d8e3f0f))
* version bump ([fb69b1e](https://github.com/uzh-bf/klicker-uzh/commit/fb69b1e399f263aeef627ce8c2f5193e90da4fb1))

## [2.0.0-alpha.21](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.20...v2.0.0-alpha.21) (2022-08-29)


### Build and CI

* remove old workflows ([d632f40](https://github.com/uzh-bf/klicker-uzh/commit/d632f40cbdd20efee83fae2ab6dd0325a72d8780))


### Other

* bump version ([c8cf4a6](https://github.com/uzh-bf/klicker-uzh/commit/c8cf4a6864d13bf15cfc43e982ffb31dd60f3667))
* **packages/prisma:** use windows query engine ([fbba2bb](https://github.com/uzh-bf/klicker-uzh/commit/fbba2bb82a152c668487f9b5b92b843b258a57ca))

## [2.0.0-alpha.20](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.18...v2.0.0-alpha.20) (2022-08-29)


### Features

* session start and getSession query ([#2774](https://github.com/uzh-bf/klicker-uzh/issues/2774)) ([a4cf7ca](https://github.com/uzh-bf/klicker-uzh/commit/a4cf7ca5a549394cc1ff7ab65a0d9bbc7332e49b))


### Bug Fixes

* **frontend-learning:** fix type issue with request in participant token ([1306667](https://github.com/uzh-bf/klicker-uzh/commit/1306667de03110d564077841f05b7fa9aa73bb38))
* **frontend-x:** use nodejs >=16 to allow for vercel deploy ([7f0c700](https://github.com/uzh-bf/klicker-uzh/commit/7f0c7006b4c1c32c2ffb863acef11dce9e4513d9))


### Enhancements

* add envelop plugins for performance and monitoring, upgrade deps and nodejs ([#2801](https://github.com/uzh-bf/klicker-uzh/issues/2801)) ([0b3ab2e](https://github.com/uzh-bf/klicker-uzh/commit/0b3ab2e82a7208c196c234ba6c9660c512cde7f1))


### Build and CI

* ensure powershell commands work ([ca1abb0](https://github.com/uzh-bf/klicker-uzh/commit/ca1abb0f8a91562b9263bc5ee5fa1e41b2df334c))
* update windows deploy for function ([942f2f0](https://github.com/uzh-bf/klicker-uzh/commit/942f2f0359b759d695081b75c6508b87df24197e))


### Other

* add config for graphql inspector ([a521f82](https://github.com/uzh-bf/klicker-uzh/commit/a521f82dd6ed422feadc309c2962c03673aa6389))
* lockfile maintenance ([11528bc](https://github.com/uzh-bf/klicker-uzh/commit/11528bc9ee5d116d0024e36ca8dc306190cfb95a))
* **release:** 2.0.0-alpha.19 ([0e0ce2d](https://github.com/uzh-bf/klicker-uzh/commit/0e0ce2da35cb1d852162bbe6e35d3e20aaa82f5c))
* remove old workflows ([c789b62](https://github.com/uzh-bf/klicker-uzh/commit/c789b62d7a0c9e30ff5aedd71466a11ea3fbe01f))
* replace bcrypt with bcryptjs ([7f022b9](https://github.com/uzh-bf/klicker-uzh/commit/7f022b935497e3e938d600f7caf341ba1adb912b))
* upgrade to node 18 ([89e28e4](https://github.com/uzh-bf/klicker-uzh/commit/89e28e40ffbfc50059553066027564d365b061df))

## [2.0.0-alpha.19](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.17...v2.0.0-alpha.19) (2022-08-28)


### Features

* add participant login in PWA ([4e78442](https://github.com/uzh-bf/klicker-uzh/commit/4e78442c4b1e647d29dec73a818a84adf5868d7d))
* session start and getSession query ([#2774](https://github.com/uzh-bf/klicker-uzh/issues/2774)) ([a4cf7ca](https://github.com/uzh-bf/klicker-uzh/commit/a4cf7ca5a549394cc1ff7ab65a0d9bbc7332e49b))


### Other

* add config for graphql inspector ([a521f82](https://github.com/uzh-bf/klicker-uzh/commit/a521f82dd6ed422feadc309c2962c03673aa6389))
* **release:** 2.0.0-alpha.18 ([3bb28ba](https://github.com/uzh-bf/klicker-uzh/commit/3bb28baa949065e2cddafc936cd6140b092e01c6))
* upgrade to node 18 ([89e28e4](https://github.com/uzh-bf/klicker-uzh/commit/89e28e40ffbfc50059553066027564d365b061df))


### Enhancements

* add envelop plugins for performance and monitoring, upgrade deps and nodejs ([#2801](https://github.com/uzh-bf/klicker-uzh/issues/2801)) ([0b3ab2e](https://github.com/uzh-bf/klicker-uzh/commit/0b3ab2e82a7208c196c234ba6c9660c512cde7f1))

## [2.0.0-alpha.18](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.17...v2.0.0-alpha.18) (2022-08-25)


### Features

* add participant login in PWA ([4e78442](https://github.com/uzh-bf/klicker-uzh/commit/4e78442c4b1e647d29dec73a818a84adf5868d7d))

## [2.0.0-alpha.17](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.16...v2.0.0-alpha.17) (2022-08-23)


### Refactors

* **frontend-learning:** move evaluation and options display to separate files ([1f62539](https://github.com/uzh-bf/klicker-uzh/commit/1f6253979ca3e5aa4d76138020775b123ae5a4d4))


### Enhancements

* add MC visualization for questions ([de3b67d](https://github.com/uzh-bf/klicker-uzh/commit/de3b67d1b4067ad0c7f61b86064579ad20190347))
* **frontend-learning:** display the answer distribution and correct option ([abb0715](https://github.com/uzh-bf/klicker-uzh/commit/abb0715f8b252e181ea396d1a753da9987203fc8))

## [2.0.0-alpha.16](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.15...v2.0.0-alpha.16) (2022-08-23)


### Features

* persist learning element responses ([6b78c04](https://github.com/uzh-bf/klicker-uzh/commit/6b78c0438691fc82b5fa39a3adcf56310f4089fe))


### Bug Fixes

* **frontend-learning:** fix type errors ([d99188f](https://github.com/uzh-bf/klicker-uzh/commit/d99188ff976f6da40e81649ef5262bde2f918544))


### Build and CI

* add --force to vercel deployments ([f9e8a36](https://github.com/uzh-bf/klicker-uzh/commit/f9e8a3602cbd9fe39a65b100a697176d096cde01))


### Enhancements

* **frontend-learning:** ensure next question is displayed after change ([8d10bc8](https://github.com/uzh-bf/klicker-uzh/commit/8d10bc89bb31c929f8cb865166486c9e55dbf7f9))


### Other

* **frontend-learning:** small change to trigger workflow ([bc51ce2](https://github.com/uzh-bf/klicker-uzh/commit/bc51ce2b9e577c0e4ed68cad4cc0bda83d05fb6f))
* **frontend-learning:** update routing structure so courseId is in the URL ([d756652](https://github.com/uzh-bf/klicker-uzh/commit/d7566521b8308a3b4e2c39eea51c7cf1a3298896))
* lockfile maintenance ([3cb3b46](https://github.com/uzh-bf/klicker-uzh/commit/3cb3b4676dc95b0ce5ac4bdd2525f139db4080b7))

## [2.0.0-alpha.15](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.14...v2.0.0-alpha.15) (2022-08-23)


### Bug Fixes

* **frontend-learning:** ensure linting does not break the build ([da62875](https://github.com/uzh-bf/klicker-uzh/commit/da6287520aec19a3681aa52386e8a06f63ea74b2))
* **frontend-learning:** fix missing any ([a59bca7](https://github.com/uzh-bf/klicker-uzh/commit/a59bca7a5d189c54fe3419fc59eebcbcfed7fb32))


### Other

* **backend-sls:** add second question to the learning element in seed ([b059d44](https://github.com/uzh-bf/klicker-uzh/commit/b059d44489dd6bce98ecaaa5198b768d524d624d))
* lockfile maintenance ([0434cfa](https://github.com/uzh-bf/klicker-uzh/commit/0434cfa1cd999fb368f107e70922667ca1471d18))

## [2.0.0-alpha.14](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.12...v2.0.0-alpha.14) (2022-08-23)


### Features

* add basic possibility to join and leave a course (participation) ([#2767](https://github.com/uzh-bf/klicker-uzh/issues/2767)) ([30356af](https://github.com/uzh-bf/klicker-uzh/commit/30356af7b8e58b30346610e4ac459a26c39f6004))
* enhance learning element display ([#2773](https://github.com/uzh-bf/klicker-uzh/issues/2773)) ([765011f](https://github.com/uzh-bf/klicker-uzh/commit/765011f28b7a3754e03485925466273e1fae8d45))


### Other

* lockfile maintenance ([867953d](https://github.com/uzh-bf/klicker-uzh/commit/867953d737c5bcf09b0e8a7671a3767942315bb7))
* **release:** 2.0.0-alpha.13 ([4f841be](https://github.com/uzh-bf/klicker-uzh/commit/4f841be9c866a932e9733085fe542791cb415358))

## [2.0.0-alpha.13](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.12...v2.0.0-alpha.13) (2022-08-21)


### Features

* add basic possibility to join and leave a course (participation) ([#2767](https://github.com/uzh-bf/klicker-uzh/issues/2767)) ([30356af](https://github.com/uzh-bf/klicker-uzh/commit/30356af7b8e58b30346610e4ac459a26c39f6004))

## [2.0.0-alpha.12](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.11...v2.0.0-alpha.12) (2022-08-21)


### Features

* display course and participant details on the learning embed page ([#2766](https://github.com/uzh-bf/klicker-uzh/issues/2766)) ([ec168e6](https://github.com/uzh-bf/klicker-uzh/commit/ec168e64c46075f361a43c4fa5d4112f021f39c6))


### Build and CI

* ensure that actions run only if anything in the relevant app was changed ([6042186](https://github.com/uzh-bf/klicker-uzh/commit/60421868178eb3326426547a42f1bd47d3f62e63))
* **frontend-learning:** add caching for Next.js to the GH action ([9e8b8f5](https://github.com/uzh-bf/klicker-uzh/commit/9e8b8f5e67cdc31842fe065a858b6e8266746029))
* **frontend-learning:** use vercel to build the project ([684ad70](https://github.com/uzh-bf/klicker-uzh/commit/684ad7006460a9f5380236859f180f7388392f2c))
* **frontend-manage:** ensure we deploy manage frontend to the correct vercel project ([c7de996](https://github.com/uzh-bf/klicker-uzh/commit/c7de99697b0f92a24dcb4c014ee2c04b11fc1139))
* move all next.js builds to the vercel platform ([92f3350](https://github.com/uzh-bf/klicker-uzh/commit/92f3350135e642acf54691aa6b25b3bb7e08cf8f))
* **packages/prisma:** add initial GH workflow for NPM publish ([7f01c8a](https://github.com/uzh-bf/klicker-uzh/commit/7f01c8af04900f138e714c8770c220f72caec7e6))
* **packages/prisma:** move actions workflow to drafts ([2073f8e](https://github.com/uzh-bf/klicker-uzh/commit/2073f8e50a90ae087d9fa0dd9b529b56b726a797))
* remove builds property from vercel.json files ([5e81be0](https://github.com/uzh-bf/klicker-uzh/commit/5e81be07acd85c8250c093aa9f2a37310fb11f52))


### Other

* add publish command to turbo and ensure apps/ and docs/ will not be published ([90a164a](https://github.com/uzh-bf/klicker-uzh/commit/90a164a79272569048e800faf562555cc785c6f7))
* add turbo publish command ([be60bb4](https://github.com/uzh-bf/klicker-uzh/commit/be60bb4d42090bfaf776e14cc030f81e020d177d))
* **docs:** use npm start instead of dev ([69f1d5d](https://github.com/uzh-bf/klicker-uzh/commit/69f1d5d9acc6ef6183484e3a96a42859ff6e1b09))
* **frontend-learning:** add stub index page ([2e05fe8](https://github.com/uzh-bf/klicker-uzh/commit/2e05fe88f48bfc18cccc5eec5c8a1c4219d07992))
* lockfile maintenance ([3d3d283](https://github.com/uzh-bf/klicker-uzh/commit/3d3d28334787a4afa78bba9cab1f28a6a8c5af88))

## [2.0.0-alpha.11](https://github.com/uzh-bf/klicker-uzh/compare/v2.0.0-alpha.10...v2.0.0-alpha.11) (2022-08-20)


### Build and CI

* add sonarcloud workflow ([8f55d37](https://github.com/uzh-bf/klicker-uzh/commit/8f55d376318ff80f75b246059f3fd8c1d1f50f51))
* **frontend-learning:** add github actions workflow for dev vercel deployment ([719639d](https://github.com/uzh-bf/klicker-uzh/commit/719639d483a2e8ae74e5efc0b28f29c38a112b9d))
* **frontend-learning:** remove top-level package definitions for action to work ([e6ec876](https://github.com/uzh-bf/klicker-uzh/commit/e6ec87656e93f1d780e9779eb6233761a709ce59))
* **frontend-manage:** add vercel deployment with github actions ([b14cf06](https://github.com/uzh-bf/klicker-uzh/commit/b14cf06e33ca45673a9f3520e07c981ea2761316))
* **frontend-pwa:** add github action for frontend-pwa deploy ([daa79d8](https://github.com/uzh-bf/klicker-uzh/commit/daa79d8ff7f663fd523aa1c2c2ee6dfe4fed8a47))
* move sources config to sonar-project.properties ([c5c9b4d](https://github.com/uzh-bf/klicker-uzh/commit/c5c9b4d0df378e423f38bc54080b9c7d9a61f97b))
* remove azure static web app deploy and fix frontend-learning deploy ([0381837](https://github.com/uzh-bf/klicker-uzh/commit/0381837c5be973b919849f37dda5c351429984d4))


### Other

* add docs/ to versionrc ([0e6926c](https://github.com/uzh-bf/klicker-uzh/commit/0e6926c2f6df6ef988c7abc3f4a570ed6dd2a015))
* **backend-sls:** downgrade node [@types](https://github.com/types) to match v16 ([d87ec45](https://github.com/uzh-bf/klicker-uzh/commit/d87ec450ad11594164935e0a77cd9e1992719165))
* **deps-dev:** bump @types/passport from 1.0.9 to 1.0.10 in /apps/backend-sls ([#2751](https://github.com/uzh-bf/klicker-uzh/issues/2751)) ([92ec18c](https://github.com/uzh-bf/klicker-uzh/commit/92ec18c4d71415badfb6d1dd1ca8ba213306bcc1))
* **deps-dev:** bump @types/react from 18.0.15 to 18.0.17 in /apps/frontend-manage ([#2744](https://github.com/uzh-bf/klicker-uzh/issues/2744)) ([b724a78](https://github.com/uzh-bf/klicker-uzh/commit/b724a78f597a558a22f437a1f9c587bf0250a112))
* **deps-dev:** bump @types/react from 18.0.15 to 18.0.17 in /apps/frontend-pwa ([#2747](https://github.com/uzh-bf/klicker-uzh/issues/2747)) ([09aa4db](https://github.com/uzh-bf/klicker-uzh/commit/09aa4db70698145d734e2b3b3ede813cc184ca1e))
* **deps-dev:** bump eslint from 8.20.0 to 8.22.0 in /apps/frontend-manage ([#2757](https://github.com/uzh-bf/klicker-uzh/issues/2757)) ([e35adaf](https://github.com/uzh-bf/klicker-uzh/commit/e35adaffd03a5c31c0e6a3a0a700396c2ef6d781))
* **deps-dev:** bump postcss from 8.4.14 to 8.4.16 in /apps/frontend-learning ([#2756](https://github.com/uzh-bf/klicker-uzh/issues/2756)) ([98dd568](https://github.com/uzh-bf/klicker-uzh/commit/98dd568f17f45e356609d272fea7a5b3d7105f35))
* **deps-dev:** bump postcss from 8.4.14 to 8.4.16 in /apps/frontend-manage ([#2753](https://github.com/uzh-bf/klicker-uzh/issues/2753)) ([50aabd1](https://github.com/uzh-bf/klicker-uzh/commit/50aabd1463aca8fe4a27ca48cb6ff7f9a735cfb9))
* **deps-dev:** bump postcss from 8.4.14 to 8.4.16 in /apps/frontend-pwa ([#2750](https://github.com/uzh-bf/klicker-uzh/issues/2750)) ([70aad47](https://github.com/uzh-bf/klicker-uzh/commit/70aad47a9889c1f8adfa93234d944da63eded617))
* **deps-dev:** bump prettier-plugin-organize-imports from 3.0.3 to 3.1.0 in /packages/graphql ([#2764](https://github.com/uzh-bf/klicker-uzh/issues/2764)) ([043b6c0](https://github.com/uzh-bf/klicker-uzh/commit/043b6c03d7ca5522af4bfe74803c38fc8a8ac345))
* **deps-dev:** bump prisma-erd-generator from 1.0.2 to 1.1.0 in /packages/prisma ([#2743](https://github.com/uzh-bf/klicker-uzh/issues/2743)) ([611a375](https://github.com/uzh-bf/klicker-uzh/commit/611a37531a1b0a8b80af235e413f0a857f594acc))
* **deps-dev:** bump size-limit from 8.0.0 to 8.0.1 in /apps/backend-sls ([#2759](https://github.com/uzh-bf/klicker-uzh/issues/2759)) ([8975b4e](https://github.com/uzh-bf/klicker-uzh/commit/8975b4e6f1e3a0dee53303a40ab2970fb10867b0))
* **deps:** bump @graphql-yoga/node from 2.13.6 to 2.13.8 in /apps/backend-sls ([#2763](https://github.com/uzh-bf/klicker-uzh/issues/2763)) ([b0c0e04](https://github.com/uzh-bf/klicker-uzh/commit/b0c0e04d6d1521e55009ab1e52b34d08327015e8))
* **deps:** bump graphql from 16.5.0 to 16.6.0 in /apps/backend-sls ([#2765](https://github.com/uzh-bf/klicker-uzh/issues/2765)) ([5db0ef6](https://github.com/uzh-bf/klicker-uzh/commit/5db0ef6298dc95f42806b42027b0c7fdcc7b38e4))
* **deps:** bump graphql from 16.5.0 to 16.6.0 in /apps/frontend-learning ([#2761](https://github.com/uzh-bf/klicker-uzh/issues/2761)) ([e6eaaa3](https://github.com/uzh-bf/klicker-uzh/commit/e6eaaa35d5f37e34d637fb4dc9d8fa93b4333ba4))
* **deps:** bump graphql from 16.5.0 to 16.6.0 in /apps/frontend-pwa ([#2758](https://github.com/uzh-bf/klicker-uzh/issues/2758)) ([e8f040a](https://github.com/uzh-bf/klicker-uzh/commit/e8f040aa995d504efd126f2cba27dc16ffe986ca))
* **deps:** bump graphql from 16.5.0 to 16.6.0 in /packages/graphql ([#2755](https://github.com/uzh-bf/klicker-uzh/issues/2755)) ([c981b5a](https://github.com/uzh-bf/klicker-uzh/commit/c981b5a04c69fc29765f97e44d55b72a0fa85809))
* **docs:** move docs from legacy to top-level ([7928e17](https://github.com/uzh-bf/klicker-uzh/commit/7928e1770b33ab6971f6a545058c83924eb89b36))
* **frontend-*:** ensure consistency in apollo setup ([31b3d09](https://github.com/uzh-bf/klicker-uzh/commit/31b3d09c33697415252da43149d489535e8b7441))
* lockfile maintenance ([d8c8919](https://github.com/uzh-bf/klicker-uzh/commit/d8c89199197dd7f17ef0730e8f294b0a00bb027d))
* lockfile maintenance ([8ece2dc](https://github.com/uzh-bf/klicker-uzh/commit/8ece2dc794d0daf404975647544c3e852dadbfdb))
* move shibboleth and functions to legacy dir ([146df07](https://github.com/uzh-bf/klicker-uzh/commit/146df072b2b08991b27a37fd5e140210fb034d99))
* update dependabot config for new repo structure ([b6177d8](https://github.com/uzh-bf/klicker-uzh/commit/b6177d883920c8687732812816b973746fa460e4))

## [2.0.0-alpha.10](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.1...v2.0.0-alpha.10) (2022-08-20)


### Features

* add simple LTI participant registration on a course overview page ([#2741](https://github.com/uzh-bf/klicker-uzh/issues/2741)) ([a4cc12f](https://github.com/uzh-bf/klicker-uzh/commit/a4cc12f2f4f230fd6b59cdcbb90bfccb99ac91ab))


### Bug Fixes

* **apps/frontend-pwa:** ensure that prettier config is imported correctly ([c2bc054](https://github.com/uzh-bf/klicker-uzh/commit/c2bc054ae06fd27cfd93eab819348118ac6bf848))
* **docs:** add react import to all files with jsx ([fe1a9d8](https://github.com/uzh-bf/klicker-uzh/commit/fe1a9d863a2b5f98414ecf63a116974339365b83))
* **packages/prisma:** generate openssl-1.1 target beside native ([42127ab](https://github.com/uzh-bf/klicker-uzh/commit/42127ab0466a4daa8576211f8ead82ea87aef690))


### Refactors

* **frontend:** replace all buttons by design system component ([#2737](https://github.com/uzh-bf/klicker-uzh/issues/2737)) ([8336a27](https://github.com/uzh-bf/klicker-uzh/commit/8336a27038e1faa9f84a4bdc7d2de58796cf5950))


### Build and CI

* add Azure Static Web Apps workflow file ([c3d86ca](https://github.com/uzh-bf/klicker-uzh/commit/c3d86cacfb7f5e46d32863cd6ea70c346748352b))


### Other

* **apps/backend-sls:** add node16 tsconfig ([235149e](https://github.com/uzh-bf/klicker-uzh/commit/235149efba9b4becaac5828fdeff978f136ed8d4))
* **apps/backend-sls:** update paths to serverless app ([96d725b](https://github.com/uzh-bf/klicker-uzh/commit/96d725b6538c10f9dbd799635d6e52f56f65683a))
* **apps/frontend-learning:** add basic lti integration ([7eb0209](https://github.com/uzh-bf/klicker-uzh/commit/7eb02099a50054c1b0f3d567ca5ed938546f9d60))
* **apps/frontend-learning:** integrate with own lti package ([0eb17ed](https://github.com/uzh-bf/klicker-uzh/commit/0eb17ed9a0a5ef626c886b1c9d311786957860ea))
* **apps/frontend-pwa:** add .map files to gitignore ([5b58ee8](https://github.com/uzh-bf/klicker-uzh/commit/5b58ee88252b7a2017e1dc179c7861ccec3f65cf))
* **backend-sls:** make dependent on new prisma package ([8f061d8](https://github.com/uzh-bf/klicker-uzh/commit/8f061d8c1054451154cd903822570f80303ada2c))
* **backend-sls:** use current alpha version of @klicker-uzh/graphql ([318b857](https://github.com/uzh-bf/klicker-uzh/commit/318b857c6a3e9597a54cbefdf614f1832362366a))
* **ci:** install in repo root and move node_modules ([b2d7c48](https://github.com/uzh-bf/klicker-uzh/commit/b2d7c486423a1f058f9b3d84d521b217edbc17ff))
* **ci:** omit dev dependencies after build ([019ab11](https://github.com/uzh-bf/klicker-uzh/commit/019ab11098b94c64447a66f466ad391ec546203d))
* **ci:** print additional info ([189da44](https://github.com/uzh-bf/klicker-uzh/commit/189da446b7e239a41c788bfea5f5257a43b12e58))
* **ci:** remove monorepo package definitions in PWA build ([e1f4432](https://github.com/uzh-bf/klicker-uzh/commit/e1f44328ac574784bf7a67814b424d73d3bd9b5f))
* **ci:** try npm install without package lock ([cd593ab](https://github.com/uzh-bf/klicker-uzh/commit/cd593ab3bc066f1d98c98be5514448f4d3be0196))
* **ci:** try to disable monorepo in action ([48bc43d](https://github.com/uzh-bf/klicker-uzh/commit/48bc43d66e4641cd45c69b45754d96a0dfe1e1b9))
* **ci:** update package path for azure functions ([3b3b94e](https://github.com/uzh-bf/klicker-uzh/commit/3b3b94e21d7a4bd140a0d55073b0584f9429e4b1))
* **ci:** use node 16 in azure static web app deploy ([d1d3b5c](https://github.com/uzh-bf/klicker-uzh/commit/d1d3b5ca1ffc7c7fb37198770272b84e69a4bbb1))
* **deploy:** update redis dependency in helm chart ([9cfbed4](https://github.com/uzh-bf/klicker-uzh/commit/9cfbed45d36a504a2c746830d68c6bc735b84724))
* **docs:** remove blog page from klicker website and replace it by corresponding community entries ([1f3d2fb](https://github.com/uzh-bf/klicker-uzh/commit/1f3d2fb68a7fa582ee1c678d8b38bf89724315f5))
* ensure prettier, prettier-plugin-organize-imports, tailwind-merge are installed where needed ([fbc6f97](https://github.com/uzh-bf/klicker-uzh/commit/fbc6f970de3d768819fd78f18b3a004ae93480f9))
* **frontend-pwa:** use current alpha version of @klicker-uzh/graphql ([d4c734a](https://github.com/uzh-bf/klicker-uzh/commit/d4c734a92e93b721c081b503df5228466fa7e856))
* lockfile maintenance ([6bfde89](https://github.com/uzh-bf/klicker-uzh/commit/6bfde896bd2471a9f7b52f4ada140be9aa2f2e26))
* lockfile maintenance ([5f74ff2](https://github.com/uzh-bf/klicker-uzh/commit/5f74ff2cf97d46ec7de609610899cacca7e69eca))
* lockfile maintenance ([f7da61a](https://github.com/uzh-bf/klicker-uzh/commit/f7da61ae6735156d3b4b5f8ea42b969c78cb01d0))
* lockfile maintenance ([5762f11](https://github.com/uzh-bf/klicker-uzh/commit/5762f11e6c35f77bbc072bbe44bf97fa0a25ffb3))
* lockfile maintenance ([89d13c3](https://github.com/uzh-bf/klicker-uzh/commit/89d13c3fc6d394f23d64ccf2ef2f6f0ce22aa98c))
* lockfile maintenance ([3834e01](https://github.com/uzh-bf/klicker-uzh/commit/3834e012fcacb357d2e85fe3b8819e740dbda505))
* lockfile maintenance ([9760935](https://github.com/uzh-bf/klicker-uzh/commit/9760935e857c9bf853c039bf4136c3f059368652))
* **packages/graphql:** make dependant on new prisma package ([2be0026](https://github.com/uzh-bf/klicker-uzh/commit/2be00269fa12afe0776794dbf3e0d8e99d40dd60))
* **packages/graphql:** move prisma client to built directory ([73d3a68](https://github.com/uzh-bf/klicker-uzh/commit/73d3a687a182482b85201acf5b1c3e715f181ba9))
* **packages/graphql:** version bump ([e70a5fd](https://github.com/uzh-bf/klicker-uzh/commit/e70a5fd538ebb91365ca986cf11548a143dbe347))
* **packages/graphql:** version bump ([0f83bf8](https://github.com/uzh-bf/klicker-uzh/commit/0f83bf831b37f0e620d25f16cae6f1d310bd6c84))
* **packages/lti:** initial work on lti package ([809f99a](https://github.com/uzh-bf/klicker-uzh/commit/809f99a20090793878568962132130493137edcb))
* **packages/prisma:** copy query engine to dist ([283f421](https://github.com/uzh-bf/klicker-uzh/commit/283f4214b471c2ecbdedef396cea2682a6f197cf))
* **packages/prisma:** generate prisma SVG ([23af08c](https://github.com/uzh-bf/klicker-uzh/commit/23af08ce8d909536cf90cf9f1c1ac1880edd51a3))
* **packages/prisma:** move prisma to a dedicated package ([731d137](https://github.com/uzh-bf/klicker-uzh/commit/731d137c310a72cee209ffa5aab913d0e43d777b))
* **packages/prisma:** use a copy script to copy dist files ([47b2760](https://github.com/uzh-bf/klicker-uzh/commit/47b27605299f9e5322c5286c1419fc4961a28724))
* **packages/prisma:** version bump ([1bcaa22](https://github.com/uzh-bf/klicker-uzh/commit/1bcaa22d34e0480bbf48818318803081e3e74cdc))
* reformat codebase including prettier-plugin-organize-imports ([#2739](https://github.com/uzh-bf/klicker-uzh/issues/2739)) ([f8019c6](https://github.com/uzh-bf/klicker-uzh/commit/f8019c6af4ed3faf04b11e47b892b1ac168d6c3b))
* regenerate lockfile ([15eafb2](https://github.com/uzh-bf/klicker-uzh/commit/15eafb207683c9d562fed43a293d485eaaab6312))
* remove cruft ([e2458a2](https://github.com/uzh-bf/klicker-uzh/commit/e2458a2f97144e749872885b312cf724121dd507))
* stub out new backend and frontend apps ([41414b2](https://github.com/uzh-bf/klicker-uzh/commit/41414b23c1a5434b434e128a7b46ebf8b179dd59))
* update readme with required setup steps ([1aa726d](https://github.com/uzh-bf/klicker-uzh/commit/1aa726d1869d28b776cb08e6ca0ce77843b24b31))
* upgrade design system ([f2aa914](https://github.com/uzh-bf/klicker-uzh/commit/f2aa9147ed754c9aa67165a09f88d5968e7e46f0))
* volta upgrades ([4e1007b](https://github.com/uzh-bf/klicker-uzh/commit/4e1007b08c53c60713944ce408d5e671d9046539))


### Dependencies

* **packages/graphql:** install prettier and imports plugin ([8965ef8](https://github.com/uzh-bf/klicker-uzh/commit/8965ef81ea40a45880998c1eb55fefbf5eeac9d9))
* upgrade [@klicker-uzh](https://github.com/klicker-uzh) dependencies ([81b007e](https://github.com/uzh-bf/klicker-uzh/commit/81b007e1a255fa0d734d0cdfe14ae66528253fe1))


### Enhancements

* **apps/backend-sls:** ensure learning elements and instances are exposed as a list ([920cb2c](https://github.com/uzh-bf/klicker-uzh/commit/920cb2ca301d6a6bc7aaf41bfdc6ab0ab1a23870))
* **apps/frontend-learning:** make the cookie domain configurable ([b771399](https://github.com/uzh-bf/klicker-uzh/commit/b771399d11616e47eb71706b2400a3ce5ef10d77))
* **apps/frontend-learning:** stub pages for elements and courses ([7c5302d](https://github.com/uzh-bf/klicker-uzh/commit/7c5302d3f780abb5c26584790036c7f838eb5ff1))
* **apps/frontend-pwa:** setup foundations for next-pwa ([#2740](https://github.com/uzh-bf/klicker-uzh/issues/2740)) ([7faabfe](https://github.com/uzh-bf/klicker-uzh/commit/7faabfeebfcde76951a4f1547485c6e83806b686))
* bootstrap new app architecture ([#2736](https://github.com/uzh-bf/klicker-uzh/issues/2736)) ([6e7d7c4](https://github.com/uzh-bf/klicker-uzh/commit/6e7d7c4799273bd6ae1098d2c22d112f24d53502))
* **db:** add initial stats generation script ([8e696d2](https://github.com/uzh-bf/klicker-uzh/commit/8e696d20565c483b86ff0da80290b8e6295784bb))
* ensure that the participant is only registered if there is no cookie present yet ([9857c52](https://github.com/uzh-bf/klicker-uzh/commit/9857c522bc291ce270506484027f2dd4206ff2aa))
* **frontend:** add percentage figures to multiple choice question evaluation ([e4d6aad](https://github.com/uzh-bf/klicker-uzh/commit/e4d6aade403f201647b2b0b8b4b2cc03e010624d))
* **frontend:** integrate with uzh-bf/design-system ([0191e95](https://github.com/uzh-bf/klicker-uzh/commit/0191e9595fab9a0bf5777fe759fb4b1de97c28b3))
* **frontend:** redesigned question pool, simplified session creation and quick start functionality ([#2731](https://github.com/uzh-bf/klicker-uzh/issues/2731)) ([3f090d2](https://github.com/uzh-bf/klicker-uzh/commit/3f090d2326572270f37866a833ccd7e9a0ae41f3))
* **frontend:** revised show solution logic on evaluation ([ffc4397](https://github.com/uzh-bf/klicker-uzh/commit/ffc439739da8db3407ff1f45301e2ecc523c819f))
* **frontend:** turn off showGraph and showSolution on change of active instance on running session evaluation ([0df3316](https://github.com/uzh-bf/klicker-uzh/commit/0df331632380312f9c88fc09b112fdb9e2e2bbed))
* **packages/graphql:** improve login process for user ([3dbcf18](https://github.com/uzh-bf/klicker-uzh/commit/3dbcf18de91e9fb5b9305a9dd91cba74c8c14565))
* **packages/graphql:** make all instances accessible ([169c379](https://github.com/uzh-bf/klicker-uzh/commit/169c379e92f430e69f9955b60f266ce78b47959c))

### [1.8.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0...v1.8.1) (2022-08-02)


### Bug Fixes

* **docs:** add client-side redirects for old tos and privacy links ([1010e39](https://github.com/uzh-bf/klicker-uzh/commit/1010e3900701d73484318427e0f2b65e2e1f1763))
* **README:** update link to FAQ ([8f1de36](https://github.com/uzh-bf/klicker-uzh/commit/8f1de3612b544717efb8fb5d87cd2fd5b7c21730))


### Enhancements

* **docs:** adjust documentation for movo export to KlickerUZH ([#2730](https://github.com/uzh-bf/klicker-uzh/issues/2730)) ([58c44eb](https://github.com/uzh-bf/klicker-uzh/commit/58c44eb14b07c832ff10b5e761f85cfcad2276d2))


### Documentation

* **frontend:** added link to movo community page on corresponding docs page ([91a1c5e](https://github.com/uzh-bf/klicker-uzh/commit/91a1c5ea29a66eae56fbe98eba63853a9c7c1fc3))


### Other

* **deploy:** update pulumi scripts ([ca9afc8](https://github.com/uzh-bf/klicker-uzh/commit/ca9afc8cedf42d928b0aa41196ca076128ddf8c8))
* **docs:** add redirect to MS Teams ([52f3df7](https://github.com/uzh-bf/klicker-uzh/commit/52f3df76b657f7b645727821217de0935110f89d))
* **frontend:** fix links to privacy policy and tos on signup page ([a893a8b](https://github.com/uzh-bf/klicker-uzh/commit/a893a8be24931f0d444d87befb4ab9a4100839db))
* lockfile maintenance ([be134c8](https://github.com/uzh-bf/klicker-uzh/commit/be134c8eb67707166e91cccc1242fd9419e07774))
* **shibboleth:** replace certificate path ([4d7e6cb](https://github.com/uzh-bf/klicker-uzh/commit/4d7e6cb23529b4515045ff9d6ea842d5142babd0))

## [1.8.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.37...v1.8.0) (2022-05-12)

## [1.8.0-rc.37](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.36...v1.8.0-rc.37) (2022-05-12)


### Bug Fixes

* **frontend:** double encode the href for aai login ([a0cd461](https://github.com/uzh-bf/klicker-uzh/commit/a0cd4611a7e6b40389a14182d7ebea618ff3f328))

## [1.8.0-rc.36](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.35...v1.8.0-rc.36) (2022-05-12)


### Bug Fixes

* **frontend:** encode the redirect link for aai ([e3c365f](https://github.com/uzh-bf/klicker-uzh/commit/e3c365f6902651aa18db03a60febea2f1afb4f86))

## [1.8.0-rc.35](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.34...v1.8.0-rc.35) (2022-05-12)


### Bug Fixes

* **shibboleth:** ensure query is available in login ([4c4b4c9](https://github.com/uzh-bf/klicker-uzh/commit/4c4b4c9155d81c4c4fa3ab617fb47b502368683a))

## [1.8.0-rc.34](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.33...v1.8.0-rc.34) (2022-05-12)


### Other

* **frontend:** replace websocket link with official implementation ([8469585](https://github.com/uzh-bf/klicker-uzh/commit/84695858ff7fdfafb81022669ba2328653d64fb7))

## [1.8.0-rc.33](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.32...v1.8.0-rc.33) (2022-05-12)


### Other

* **frontend:** use encoded redirectPath for aai login ([202e3a7](https://github.com/uzh-bf/klicker-uzh/commit/202e3a7a8379147cc4f920b31aac3ec73d38be69))

## [1.8.0-rc.32](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.31...v1.8.0-rc.32) (2022-05-12)


### Other

* add redirect_to for AAI login ([805356c](https://github.com/uzh-bf/klicker-uzh/commit/805356cd1e5214dc233959d64238cf6fc02dcb0e))
* **frontend:** use uri component encoding and useEffect for redirect_to ([f0402b7](https://github.com/uzh-bf/klicker-uzh/commit/f0402b74ad7412a8ff604f962cb399d5c53c1a6f))

## [1.8.0-rc.31](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.30...v1.8.0-rc.31) (2022-05-12)


### Other

* **backend:** adjust email text for movo ([6769938](https://github.com/uzh-bf/klicker-uzh/commit/6769938da3abcee9b2d4323d47135a6d0a82e2bd))
* **docs:** add announcements and feedback to docs navbar ([80da897](https://github.com/uzh-bf/klicker-uzh/commit/80da89788bddd8772b942a98a2a6088790412c76))

## [1.8.0-rc.30](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.29...v1.8.0-rc.30) (2022-05-11)


### Enhancements

* **frontend:** automatically redirect the user to his previously visited site on login ([#2726](https://github.com/uzh-bf/klicker-uzh/issues/2726)) ([4513697](https://github.com/uzh-bf/klicker-uzh/commit/4513697fc447f2215ca335a9e4e6cd00b512965f))


### Other

* **deploy:** enable movo on prod ([f949aae](https://github.com/uzh-bf/klicker-uzh/commit/f949aae419be961b61ef1b80f246e2ecf2bbbe00))
* **deploy:** use existing postgres password ([9d92482](https://github.com/uzh-bf/klicker-uzh/commit/9d92482c54e650dd892d4e087a891eca5b4f4698))
* **docs:** remove blog link and add community ([07f0547](https://github.com/uzh-bf/klicker-uzh/commit/07f0547ebe1204b939c287783aba5e73836f8ea8))
* **docs:** update link to community ([5051beb](https://github.com/uzh-bf/klicker-uzh/commit/5051beb36e6ffe3981a0ff0b226e614bcc2ddb85))
* **frontend:** add redirect_to parameter when login missing ([0bf1c00](https://github.com/uzh-bf/klicker-uzh/commit/0bf1c0089989910cda1942f1be873badb193b37c))

## [1.8.0-rc.29](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.28...v1.8.0-rc.29) (2022-05-11)

## [1.8.0-rc.28](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.27...v1.8.0-rc.28) (2022-05-11)


### Other

* add apps/functions to version upgrader ([5abba62](https://github.com/uzh-bf/klicker-uzh/commit/5abba62126f59d0ed58a2b9db420853e347197d0))
* add movo and discourse to deployment configs ([52ee8ad](https://github.com/uzh-bf/klicker-uzh/commit/52ee8add76d275e0b066078af39bbc25e20b3c4c))
* **deploy:** add production config for klicker community discourse ([e2dbb97](https://github.com/uzh-bf/klicker-uzh/commit/e2dbb97dc0a115fd5470abf971d765d6534317c4))
* **functions:** add teams notification ([aca521d](https://github.com/uzh-bf/klicker-uzh/commit/aca521dc9097390e4c52e5fd4af633d8d0cbb715))
* **functions:** move to separate root-level directory ([73d1b76](https://github.com/uzh-bf/klicker-uzh/commit/73d1b768b661593bd5689fd68f5a3476ae3bb0f0))
* update version upgrader for new location of functions ([8b39b57](https://github.com/uzh-bf/klicker-uzh/commit/8b39b5711b6d2df182b625321462de23db59d84c))

## [1.8.0-rc.27](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.26...v1.8.0-rc.27) (2022-05-09)


### Bug Fixes

* remove browser tooltips on SC MC answer options on evaluation ([ab509e4](https://github.com/uzh-bf/klicker-uzh/commit/ab509e4ffec9b7b7a78fcdfd0f174c4f2d8f1e01))


### Enhancements

* initial work on serverless functions (movo import, add response) ([#2722](https://github.com/uzh-bf/klicker-uzh/issues/2722)) ([1d0d3c6](https://github.com/uzh-bf/klicker-uzh/commit/1d0d3c60907951ce1dd5103ac818dcd2f9caf935))


### Other

* add or replace links for new community platform ([da40464](https://github.com/uzh-bf/klicker-uzh/commit/da4046421fcc370b86021fb66dc43e09633f7d3d))
* lockfile maintenance ([3abd001](https://github.com/uzh-bf/klicker-uzh/commit/3abd001f70359cae63ac37dfed6826fcb1c7e505))
* lockfile maintenance ([f4d2d8a](https://github.com/uzh-bf/klicker-uzh/commit/f4d2d8abae4d3428fe909001e89e99c7884311e9))
* remove internal support email for external users ([167f40b](https://github.com/uzh-bf/klicker-uzh/commit/167f40b0a4b8676f4538ef84ee1499d834633fb9))
* replace missing user group form with link to community ([915baee](https://github.com/uzh-bf/klicker-uzh/commit/915baeee79abe59b8d63d8d99b0b3b29b2967160))

## [1.8.0-rc.26](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.25...v1.8.0-rc.26) (2022-05-08)


### Bug Fixes

* **frontend:** fixed markdown parsing issue in regex ([31ec878](https://github.com/uzh-bf/klicker-uzh/commit/31ec878d78b9650c2bced05a27f74aa616037546))


### Other

* **deploy:** update config for containers ([390bf25](https://github.com/uzh-bf/klicker-uzh/commit/390bf254bbd2a2e4c042a258ef193c45740a5188))
* lockfile maintenance ([d119e0d](https://github.com/uzh-bf/klicker-uzh/commit/d119e0dd561f9371cbd9ea0559268082b29e49f0))

## [1.8.0-rc.25](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.24...v1.8.0-rc.25) (2022-05-02)


### Enhancements

* **backend:** add the shortname to the redirect url as a username for discourse ([ffb042e](https://github.com/uzh-bf/klicker-uzh/commit/ffb042e392278ccb47b1856469f015840b6b3512))

## [1.8.0-rc.24](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.23...v1.8.0-rc.24) (2022-05-02)


### Features

* add endpoint to validate discourse login and redirect to the platform ([1a928be](https://github.com/uzh-bf/klicker-uzh/commit/1a928bed60c7cd671a39842b5d6842af45d0b86f))


### Other

* lockfile maintenance ([257dfe5](https://github.com/uzh-bf/klicker-uzh/commit/257dfe5263ae783cb8d508b4ef3b5ba16ab84814))

## [1.8.0-rc.23](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.22...v1.8.0-rc.23) (2022-05-02)


### Bug Fixes

* escaping special chars for slate state ([e19fd00](https://github.com/uzh-bf/klicker-uzh/commit/e19fd000c71aebf684ff8634135eb9e2aa810fbb))

## [1.8.0-rc.22](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.21...v1.8.0-rc.22) (2022-05-02)


### Bug Fixes

* **backend:** double escape backslashes to ensure correct latex rendering ([#2723](https://github.com/uzh-bf/klicker-uzh/issues/2723)) ([0405d7e](https://github.com/uzh-bf/klicker-uzh/commit/0405d7e355afa19e91f842b5fa773c7fbc669d23))


### Enhancements

* **docs:** add documentation for movo import to KlickerUZH ([2f0ddd5](https://github.com/uzh-bf/klicker-uzh/commit/2f0ddd5ddb78cccefb10464f404ccc691a935afb))


### Other

* **backend:** ignore db scripts .env ([5170951](https://github.com/uzh-bf/klicker-uzh/commit/51709516cdd8b20e58c46d936bf845fd7e61f177))
* **backend:** update copyright year in docs footer ([e5e93a2](https://github.com/uzh-bf/klicker-uzh/commit/e5e93a27eb5b0ba129f472df33d801eecad1511f))
* **docs:** adapt sponsoring docs ([90bb79a](https://github.com/uzh-bf/klicker-uzh/commit/90bb79a9792edcfaba1a61cf32640473885d7fea))
* **docs:** ensure description is not added redundantly ([7994474](https://github.com/uzh-bf/klicker-uzh/commit/799447495981843d09802cd1dfedfaaa8939d53d))
* **frontend:** add link to documentation from migration page instead of support email ([fb7322c](https://github.com/uzh-bf/klicker-uzh/commit/fb7322ceb9c30b0c13b65bf7a84ee0ca46e3292b))
* **frontend:** remove usage history from language build ([4a99806](https://github.com/uzh-bf/klicker-uzh/commit/4a99806826e0ea1c7ef2d417b72dbd018d171bd7))
* lockfile maintenance ([c836413](https://github.com/uzh-bf/klicker-uzh/commit/c83641379cde978b89705f39e665a15fad197301))
* update wording in movo documentation file ([96eaee9](https://github.com/uzh-bf/klicker-uzh/commit/96eaee95a8e5196fe7ca907ee9c912e5b9a39255))

## [1.8.0-rc.21](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.20...v1.8.0-rc.21) (2022-04-19)


### Bug Fixes

* **ui:** ensure that the package builds in docker ([04ff08b](https://github.com/uzh-bf/klicker-uzh/commit/04ff08b0398a29d40cf5a682a7ed90712f13a47f))


### Other

* **docs:** add keywords and description for blog posts and use cases ([f3140a8](https://github.com/uzh-bf/klicker-uzh/commit/f3140a85e874d25ab4eb6e9bdedda3bdd81c77a8))
* **docs:** update sponsoring contents ([3192858](https://github.com/uzh-bf/klicker-uzh/commit/31928582b35fc47016152730def28b8fac3042d0))

## [1.8.0-rc.20](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.19...v1.8.0-rc.20) (2022-04-19)


### Enhancements

* **frontend:** hide usage history and version dropdown if only one version of a question is available ([e332e25](https://github.com/uzh-bf/klicker-uzh/commit/e332e250683205ccaa11995da6e5ba23632feae4))

## [1.8.0-rc.19](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.18...v1.8.0-rc.19) (2022-04-19)


### Bug Fixes

* ensure that ui package is built in dev mode ([2f9a477](https://github.com/uzh-bf/klicker-uzh/commit/2f9a4777da49c2b0cae14aa921b16fff5c562c28))
* **ui:** ensure that dev mode of the ui package integrates well with apps ([36cb2ea](https://github.com/uzh-bf/klicker-uzh/commit/36cb2eac294b39a15a5701880a68ba1ebbf97f6f))


### Other

* **docs:** add draft for sponsoring ([7b6522d](https://github.com/uzh-bf/klicker-uzh/commit/7b6522d583c1939d81a9a35f77012ecc705f570b))
* **frontend:** hide contact info on movo page ([933833a](https://github.com/uzh-bf/klicker-uzh/commit/933833a967c2831396c4170073dc26f0447852fb))
* lockfile maintenance ([93101ab](https://github.com/uzh-bf/klicker-uzh/commit/93101ab15f240a590e3f8b397169e20d25f9371d))

## [1.8.0-rc.18](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.17...v1.8.0-rc.18) (2022-04-18)


### Other

* **deploy:** migrate transactional emails to SES with new replyTo option ([9b4933e](https://github.com/uzh-bf/klicker-uzh/commit/9b4933e2dcdc11e5b7c18f08f767cc76dab42ae4))
* **docs:** use png logo ([dc694fe](https://github.com/uzh-bf/klicker-uzh/commit/dc694fe685b0f4807d11913ef78fe114c0170838))


### Enhancements

* **backend:** enable question import from movo.ch ([#2720](https://github.com/uzh-bf/klicker-uzh/issues/2720)) ([88999b5](https://github.com/uzh-bf/klicker-uzh/commit/88999b5b6709108ad78bdffef4209520cce38875))

## [1.8.0-rc.17](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.16...v1.8.0-rc.17) (2022-04-09)


### Bug Fixes

* **backend:** allow email to be a string to include a display name ([ea16d51](https://github.com/uzh-bf/klicker-uzh/commit/ea16d516c27c904ea279fbcc42db208854fe6650))

## [1.8.0-rc.16](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.15...v1.8.0-rc.16) (2022-04-09)


### Other

* lockfile maintenance ([2932686](https://github.com/uzh-bf/klicker-uzh/commit/29326864ecf529734c6f2f5fd3be84bfb867236a))


### Enhancements

* **backend:** add replyTo for emails ([7b7291e](https://github.com/uzh-bf/klicker-uzh/commit/7b7291e3fe38be862a0c4c26c33d873cccba2006))

## [1.8.0-rc.15](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.14...v1.8.0-rc.15) (2022-04-09)


### Bug Fixes

* **ui:** embed necessary tailwind styles in the ui package ([bdc8d94](https://github.com/uzh-bf/klicker-uzh/commit/bdc8d94d5f6ef108e95159dec21188cf67d8aa23))


### Enhancements

* **docs:** improve page performance and SEO ([e4f946b](https://github.com/uzh-bf/klicker-uzh/commit/e4f946b338b1a2518ab5158c9174f0d58fd51e4e))
* **frontend:** add klicker favicon ([ee2414c](https://github.com/uzh-bf/klicker-uzh/commit/ee2414c99ddac1ab795de0c1cb31bda1dbd3d70e))


### Other

* add app .env files to repo as they contain only dev values ([d164056](https://github.com/uzh-bf/klicker-uzh/commit/d1640566cebd1bb5dceb712045d7cdb891df00c6))
* **deploy:** adapt autoscaling params ([4d5bd44](https://github.com/uzh-bf/klicker-uzh/commit/4d5bd44a208a7fa54387246d80672ed272342188))
* **docs:** add robots.txt, favicon, and extended caching config ([3127c4b](https://github.com/uzh-bf/klicker-uzh/commit/3127c4b12038c3628e51becdcd953117145b990a))
* **docs:** improve image quality and embed SVG logo ([9f9e427](https://github.com/uzh-bf/klicker-uzh/commit/9f9e427e2c983ea5398b550bd81c6e9b62242b77))
* **docs:** update algolia search api key and matmomo url ([d771dc7](https://github.com/uzh-bf/klicker-uzh/commit/d771dc74d3b9612bcd42b68b36255609efd4e25a))
* **docs:** update config for matomo, ideal image, and algolia ([832497e](https://github.com/uzh-bf/klicker-uzh/commit/832497e5be426541e224ec4a82cb224f8aac33bd))
* **README:** update links ([05b6de3](https://github.com/uzh-bf/klicker-uzh/commit/05b6de3ec9f8aab4aa127b945fa74d5f65bb4fac))
* remove cruft related to draft.js ([cfb2e58](https://github.com/uzh-bf/klicker-uzh/commit/cfb2e5808835c7bcc99a69cddfeb9dc66cb93787))

## [1.8.0-rc.14](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.13...v1.8.0-rc.14) (2022-04-04)


### Other

* **deploy:** add repositories to helmfiles and update doppler app ([8014688](https://github.com/uzh-bf/klicker-uzh/commit/80146885bec18a93b3a9cbdc7e0c54308d02e6cd))
* **frontend:** actionbar migration to tailwind, eslint fixes ([c1507ea](https://github.com/uzh-bf/klicker-uzh/commit/c1507ea7f3a294cd880a8aa7da50e184d8842eaa))
* **frontend:** fix typos from migration ([60b9e53](https://github.com/uzh-bf/klicker-uzh/commit/60b9e5371e147d5026476415fe9c3903122bb8f8))
* **frontend:** migrate question component to tailwind ([16da031](https://github.com/uzh-bf/klicker-uzh/commit/16da031ce3e238a2d5307263bc4b9ddd5053e873))
* **frontend:** sessionlist migration to tailwind, eslint fixes ([59b0a82](https://github.com/uzh-bf/klicker-uzh/commit/59b0a8226cc4e83fdbcbc309240bd8a3a48bde59))
* lockfile maintenance ([613d435](https://github.com/uzh-bf/klicker-uzh/commit/613d43597db2a056763fd4902593a359b84a1b4e))


### Enhancements

* **backend:** populate new user accounts with demo data ([#2650](https://github.com/uzh-bf/klicker-uzh/issues/2650)) ([6237069](https://github.com/uzh-bf/klicker-uzh/commit/6237069055e620f2d8cca2a6086fe68d06156c08))

## [1.8.0-rc.13](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.12...v1.8.0-rc.13) (2022-03-28)


### Bug Fixes

* **frontend:** fixed pdf export/print of session evaluation ([e8c4cbf](https://github.com/uzh-bf/klicker-uzh/commit/e8c4cbf42b8d4da91ada714dfbb7a9f0a011503e))
* **frontend:** ignore md list syntax at the beginning of SC and MC responses ([1c4afc9](https://github.com/uzh-bf/klicker-uzh/commit/1c4afc999b7a9e7e9d2a85dc13899eeadd6fbd25))
* **frontend:** improve ellipsis shortened answers on evaluation layout and add compatibility with formulas ([937ed3d](https://github.com/uzh-bf/klicker-uzh/commit/937ed3dcdc20aac20d7f56e7fe767b19ec181fea))
* **frontend:** match all markdown list styles in answering options and reduce font weight ([9e1b4c3](https://github.com/uzh-bf/klicker-uzh/commit/9e1b4c387853ec82aa01b01daafae8b2eceeb983))
* **frontend:** only show ellipsis if something is cut after including all partially included formulas ([0487fa6](https://github.com/uzh-bf/klicker-uzh/commit/0487fa6f36aa725e36fbd1f4ac80aad181a248e3))
* **frontend:** solve issue with NR questions on evaluation ([0a52ce8](https://github.com/uzh-bf/klicker-uzh/commit/0a52ce875bfb8277715ef61c2cc75c159910192d))


### Other

* **docs:** create stub file for movo migration ([a6c21ca](https://github.com/uzh-bf/klicker-uzh/commit/a6c21ca86f0d5aea962ee36d4653e4c0e1dbda93))
* **frontend:** migrate most of the evaluation layout to tailwind to prepare restyling ([995d2cb](https://github.com/uzh-bf/klicker-uzh/commit/995d2cbc39de1a8960395cce2e8c8a766a1e0afa))
* **frontend:** reworked evaluation layout without css grid ([e924b1e](https://github.com/uzh-bf/klicker-uzh/commit/e924b1e63203ce303e6bc926463d71a6c2143f0c))
* **frontend:** simplify tailwind logic in multiple components ([3f55654](https://github.com/uzh-bf/klicker-uzh/commit/3f55654aba8dc614adffb09f2b35b19d3d087d98))


### Enhancements

* **frontend:** added functionality to collapse long questions on evaluation view ([663e3ee](https://github.com/uzh-bf/klicker-uzh/commit/663e3ee3fe8d92e8380d1bca574f96e563759011))

## [1.8.0-rc.12](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.11...v1.8.0-rc.12) (2022-03-08)


### Bug Fixes

* **backend:** remove break tags from description and add parsing for question editing ([018ec3e](https://github.com/uzh-bf/klicker-uzh/commit/018ec3e2bb77d18240e06fc5ee5831548eff7d47))
* **backend:** special characters now included in unescaped form in description ([c2932ed](https://github.com/uzh-bf/klicker-uzh/commit/c2932ede335a57878a687508feaeb3486f232aa5))
* **frontend:** ensure that something is returned from ellipsis ([25e0695](https://github.com/uzh-bf/klicker-uzh/commit/25e06953db242be68c9a918f5acad89e51ae54af))

## [1.8.0-rc.11](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.10...v1.8.0-rc.11) (2022-03-06)


### Bug Fixes

* **deploy:** ensure that ingress is not recreated on deployments and update QA deployment for sentry ([c6e31ff](https://github.com/uzh-bf/klicker-uzh/commit/c6e31ffa0d3e57710e8876db67a45aa9d61a70c1))
* **frontend:** update apollo cache config based on next example changes ([56f2528](https://github.com/uzh-bf/klicker-uzh/commit/56f25282d84d86ae4ad01ca7e5ae4a51301c018b))

## [1.8.0-rc.10](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.9...v1.8.0-rc.10) (2022-03-04)


### Bug Fixes

* **frontend:** try/catch on Notification constructor ([63d3bc1](https://github.com/uzh-bf/klicker-uzh/commit/63d3bc1a29b32d2a784ba8bfda5c9f49ef0b29ee))

## [1.8.0-rc.9](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.8...v1.8.0-rc.9) (2022-03-04)


### Bug Fixes

* **frontend:** ensure that sentry config is read correctly using next/config ([01e657a](https://github.com/uzh-bf/klicker-uzh/commit/01e657af99faaea5ab01a4beb6caf05af42e7751))

## [1.8.0-rc.8](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.7...v1.8.0-rc.8) (2022-03-03)


### Other

* **build:** ensure that node 16.14 is used in all stages of the docker container ([c2f7e24](https://github.com/uzh-bf/klicker-uzh/commit/c2f7e24be22eb5fd87018499482b55967fe3364c))

## [1.8.0-rc.7](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.6...v1.8.0-rc.7) (2022-03-03)


### Bug Fixes

* **frontend:** ensure sentry client is injected correctly ([0e482eb](https://github.com/uzh-bf/klicker-uzh/commit/0e482eb4c30b97914d63b627b015f8a9693d76e4))


### Other

* **frontend:** ensure dsn will be read from env ([86af2d9](https://github.com/uzh-bf/klicker-uzh/commit/86af2d998fd02da1e8628517d7f2da5947d96b87))

## [1.8.0-rc.6](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.5...v1.8.0-rc.6) (2022-03-03)


### Bug Fixes

* **deploy:** ensure public env sentry dsn is set ([6ec8301](https://github.com/uzh-bf/klicker-uzh/commit/6ec830115a7e6687a76b72ebfe71a66f1e0f0f44))
* **frontend:** get sentry dsn from public env ([db338e0](https://github.com/uzh-bf/klicker-uzh/commit/db338e0ee34cd33014ef5a16afaeff1853abc7a3))

## [1.8.0-rc.5](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.4...v1.8.0-rc.5) (2022-03-03)


### Other

* **frontend:** sentry rework ([49f33ee](https://github.com/uzh-bf/klicker-uzh/commit/49f33ee7ec33f8fb88b212733d097fbde1eb3206))

## [1.8.0-rc.4](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.3...v1.8.0-rc.4) (2022-03-03)


### Bug Fixes

* **deploy:** ensure that public is injected into the docker image ([a01ed39](https://github.com/uzh-bf/klicker-uzh/commit/a01ed396e6040bffee96a0c621be980388faa5b7))


### Other

* **deploy:** add sentry config for frontend ([c0eb641](https://github.com/uzh-bf/klicker-uzh/commit/c0eb641bde7ed5f2782bee18a2ba21642fc3955b))
* **frontend:** upgrade @sentry/nextjs ([c31900c](https://github.com/uzh-bf/klicker-uzh/commit/c31900cf06a07596308d6c0af0f5b07320071007))

## [1.8.0-rc.3](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.2...v1.8.0-rc.3) (2022-03-03)


### Other

* update resources and loaderio ([cdda203](https://github.com/uzh-bf/klicker-uzh/commit/cdda20358165436623ed76704a20e436bc99f65e))

## [1.8.0-rc.2](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.1...v1.8.0-rc.2) (2022-03-01)


### Bug Fixes

* ensure that public evaluation works ([7557012](https://github.com/uzh-bf/klicker-uzh/commit/7557012f09455ba0c51553eaf53b04a9de2eabf1))
* ensure that questions are not shown again to students ([479e7fb](https://github.com/uzh-bf/klicker-uzh/commit/479e7fb22bdbf9598bf028430b943c1915c45896))


### Other

* lockfile maintenance ([3953804](https://github.com/uzh-bf/klicker-uzh/commit/39538042bf1bf1416b1a6d4f55fd1bb4faa088d4))

## [1.8.0-rc.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-rc.0...v1.8.0-rc.1) (2022-02-22)


### Bug Fixes

* **deploy:** update prd environment configuration ([08c33c5](https://github.com/uzh-bf/klicker-uzh/commit/08c33c5b15c772814f2e5e2255f6468025e420c9))
* **frontend:** apply markdown pipeline only on contents longer than 2 characters ([08eece9](https://github.com/uzh-bf/klicker-uzh/commit/08eece9db60c7830658bb1fec236c0204c3dd5ba))


### Other

* **backend:** add version of the 22FS newsletter ([7dbc47a](https://github.com/uzh-bf/klicker-uzh/commit/7dbc47a5f00b3ae1807bee1dd5dac04e8f38d2f2))
* **deploy:** increase replica counts for prod env ([4b4e5ef](https://github.com/uzh-bf/klicker-uzh/commit/4b4e5ef24b94c8aaea2b6cc3190d92a826b81721))
* **deploy:** remove staging env ([e143a53](https://github.com/uzh-bf/klicker-uzh/commit/e143a53127f54519665d68477389d79b007c4e93))
* **deploy:** update resource configuration of chart ([fc61bd4](https://github.com/uzh-bf/klicker-uzh/commit/fc61bd4090b696fb137ec006e8052d88ee821192))
* **frontend:** update survey links ([8e89a5b](https://github.com/uzh-bf/klicker-uzh/commit/8e89a5b0064d75a57103133818239e074982e986))
* lockfile maintenance ([3dc9adb](https://github.com/uzh-bf/klicker-uzh/commit/3dc9adb631de1e422cb92915072ade2712b8e8cf))

## [1.8.0-rc.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-beta.5...v1.8.0-rc.0) (2022-02-20)


### Bug Fixes

* **frontend:** miscellaneous issues with latex display ([929e3e5](https://github.com/uzh-bf/klicker-uzh/commit/929e3e5d805751eb7795e640ee93ba1526fcffcc))
* **frontend:** use rem for formula font sizes ([a97137e](https://github.com/uzh-bf/klicker-uzh/commit/a97137ede6cdbe8d8868e0ac64f609dbf1e956fe))


### Documentation

* update docs with new slate editor component screenshots and short description ([11cbdde](https://github.com/uzh-bf/klicker-uzh/commit/11cbdde729a3fe8f8dd7775ce06affba24a66d82))


### Other

* adapt formula font size ([a02d2a4](https://github.com/uzh-bf/klicker-uzh/commit/a02d2a45bd9350cad23c3826fb9972393b2004af))
* **frontend:** add tooltip to available choices SC MC to mention markdown and latex support ([6112fdf](https://github.com/uzh-bf/klicker-uzh/commit/6112fdfea645e5924dc98ccab7b2dadee184d1bc))
* **frontend:** reduce font size of formulas in answer options ([20c4dd2](https://github.com/uzh-bf/klicker-uzh/commit/20c4dd29c0f59c575bccb3cd7ddf773098d08070))


### Enhancements

* **deploy:** add the aks storage class for ZRS and increase node count ([b30426a](https://github.com/uzh-bf/klicker-uzh/commit/b30426a4929e433175744c9d40927da5ed5ec1f6))
* **docs:** add better uptime announcement script ([610929b](https://github.com/uzh-bf/klicker-uzh/commit/610929b32909376d0cd3e269ad8a642072050490))

## [1.8.0-beta.5](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-beta.4...v1.8.0-beta.5) (2022-02-19)


### Bug Fixes

* **deploy:** ensure that next config is available in dockerfile ([efcbb02](https://github.com/uzh-bf/klicker-uzh/commit/efcbb02151cc8219fc6f47edaf9339edce7305fb))
* **frontend:** ensure that the SC option input does not lose focus after one char ([af3aa7a](https://github.com/uzh-bf/klicker-uzh/commit/af3aa7aa74d9c0f4f52ec95d4d5b2ff649cd9a31))

## [1.8.0-beta.4](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-beta.3...v1.8.0-beta.4) (2022-02-19)


### Bug Fixes

* **frontend:** use params.shortname on the join page ([86f4665](https://github.com/uzh-bf/klicker-uzh/commit/86f466521cdbd4a611334266a62dd2bde12526a4))

## [1.8.0-beta.3](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-beta.2...v1.8.0-beta.3) (2022-02-19)


### Other

* **frontend:** refactor code to allow for ESM imports ([#2715](https://github.com/uzh-bf/klicker-uzh/issues/2715)) ([8eada87](https://github.com/uzh-bf/klicker-uzh/commit/8eada870f80121363d26be5ce5f181e8282cbd5a))
* **frontend:** remove unused logging ([9661aff](https://github.com/uzh-bf/klicker-uzh/commit/9661aff2c5f3265a95e20a11d9750668e42e51c5))
* **frontend:** update docs links throughout frontend ([d03cb75](https://github.com/uzh-bf/klicker-uzh/commit/d03cb75cff0b793846f7bdeca2e5d0be2b0afdb0))

## [1.8.0-beta.2](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-beta.1...v1.8.0-beta.2) (2022-02-19)


### Enhancements

* **frontend:** add question preview to question edit modal ([0a9678f](https://github.com/uzh-bf/klicker-uzh/commit/0a9678f131f73010680bd018c92aeb67454d0204))
* **frontend:** render formulas in answer options ([ab5d41a](https://github.com/uzh-bf/klicker-uzh/commit/ab5d41aa4718b2cbd8d8d760fac8f5d9d06225ed))
* **frontend:** split buttons for inline and centered formulas ([e0d40e4](https://github.com/uzh-bf/klicker-uzh/commit/e0d40e4441dfb02176bf784f50c5c6fcaf0e8aa2))


### Other

* **db:** add migration script for 1.8 upgrade ([#2714](https://github.com/uzh-bf/klicker-uzh/issues/2714)) ([18ff160](https://github.com/uzh-bf/klicker-uzh/commit/18ff160018ec8e614f2234d007f4aaba9db4a2de))
* **frontend:** remove references to confusion flag ([ac9bc14](https://github.com/uzh-bf/klicker-uzh/commit/ac9bc14ad3f93208f6d702c36e9622f4e7984992))
* minor style fix after modifications of custom tooltips ([b8a1961](https://github.com/uzh-bf/klicker-uzh/commit/b8a196122d492f832cb14460e460f87a9685a5e5))
* remove cruft helmfile ([a827ff6](https://github.com/uzh-bf/klicker-uzh/commit/a827ff6fa5260623e139cdc702e82270743474a3))

## [1.8.0-beta.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.8.0-beta.0...v1.8.0-beta.1) (2022-02-18)


### Bug Fixes

* **frontend:** add params for useMarkdown ([a079372](https://github.com/uzh-bf/klicker-uzh/commit/a079372c489b9d29365585ab779a6be27f64ae1b))


### Other

* **deploy:** pin versions of faculties and prod deployments ([0b8a5ca](https://github.com/uzh-bf/klicker-uzh/commit/0b8a5ca29758eb756506d71a01daea4d02eceaec))

## [1.8.0-beta.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0...v1.8.0-beta.0) (2022-02-18)


### Features

* **deploy:** add azure deployment automations with pulumi ([#2712](https://github.com/uzh-bf/klicker-uzh/issues/2712)) ([2795e1e](https://github.com/uzh-bf/klicker-uzh/commit/2795e1e7285f37182f90d84707f47716e4ee5a57))
* **frontend:** new question content editor with formula capabilities ([#2707](https://github.com/uzh-bf/klicker-uzh/issues/2707)) ([bffb112](https://github.com/uzh-bf/klicker-uzh/commit/bffb1128cc2f030fa044c292bf96d40a9359c20d))


### Bug Fixes

* **docs:** disable ideal image plugin for now ([9b234c7](https://github.com/uzh-bf/klicker-uzh/commit/9b234c739bf8e2b81a4d63d1221843465e71752c))
* **frontend:** fixed session evaluation button disabling logic ([7532c79](https://github.com/uzh-bf/klicker-uzh/commit/7532c792c7025c69279ab2cbfb94470553e35e4d))
* **README:** update link to hero image ([90b8bed](https://github.com/uzh-bf/klicker-uzh/commit/90b8bedfae6d980f29bd20e6fdc1392b7d8418de))
* **README:** update link to KlickerUZH logo ([42e188e](https://github.com/uzh-bf/klicker-uzh/commit/42e188eba35360f001731a035460b0f1cefac837))


### Dependencies

* add turborepo ([6fc9075](https://github.com/uzh-bf/klicker-uzh/commit/6fc907573f254f326f0289aaf0e20025d91c07aa))


### Enhancements

* **docs:** add a use case for the confusion barometer ([#2668](https://github.com/uzh-bf/klicker-uzh/issues/2668)) ([9bb47a3](https://github.com/uzh-bf/klicker-uzh/commit/9bb47a32e2f735fd9bd5f4949965ce21d6796282))
* **docs:** add december 21 project update ([d1cdc17](https://github.com/uzh-bf/klicker-uzh/commit/d1cdc17f8e77ed62c71479b92210017cc54d1b4e))
* **docs:** add new audience interaction features to docs ([fbdc51b](https://github.com/uzh-bf/klicker-uzh/commit/fbdc51b0c451b068bcfa9819f9ec35e78ee868e3))
* **docs:** add remote teaching to QA use case ([13e05b4](https://github.com/uzh-bf/klicker-uzh/commit/13e05b4f019cbefa458d0439c35bdaab4324586a))
* **docs:** add use case listing to roadmap items ([5ffe677](https://github.com/uzh-bf/klicker-uzh/commit/5ffe6778ba8bd869d82996e98a64098d91fecbfd))
* **docs:** initial use case for q&a ([eaf27bb](https://github.com/uzh-bf/klicker-uzh/commit/eaf27bb541ed0acbf7a09e9521fa34161150fc3c))
* **docs:** migrate landing page into docusaurus documentation and new monorepo solution ([#2659](https://github.com/uzh-bf/klicker-uzh/issues/2659)) ([9275120](https://github.com/uzh-bf/klicker-uzh/commit/927512043e8b978c5874bb524eac5c5ff321e28b))
* **docs:** update use cases with feedbacks ([f7f431d](https://github.com/uzh-bf/klicker-uzh/commit/f7f431d7a9338e8f0ff860607df45177fd74faf0))
* **landing:** redirect /community to MS teams ([a39f7fa](https://github.com/uzh-bf/klicker-uzh/commit/a39f7fa5ded2e6ba70c012f9cdc1d1e2f025d484))


### Other

* create new stub dockerfiles ([004c7b8](https://github.com/uzh-bf/klicker-uzh/commit/004c7b87ed16261005882e0124c4d3e9fd54643a))
* **docs:** hide the implementation part ([4ef1bd4](https://github.com/uzh-bf/klicker-uzh/commit/4ef1bd43d98b319b6b81b94b123eac6c0bda4e75))
* **docs:** upgrade docusaurus and change port to 5000 ([0692cba](https://github.com/uzh-bf/klicker-uzh/commit/0692cbadcc8fdd46ba0d572c80167d1dc46e054b))
* **frontend:** migration of session list to tailwind css where possible ([eefe9fe](https://github.com/uzh-bf/klicker-uzh/commit/eefe9fedbc2adabf23970c490cb5c6cb4617ac3a))
* **frontend:** migration of several small components to tailwind css ([549cd48](https://github.com/uzh-bf/klicker-uzh/commit/549cd48ec6efcaff63b181a8304ebd724a742532))
* update docker configurations and monorepo setup ([#2710](https://github.com/uzh-bf/klicker-uzh/issues/2710)) ([1918191](https://github.com/uzh-bf/klicker-uzh/commit/1918191f491000bc5f1fc8bd20325ab78d47ab72))

## [1.7.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-rc.0...v1.7.0) (2021-12-07)


### Other

* **deploy:** update appVersion on faculties instance ([6d20824](https://github.com/uzh-bf/klicker-uzh/commit/6d2082462158f5c060994706047bbdf5c009e99c))

## [1.7.0-rc.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-beta.3...v1.7.0-rc.0) (2021-12-05)


### Bug Fixes

* **frontend:** also show confusionbarometer on evaluation page for a single feedback ([183d91e](https://github.com/uzh-bf/klicker-uzh/commit/183d91e00c483e9bd885243019f68116e6bf98b4))


### Enhancements

* add teams notifications on important events ([5f9675c](https://github.com/uzh-bf/klicker-uzh/commit/5f9675c0a2df72f85565245174d395458b9f1505))

## [1.7.0-beta.3](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-beta.2...v1.7.0-beta.3) (2021-12-04)


### Other

* **deploy:** ensure that prod and faculties are not deployed by default ([8f0cf24](https://github.com/uzh-bf/klicker-uzh/commit/8f0cf241c5a2bb9ef01d5a39d79f37404246ecb4))
* **docs:** pin node to 16 ([ae6119f](https://github.com/uzh-bf/klicker-uzh/commit/ae6119fda46799b44ab90eb7c8813217741a1b0a))


### Enhancements

* **frontend:** rework welcome page with tailwind and updated contents ([#2647](https://github.com/uzh-bf/klicker-uzh/issues/2647)) ([2701914](https://github.com/uzh-bf/klicker-uzh/commit/2701914999b4426b8f0856e2f2c41a556fa485c4))

## [1.7.0-beta.2](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-beta.1...v1.7.0-beta.2) (2021-12-02)


### Other

* **backend:** remove duplicated code for confusion aggregation ([f3b417f](https://github.com/uzh-bf/klicker-uzh/commit/f3b417f3679de36b81e98046729cb562a0a6aba6))
* **deploy:** don't install qa deployment by default ([9f47bc3](https://github.com/uzh-bf/klicker-uzh/commit/9f47bc3bc9f35295dbdc2fe1c01b01283d0ae734))
* **deploy:** fix faculties to 1 replica ([8a92c4b](https://github.com/uzh-bf/klicker-uzh/commit/8a92c4bfe158fc209883343b7078f13877dee3d8))
* **deploy:** tune resources based on monitoring ([9184260](https://github.com/uzh-bf/klicker-uzh/commit/918426001837a3304bf8747f8186c01d0630e8b3))


### Enhancements

* **deploy:** add vertical pod autoscaler and enable instead of HPA ([cf702e8](https://github.com/uzh-bf/klicker-uzh/commit/cf702e8b0b5bc48f91b26f87fa3ea53eba3c8424))
* **frontend:** improve layout of running session page ([#2637](https://github.com/uzh-bf/klicker-uzh/issues/2637)) ([4e003a5](https://github.com/uzh-bf/klicker-uzh/commit/4e003a5267a04794220bd3fbe9d97446f48fe4db))
* **landing:** update page for betteruptime integration ([df82aa1](https://github.com/uzh-bf/klicker-uzh/commit/df82aa186795cb2666efce79b7f5058c48f9e0b7))

## [1.7.0-beta.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-beta.0...v1.7.0-beta.1) (2021-11-30)


### Bug Fixes

* **frontend:** ensure that the survey dismiss icon is always visible and that the banner is not shown in creation mode ([e0cac4f](https://github.com/uzh-bf/klicker-uzh/commit/e0cac4fabd4491f60b45badd85e3218ab259d322))


### Enhancements

* **deploy:** add priority classes to redis ([fc6d151](https://github.com/uzh-bf/klicker-uzh/commit/fc6d1512c3151fdb59ac5b3cf800db50e35a363c))
* **frontend:** put open feedbacks on top of resolved ([b62f02f](https://github.com/uzh-bf/klicker-uzh/commit/b62f02f092f40b82503387155ae9edfac203cd9f))

## [1.7.0-beta.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-alpha.7...v1.7.0-beta.0) (2021-11-28)


### Bug Fixes

* **frontend:** replace invalid tailwind color for top-border on lecturer cockpit ([cf51d5f](https://github.com/uzh-bf/klicker-uzh/commit/cf51d5f36c523c8d9797ee7db17ea1b111ba6472))


### Enhancements

* **deploy:** add deployment strategies and priority classes ([1f72e47](https://github.com/uzh-bf/klicker-uzh/commit/1f72e4788453396399665aaf0c33d9dfc4dcd026))

## [1.7.0-alpha.7](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-alpha.6...v1.7.0-alpha.7) (2021-11-28)


### Other

* **ci:** add chart releaser action ([fccc09c](https://github.com/uzh-bf/klicker-uzh/commit/fccc09c2c9b61b387c1c4dd99e4640b10e7c7649))
* **deploy:** move chart into subdirectory of charts dir ([f52cb55](https://github.com/uzh-bf/klicker-uzh/commit/f52cb55e8396a4b714d71102cdee5df75cf7155e))
* remove cruft nvmrc ([0a11bf1](https://github.com/uzh-bf/klicker-uzh/commit/0a11bf193aaa6352f92bb00485a6bda2f4163b41))


### Enhancements

* chatwoot only on selected pages and with custom base url ([4b57e26](https://github.com/uzh-bf/klicker-uzh/commit/4b57e266e381b6583c4907b1e5b8c912bc81e056))

## [1.7.0-alpha.6](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-alpha.5...v1.7.0-alpha.6) (2021-11-28)


### Bug Fixes

* **backend:** corrected range of output values for real-time confusion barometer ([b9e4fbf](https://github.com/uzh-bf/klicker-uzh/commit/b9e4fbf13cc9e2d37a1ee4bb092208d94ee01a95))
* **frontend:** feedback field on student view only shrinks if empty ([7bc5b99](https://github.com/uzh-bf/klicker-uzh/commit/7bc5b99870b1e12b2c24bb1196f7c1a52a3bb5f2))
* **frontend:** layout shift on login page on AAI login ([278ff97](https://github.com/uzh-bf/klicker-uzh/commit/278ff97ede349a6d20e0bbf4371805be74364d87))


### Enhancements

* add confusion data with color bar on lecturer cockpit screen ([#2640](https://github.com/uzh-bf/klicker-uzh/issues/2640)) ([d560c80](https://github.com/uzh-bf/klicker-uzh/commit/d560c80a1b17049665cca0ee2064eab21b6d8b2a))
* display aggregated confusionBarometer data on evaluation page ([#2631](https://github.com/uzh-bf/klicker-uzh/issues/2631)) ([4132260](https://github.com/uzh-bf/klicker-uzh/commit/4132260fc693ca2b92711013e8892fbf8bc6789c))
* indicate number of feedbacks on lecturer confusion barometer ([a21e5af](https://github.com/uzh-bf/klicker-uzh/commit/a21e5af42a4bee205820a10d1a0fb60419794f9c))


### Other

* **deploy:** add saskia to persisted users ([bbbb19c](https://github.com/uzh-bf/klicker-uzh/commit/bbbb19cba0294ee300728b6638073ec44d84b5b2))
* **deploy:** move persistedUsers to secret ([e8a3838](https://github.com/uzh-bf/klicker-uzh/commit/e8a38382130a4dc07b5951eaf1fd462f82ee4223))
* **deploy:** update deployment settings with specific kube context ([c115f09](https://github.com/uzh-bf/klicker-uzh/commit/c115f0946b1ed25aef14d218d2f38e36644b7919))
* **deps:** small upgrade of next deps ([9b209ae](https://github.com/uzh-bf/klicker-uzh/commit/9b209ae438e521ece827fed277122e0580a3da35))
* **frontend:** add chatwoot token ([0b12e6e](https://github.com/uzh-bf/klicker-uzh/commit/0b12e6e00daab1fa161b4c82ab3f89dc10b3057c))

## [1.7.0-alpha.5](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-alpha.4...v1.7.0-alpha.5) (2021-11-16)


### Enhancements

* add random selection of questions within a block for experimental polling ([#2622](https://github.com/uzh-bf/klicker-uzh/issues/2622)) ([005c952](https://github.com/uzh-bf/klicker-uzh/commit/005c9526837aff8097382ed57ad68d7a0426eae9))

## [1.7.0-alpha.4](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-alpha.3...v1.7.0-alpha.4) (2021-11-16)


### Enhancements

* **frontend:** add alternative confusion input with a 5-point slider ([#2629](https://github.com/uzh-bf/klicker-uzh/issues/2629)) ([f27ef82](https://github.com/uzh-bf/klicker-uzh/commit/f27ef820a3e4e6d739a00560fda07313f81d7523))

## [1.7.0-alpha.3](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-alpha.2...v1.7.0-alpha.3) (2021-11-16)


### Bug Fixes

* **frontend:** ensure that words break naturally and that there is no max-width on join ([560681c](https://github.com/uzh-bf/klicker-uzh/commit/560681ca29a59b76db7e0d8b2c4314dc1aaab24b))

## [1.7.0-alpha.2](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-alpha.1...v1.7.0-alpha.2) (2021-11-16)


### Bug Fixes

* **frontend:** ensure that storedResponses do not break the join screen ([848c07e](https://github.com/uzh-bf/klicker-uzh/commit/848c07ee8aceac000c976b17a63f2c933a4f333c))


### Other

* add happo config ([751e6ca](https://github.com/uzh-bf/klicker-uzh/commit/751e6ca393ef5116124f872e2c82b98c7e815de1))
* **deploy:** add new instance ([f76a35d](https://github.com/uzh-bf/klicker-uzh/commit/f76a35da374cdce8cb18b57bc7b0141b4f319f91))

## [1.7.0-alpha.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.7.0-alpha.0...v1.7.0-alpha.1) (2021-11-14)


### Bug Fixes

* **backend:** return feedbacks for Q&A in the same sort order as expected ([64696ce](https://github.com/uzh-bf/klicker-uzh/commit/64696cea684c86681d37136a0612a7417253ad41))
* **frontend:** improve sorting of feedbacks on join session ([34aa30b](https://github.com/uzh-bf/klicker-uzh/commit/34aa30b2069537008cbfb7dc3aa38c95f31edaeb))
* **frontend:** reverse sorting of resolved feedbacks ([dd9f59b](https://github.com/uzh-bf/klicker-uzh/commit/dd9f59b294d1659d64e3401b6e3db25b77b67b08))


### Other

* **frontend:** push web vitals ([9328608](https://github.com/uzh-bf/klicker-uzh/commit/9328608315318dabc91abdc30e1afad4c2cfecac))
* **frontend:** reverse order of route path and web vital name ([8d222c7](https://github.com/uzh-bf/klicker-uzh/commit/8d222c7d6bdbed962f07111cfe6955fb1cad7dd4))

## [1.7.0-alpha.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.25...v1.7.0-alpha.0) (2021-11-14)


### Features

* **frontend:** reintroduce confusion barometer ([#2619](https://github.com/uzh-bf/klicker-uzh/issues/2619)) ([040881b](https://github.com/uzh-bf/klicker-uzh/commit/040881bc5bfd11ac70681bf90435d12974cedbd1))

### [1.6.3-alpha.25](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.24...v1.6.3-alpha.25) (2021-11-12)


### Bug Fixes

* **deploy:** ensure that shib service is deployed on klicker-prod ([e4e3cbd](https://github.com/uzh-bf/klicker-uzh/commit/e4e3cbd7e81ca866ce368a5e80198334dbe5eaaa))
* **frontend:** add try/catch in SSR of join page ([7ea1b8d](https://github.com/uzh-bf/klicker-uzh/commit/7ea1b8d8cf59cf436554d2d251d9dcd1ccfa434e))

### [1.6.3-alpha.24](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.23...v1.6.3-alpha.24) (2021-11-12)


### Bug Fixes

* **frontend:** both student view parts visible when starting on mobile feedback view and expanding window size ([02bdc09](https://github.com/uzh-bf/klicker-uzh/commit/02bdc09c66935ef119e07a5fcb8e8bdf2d07ff61))
* **frontend:** fixed feedback ordering on student view ([6d6902d](https://github.com/uzh-bf/klicker-uzh/commit/6d6902d63abe1f65e7c5b81adcdc80e17c1e0f14))
* typo in docker compose file ([953bc12](https://github.com/uzh-bf/klicker-uzh/commit/953bc1259c569ec513f4df8a6a2eb151ee484678))


### Other

* add question pool image to README ([1a8c958](https://github.com/uzh-bf/klicker-uzh/commit/1a8c958717aa3d9ac03a784b4e764e1f706ff049))
* **frontend:** add links and mentions of our active surveys ([#2625](https://github.com/uzh-bf/klicker-uzh/issues/2625)) ([4bf67a0](https://github.com/uzh-bf/klicker-uzh/commit/4bf67a06aebe7e8d2fcac4f07144f822944383fc))
* **frontend:** convert studentView to tailwind ([aa0d15e](https://github.com/uzh-bf/klicker-uzh/commit/aa0d15e169876654c3e0299f38881e2cf77be70a))
* **landing:** add scaled question pool image ([2d1e007](https://github.com/uzh-bf/klicker-uzh/commit/2d1e007321777a0eb8038d1ba21b23d96b59193a))
* **README:** use scaled question pool image ([732143a](https://github.com/uzh-bf/klicker-uzh/commit/732143a247f08475064aba1fee6e915b53673fc5))

### [1.6.3-alpha.23](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.22...v1.6.3-alpha.23) (2021-11-07)


### Other

* **deploy:** add BW to persisted users ([61c4c80](https://github.com/uzh-bf/klicker-uzh/commit/61c4c80a9195f2aad7c13bab5f58fd5762ad3f89))
* **deploy:** make GA optional and update resources ([e2cb019](https://github.com/uzh-bf/klicker-uzh/commit/e2cb019e42a2fb23898c16fca64d07d28ca4cfde))
* **deps:** upgrade node -> 16 and bump minor package versions ([#2620](https://github.com/uzh-bf/klicker-uzh/issues/2620)) ([41d784a](https://github.com/uzh-bf/klicker-uzh/commit/41d784a785a0cf75e99b0452861272e37cecb981))

### [1.6.3-alpha.22](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.21...v1.6.3-alpha.22) (2021-11-05)


### Bug Fixes

* move joinLink to serverRuntimeConfig ([a37ca95](https://github.com/uzh-bf/klicker-uzh/commit/a37ca95cebd0a9c779167bbda988da61230a4352))

### [1.6.3-alpha.21](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.20...v1.6.3-alpha.21) (2021-11-05)


### Enhancements

* **frontend:** added tabular question view ([#2618](https://github.com/uzh-bf/klicker-uzh/issues/2618)) ([e4d2e99](https://github.com/uzh-bf/klicker-uzh/commit/e4d2e9956067383e958cbbffed4955a4923ee8df))


### Other

* **deploy:** add julius.schlapbach@bf.uzh.ch to persisted users ([b5c10c4](https://github.com/uzh-bf/klicker-uzh/commit/b5c10c4212ee06a9c518a59f0f2da0fca3bd9ea0))
* **deploy:** update autoscaling settings ([f2f9101](https://github.com/uzh-bf/klicker-uzh/commit/f2f9101928dab0e294a06a228f441bd863c84ac4))
* **frontend:** add missing .env keys to template ([357794c](https://github.com/uzh-bf/klicker-uzh/commit/357794c866ab2b2bcd3f3feffabe016a6d9e35cc))

### [1.6.3-alpha.20](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.19...v1.6.3-alpha.20) (2021-11-04)


### Other

* add data axtraction script for feedback channel usage analysis ([738216a](https://github.com/uzh-bf/klicker-uzh/commit/738216a637b02a918952b21b30ce8a77a61edcba))
* **frontend:** ensure that question skipped is not logged when a response is added ([3619264](https://github.com/uzh-bf/klicker-uzh/commit/3619264245ab34f2fe8f81ba1a7095bde7c9f382))

### [1.6.3-alpha.19](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.18...v1.6.3-alpha.19) (2021-11-03)


### Enhancements

* **frontend:** incorporate matomo events for improved observability ([#2616](https://github.com/uzh-bf/klicker-uzh/issues/2616)) ([2317818](https://github.com/uzh-bf/klicker-uzh/commit/2317818e5844fd8307459dce9f65cf32ebb009b8))

### [1.6.3-alpha.18](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.17...v1.6.3-alpha.18) (2021-11-03)


### Other

* remove useLogging and other analytics cruft ([af36505](https://github.com/uzh-bf/klicker-uzh/commit/af365051c8b5f309e73302927bf88cfdb04839d2))


### Enhancements

* incorporate matomo for site analytics ([f6112d2](https://github.com/uzh-bf/klicker-uzh/commit/f6112d23589a5b43e2716584d463cbfacd4894e5))

### [1.6.3-alpha.17](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.16...v1.6.3-alpha.17) (2021-11-03)


### Bug Fixes

* use a links to redirect from the index page ([5785a06](https://github.com/uzh-bf/klicker-uzh/commit/5785a066a237f052dd3e68790391e1453257029a))

### [1.6.3-alpha.16](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.15...v1.6.3-alpha.16) (2021-11-03)


### Bug Fixes

* ensure unauthenticated pages are excluded ([447088e](https://github.com/uzh-bf/klicker-uzh/commit/447088e67ecaabda489745fbd66070cd2fc9fbac))


### Other

* **deploy:** increase resources ([51d3391](https://github.com/uzh-bf/klicker-uzh/commit/51d3391afc627af4cb415d504d730f26647d4742))

### [1.6.3-alpha.15](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.14...v1.6.3-alpha.15) (2021-11-03)


### Bug Fixes

* ensure that people are not redirected from login due to spurious UNAUTHORIZED errors ([c6afa6e](https://github.com/uzh-bf/klicker-uzh/commit/c6afa6ec25324ba3b6d1811359f9305e733f0ea2))


### Other

* **deploy:** upgrade to GA4 ([899c927](https://github.com/uzh-bf/klicker-uzh/commit/899c9273542b276786c5b5a56ec87018adafe16f))

### [1.6.3-alpha.14](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.13...v1.6.3-alpha.14) (2021-11-01)


### Bug Fixes

* **frontend:** use publicRuntimeConfig instead of NEXT_PUBLIC envs and ensure pages are not static ([1142e46](https://github.com/uzh-bf/klicker-uzh/commit/1142e46bfd941ea131484180cc336ad011028244))

### [1.6.3-alpha.13](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.12...v1.6.3-alpha.13) (2021-11-01)


### Refactors

* **frontend:** move to the new apollo example with a user context in _app ([#2609](https://github.com/uzh-bf/klicker-uzh/issues/2609)) ([e4ba7f6](https://github.com/uzh-bf/klicker-uzh/commit/e4ba7f6ec1f3b001abf54180119e09797d2654e1))


### Other

* **frontend:** lockfile maintenance ([aa1400c](https://github.com/uzh-bf/klicker-uzh/commit/aa1400c6e2df4941f7b2e62cb66c9ba70b2ddcda))


### Enhancements

* **frontend:** use static generation capabilities and apply feature flags conditionally ([#2611](https://github.com/uzh-bf/klicker-uzh/issues/2611)) ([acb2b18](https://github.com/uzh-bf/klicker-uzh/commit/acb2b18838f49d81352b11141003fac129b242a1))

### [1.6.3-alpha.12](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.11...v1.6.3-alpha.12) (2021-11-01)


### Other

* **ci:** disable docker container build on dev pushes ([1093446](https://github.com/uzh-bf/klicker-uzh/commit/1093446f7b707d92ef923661883e16aaa5f5a7a9))


### Refactors

* **frontend:** move user info to a context on the TeacherLayout ([873eeb1](https://github.com/uzh-bf/klicker-uzh/commit/873eeb13e0b5dc447d554028feb8bf4e7ea0c9bb))

### [1.6.3-alpha.11](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.10...v1.6.3-alpha.11) (2021-11-01)


### Bug Fixes

* **frontend:** try happykit config with publicRuntimeConfig ([e509c27](https://github.com/uzh-bf/klicker-uzh/commit/e509c27e632d6e034c0b242d696362b55b668506))

### [1.6.3-alpha.10](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.9...v1.6.3-alpha.10) (2021-11-01)


### Refactors

* **frontend:** ensure that happykit is initialized before using it ([bdbe18d](https://github.com/uzh-bf/klicker-uzh/commit/bdbe18d88e6954476d8054d34f5dab4f3f2206bb))

### [1.6.3-alpha.9](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.8...v1.6.3-alpha.9) (2021-11-01)


### Bug Fixes

* **backend:** ensure feedbacks have a resolvedAt property ([2e9b7ad](https://github.com/uzh-bf/klicker-uzh/commit/2e9b7ad2a02ce2dd01b8a076f79e759e03dcf1a3))
* **backend:** ensure resolvedAt is also returned in the respondToFeedback subscription ([59eaddd](https://github.com/uzh-bf/klicker-uzh/commit/59eaddd96283dc3a4b3fd54393294914079f4569))


### Enhancements

* **frontend:** add translations for missing strings on feedback area and switch sorting of resolved questions ([31c7149](https://github.com/uzh-bf/klicker-uzh/commit/31c71495dec085c270b98e50b9eb04d044116b0e))

### [1.6.3-alpha.8](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.7...v1.6.3-alpha.8) (2021-11-01)


### Bug Fixes

* **frontend:** make the happykit flags integration conditional on the variable ([0b158ed](https://github.com/uzh-bf/klicker-uzh/commit/0b158ed52e81b95b2a30db60f3d124beb6ee802e))
* update happykit flag integration ([0ddf6e5](https://github.com/uzh-bf/klicker-uzh/commit/0ddf6e5ad48c71d66288b81695b6de9a0524ea1c))


### Dependencies

* **frontend:** upgrade next to latest patch release ([304a206](https://github.com/uzh-bf/klicker-uzh/commit/304a20619587768514e888ae3f084a0d720b14e6))


### Enhancements

* **frontend:** make the question title clickable ([a6fa181](https://github.com/uzh-bf/klicker-uzh/commit/a6fa1813d558afbc0d0c12cd556aa1dcc71608e9))

### [1.6.3-alpha.7](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.6...v1.6.3-alpha.7) (2021-11-01)


### Other

* **deploy:** adapt autoscaling and replica settings ([5876c14](https://github.com/uzh-bf/klicker-uzh/commit/5876c1409c2da7deaa0b11f6c9ffaac022d4ab11))
* **deploy:** adapt resource quota based on initial monitoring ([071b9b0](https://github.com/uzh-bf/klicker-uzh/commit/071b9b0d6e70b5f8970ed788177b0febb379ef38))


### Enhancements

* **frontend:** integrate feature flags with happykit ([#2605](https://github.com/uzh-bf/klicker-uzh/issues/2605)) ([7c313ef](https://github.com/uzh-bf/klicker-uzh/commit/7c313eff8c8d1dff2fe0add582056f347006e2c6))

### [1.6.3-alpha.6](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.5...v1.6.3-alpha.6) (2021-11-01)


### Other

* ensure that yaml updater changes appVersion ([4b937a6](https://github.com/uzh-bf/klicker-uzh/commit/4b937a6295781b030d365f7eec008450992630d9))

### [1.6.3-alpha.5](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.4...v1.6.3-alpha.5) (2021-11-01)


### Bug Fixes

* **frontend:** replace svg logo with png version ([d541829](https://github.com/uzh-bf/klicker-uzh/commit/d541829c0a2d6c274e7301487b9e2534aaa4fe9f))


### Other

* **deploy:** bump appVersion to v1.6.3-alpha.4 ([268cb76](https://github.com/uzh-bf/klicker-uzh/commit/268cb76e51ddcd3d3acb92a2b61027b5d8da16a5))
* setup custom yaml updater and ensure docs versioning is updated as well ([0d3232c](https://github.com/uzh-bf/klicker-uzh/commit/0d3232c32fb954579222065d08d53a1013061b57))

### [1.6.3-alpha.4](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.3...v1.6.3-alpha.4) (2021-10-31)


### Features

* **frontend:** notification badges for new activated questions and new feedbacks on mobile menu ([#2596](https://github.com/uzh-bf/klicker-uzh/issues/2596)) ([754a70e](https://github.com/uzh-bf/klicker-uzh/commit/754a70e666a0019d7b15d84c1dc6cb78404f535f))


### Other

* **deploy:** bump appVersion to v1.6.3-alpha.3 ([45226cc](https://github.com/uzh-bf/klicker-uzh/commit/45226ccf4b76059a6f6077e620c08b366c667bc3))


### Enhancements

* **frontend:** browser notifications for incoming feedbacks (lecturer) and questions (student) ([#2590](https://github.com/uzh-bf/klicker-uzh/issues/2590)) ([6dba614](https://github.com/uzh-bf/klicker-uzh/commit/6dba614052da4d257f0bedeeccada7be4e1b0201))

### [1.6.3-alpha.3](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.2...v1.6.3-alpha.3) (2021-10-31)


### Bug Fixes

* **frontend:** ensure that images config does not break build ([322d717](https://github.com/uzh-bf/klicker-uzh/commit/322d717504536ae539966b56145a01d470e8b4d8))

### [1.6.3-alpha.2](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.1...v1.6.3-alpha.2) (2021-10-31)


### Bug Fixes

* **frontend:** ensure that the images config is only used in a server setting ([fe14616](https://github.com/uzh-bf/klicker-uzh/commit/fe14616c89e6cb2b282ac94eb59f3c7785d56f4d))

### [1.6.3-alpha.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.3-alpha.0...v1.6.3-alpha.1) (2021-10-31)


### Bug Fixes

* **docs:** ensure that docs root directory reroutes correctly ([610588f](https://github.com/uzh-bf/klicker-uzh/commit/610588feba721acb3f30ad6c432b0a916a954c2e))
* **docs:** update link on blog post to new release notes on feedbear ([b618d3c](https://github.com/uzh-bf/klicker-uzh/commit/b618d3c69ddb1db90e132a05cd1da860425b96e6))
* **frontend:** disable the session creation button in the sidebar if the question pool is active ([c0632c6](https://github.com/uzh-bf/klicker-uzh/commit/c0632c66486ccf9836ca220d27e7aa266b399dae))
* **frontend:** rework table chart sorting to custom implementation ([c66b57f](https://github.com/uzh-bf/klicker-uzh/commit/c66b57f9ee4d5364336f1989860fcd3b4585c8a9))
* **frontend:** use next/link for the support entry outgoing links ([822c21f](https://github.com/uzh-bf/klicker-uzh/commit/822c21fbf63b5d6623701c81b9ff6908500c48f4))


### Dependencies

* **frontend:** upgrade minor dependencies and nextjs ([c1bb22d](https://github.com/uzh-bf/klicker-uzh/commit/c1bb22d2cb2cec4c2b760a02ee74c3b44effd7e9))


### Enhancements

* **frontend:** add qr logo to popup on session cockpit ([eba406d](https://github.com/uzh-bf/klicker-uzh/commit/eba406d88201bb84f32e378e53129ba3c30bda43))
* **frontend:** apply next/image to the preview images on the student view ([ad64548](https://github.com/uzh-bf/klicker-uzh/commit/ad6454823d61fa3dc8245f5531f3aca4d3d888dd))
* **frontend:** replace qrcode.react with react-qrcode-logo ([752c409](https://github.com/uzh-bf/klicker-uzh/commit/752c409e58b3b1814be450e439230b2535043a36))
* **frontend:** rework the support modal with more information and links to the feedbear page ([33ad401](https://github.com/uzh-bf/klicker-uzh/commit/33ad401181f3d58e8ee5afc09aa8f96b3494eba1))
* **frontend:** update the logo in the sidebar ([53feae0](https://github.com/uzh-bf/klicker-uzh/commit/53feae02c9122d57e103d55c59c3d0e41eea9f06))


### Other

* add volta pin for node 14.18 ([058d936](https://github.com/uzh-bf/klicker-uzh/commit/058d936b5fb3346ac76834f89515f96cd6bb1a4f))
* **deploy:** ensure that appVersion is prefixed with a v ([d6bd4b6](https://github.com/uzh-bf/klicker-uzh/commit/d6bd4b602abca136ec85ffde1eb5e6e273c17997))
* **deploy:** logrocket toggle ([d27721b](https://github.com/uzh-bf/klicker-uzh/commit/d27721b21aeb1e1f1362f4f941662cdb7d280c79))
* **docs:** pin node version with volta ([b01758d](https://github.com/uzh-bf/klicker-uzh/commit/b01758d937214f18bb09c7912f037399d46e9e2c))
* **docs:** remove the release notes and add a link to the feedbear release notes page ([722c491](https://github.com/uzh-bf/klicker-uzh/commit/722c491c292a5176d22bfdbf5131bde544954fff))
* **frontend:** restructure frontend so server is located in src ([4d03957](https://github.com/uzh-bf/klicker-uzh/commit/4d03957f4b61e080a7e4e6220bca37d94cf81def))
* pin node to 14.18 across services ([c2f9389](https://github.com/uzh-bf/klicker-uzh/commit/c2f938995ea1b668e792654ff611f3bf942f96ac))
* pin the npm version with volta ([497248e](https://github.com/uzh-bf/klicker-uzh/commit/497248e6ff66760d46b8bf2eb037a2b2af9f2561))
* **README:** add klicker logo to readme and extend text for auxiliary components ([7dc9e58](https://github.com/uzh-bf/klicker-uzh/commit/7dc9e581a0afadf5d4ca4ef9009ba62cf5bda0fb))
* **README:** fix link to landing subfolder ([65edcef](https://github.com/uzh-bf/klicker-uzh/commit/65edcef089a4a62678ab9dc54717032f11c6c663))
* **README:** fix links to docs, landing, and deployment subfolders ([dc3efc6](https://github.com/uzh-bf/klicker-uzh/commit/dc3efc62ac0bc904b07c3e3ab5044bc61a8a52e0))
* **README:** remove the markdown header ([b559893](https://github.com/uzh-bf/klicker-uzh/commit/b5598937778865af7c097100a8941d29231070cd))
* remove cruft README files in subfolders ([fbabfd0](https://github.com/uzh-bf/klicker-uzh/commit/fbabfd08f2b58361995a1772a39e3afbe57eac28))
* update .htaccess files for landing and docs ([a9c7241](https://github.com/uzh-bf/klicker-uzh/commit/a9c7241e599014b967a4eab399ed927e9785a818))

### [1.6.3-alpha.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.2...v1.6.3-alpha.0) (2021-10-25)


### Bug Fixes

* **docs:** ensure that logo links to getting started ([b0c75f5](https://github.com/uzh-bf/klicker-uzh/commit/b0c75f5592605ed253f79e9cf96826b469c78f33))
* **docs:** update slug of getting started ([a2bd289](https://github.com/uzh-bf/klicker-uzh/commit/a2bd289b68c03c4dfe2078462d26b503cbc6cb66))
* **docs:** use getting started when linking to docs ([d89d8ff](https://github.com/uzh-bf/klicker-uzh/commit/d89d8ff42bc0863b3d0987090f17ceaa3fd9dca4))
* **landing:** don't use next/image as we export the page ([03694a8](https://github.com/uzh-bf/klicker-uzh/commit/03694a88bb7aa0f2c1a4c5826809ed7bad0dee12))


### Dependencies

* **docs:** upgrade docusaurus ([9e15df8](https://github.com/uzh-bf/klicker-uzh/commit/9e15df8c3eebe1786f30e54db0a01c8760a2249c))


### Enhancements

* **docs:** ensure that primary color matches uzh red ([00cd39b](https://github.com/uzh-bf/klicker-uzh/commit/00cd39bf90fa28f7d2dad4eb92333a755fe044a3))
* **docs:** update ordering in top menu ([0ffa3ff](https://github.com/uzh-bf/klicker-uzh/commit/0ffa3ff3b81e643ce39f62a1570bc8dfd4b73155))
* **docs:** use logo with transparent background ([cd9a7c8](https://github.com/uzh-bf/klicker-uzh/commit/cd9a7c8a865bb0c54f7422935d7843568e940b67))
* **landing:** use klicker logo across landing page and update docs links ([54b2f6d](https://github.com/uzh-bf/klicker-uzh/commit/54b2f6d75bc75fd9cb1443c5bcd3415e1e14ae0b))


### Other

* **deploy:** bump appVersion ([1664390](https://github.com/uzh-bf/klicker-uzh/commit/1664390d6271e27aed7fd4a1f676009cb4755ebd))
* **deploy:** bump appVersion to 1.6.3-alpha.0 ([5f75f2f](https://github.com/uzh-bf/klicker-uzh/commit/5f75f2f8d5c9897e1dc6e24a301bd54dd7fbf148))
* **docs:** add bottom border in uzh orange ([0d7ef9f](https://github.com/uzh-bf/klicker-uzh/commit/0d7ef9fb6dda1b332eae540fda8f2c70a7cfaf54))
* **docs:** add initial project update to blog ([2005c9e](https://github.com/uzh-bf/klicker-uzh/commit/2005c9e4406db0eea4a223e9dea9b89c8a560163))
* **landing:** add orange bottom border on landing page ([54feecb](https://github.com/uzh-bf/klicker-uzh/commit/54feecb9e1acf2dc618d48fbb5914c11869a5afa))
* update docs links across entire app and READMEs ([0bcba26](https://github.com/uzh-bf/klicker-uzh/commit/0bcba26257dae41e638e4a53829a903a1898909b))

### [1.6.2](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.2-rc.3...v1.6.2) (2021-10-21)

### [1.6.2-rc.3](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.2-rc.2...v1.6.2-rc.3) (2021-10-20)


### Features

* **frontend:** introduce diffing for question editing state ([#2585](https://github.com/uzh-bf/klicker-uzh/issues/2585)) ([b634be4](https://github.com/uzh-bf/klicker-uzh/commit/b634be494bc3925168bbaa8acb976987ebc94f22))


### Refactors

* **frontend:** replace react-d3-cloud with react-tagcloud ([0fe0168](https://github.com/uzh-bf/klicker-uzh/commit/0fe0168e5b5148bfca5cb6562fe9be0d9ff0f22c))


### Enhancements

* **docs:** Rework documentation for Docusaurus 2 ([#2572](https://github.com/uzh-bf/klicker-uzh/issues/2572)) ([2f4b3dc](https://github.com/uzh-bf/klicker-uzh/commit/2f4b3dcc4eec504ba65340d61e07a847be495870))
* **frontend:** rework tooltips to use only semantic-ui popups ([#2577](https://github.com/uzh-bf/klicker-uzh/issues/2577)) ([0e61559](https://github.com/uzh-bf/klicker-uzh/commit/0e61559cf2ca2f0861270273d35117519e4e6d45))


### Other

* **ci:** add codeql to repository ([8118268](https://github.com/uzh-bf/klicker-uzh/commit/8118268f36f84de76a0858f0b3a566d0c0d7dfe4))
* create a dependabot config file ([65c5a03](https://github.com/uzh-bf/klicker-uzh/commit/65c5a0398036f922dca2b88a40ab8b51990208e1))
* **deploy:** bump appVersion ([5ec24ec](https://github.com/uzh-bf/klicker-uzh/commit/5ec24ece89d54e0e7ebbb506e3c02b842e9c44b6))
* **deploy:** bump appVersion ([39cfda9](https://github.com/uzh-bf/klicker-uzh/commit/39cfda9cfadb963ac4997469f3bd981c22907fc1))
* **docs:** remove cruft websiteV1 ([ae7e3c5](https://github.com/uzh-bf/klicker-uzh/commit/ae7e3c5e0497ab9c4527b7a847ded4b5c2a6e2f7))

### [1.6.2-rc.2](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.2-rc.1...v1.6.2-rc.2) (2021-10-08)


### Bug Fixes

* **docs:** update link to roadmap ([6711114](https://github.com/uzh-bf/klicker-uzh/commit/67111146ed04aafdfeaf820afa7dc616894ca810))
* **frontend:** versioning of questions ([0ffd292](https://github.com/uzh-bf/klicker-uzh/commit/0ffd292571ab33582aad2ccc5776dc097899726e))


### Other

* **backend:** update email credentials for local instance ([e1af305](https://github.com/uzh-bf/klicker-uzh/commit/e1af3054d46dd4b7f0169d11c5d881fc2d2430ca))


### Enhancements

* add subscriptions for unpublishing feedback and deletion of feedback responses ([#2553](https://github.com/uzh-bf/klicker-uzh/issues/2553)) ([61391f7](https://github.com/uzh-bf/klicker-uzh/commit/61391f771e614dc7402dd4c4027987731a6e44fd))
* **deploy:** use minio initialization service across compose files ([026e16c](https://github.com/uzh-bf/klicker-uzh/commit/026e16cb7e2c478e4eba4543ce134149ba7c372c))
* **deploy:** use unless-stopped to prevent restarting services unnecessarily ([72cff46](https://github.com/uzh-bf/klicker-uzh/commit/72cff46be75b51c6dfde42e7a5bdb43f87a0d654))

### [1.6.2-rc.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.2-rc.0...v1.6.2-rc.1) (2021-10-07)


### Other

* improve consistency of package meta files ([76de246](https://github.com/uzh-bf/klicker-uzh/commit/76de246d907e7bc8449bdf35976e184d37fe8a58))

### [1.6.2-rc.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.2-beta.3...v1.6.2-rc.0) (2021-10-07)


### Bug Fixes

* **landing:** ensure that links to roadmap and repository are valid ([#2551](https://github.com/uzh-bf/klicker-uzh/issues/2551)) ([4192fa2](https://github.com/uzh-bf/klicker-uzh/commit/4192fa2dbd6b63dde92f21301cbfa7c49919cf3d))


### Other

* **deploy:** update appVersion ([486fcf5](https://github.com/uzh-bf/klicker-uzh/commit/486fcf59697a18062a08e3ee4c0730557e14b250))
* **frontend:** ensure that sentry config is in JS files ([07c1191](https://github.com/uzh-bf/klicker-uzh/commit/07c11918ae50ced2e50bab6834dfac1ee3da9dc3))
* **frontend:** update default CSP rules ([aab46d8](https://github.com/uzh-bf/klicker-uzh/commit/aab46d8f1e3d81dee8d021bf0e384a333f42a32a))

### [1.6.2-beta.3](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.2-beta.2...v1.6.2-beta.3) (2021-10-07)


### Bug Fixes

* **deploy:** ensure that the shibboleth service is packaged in the shib image ([456c8e8](https://github.com/uzh-bf/klicker-uzh/commit/456c8e8f0c8fe7795d57d5d4b22a34e58ee8b16c))


### Other

* **deploy:** bump appVersion ([0509f53](https://github.com/uzh-bf/klicker-uzh/commit/0509f53343d29a3d89b1724c8c81e9abf0b3ead6))

### [1.6.2-beta.2](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.2-beta.1...v1.6.2-beta.2) (2021-10-07)


### Features

* **deploy:** add helm entities for shibboleth service ([68c291f](https://github.com/uzh-bf/klicker-uzh/commit/68c291fde671e26b74022602eb61c3afd6263408))


### Bug Fixes

* Add image name ([e2ed6f2](https://github.com/uzh-bf/klicker-uzh/commit/e2ed6f25d193cf61af341412cf7b8cd4d3458410))
* add the USER role if people login using AAI ([54231bf](https://github.com/uzh-bf/klicker-uzh/commit/54231bfec5bb02a7f1cc481027f1899b2604a6f1))
* Allow internal cluster comms between mod_shib and apache ([d528d9d](https://github.com/uzh-bf/klicker-uzh/commit/d528d9db4e5a27c3a61f7db603a286adf327856d))
* Build all tags (github blocks overwriting latest..) ([15e476c](https://github.com/uzh-bf/klicker-uzh/commit/15e476c3f73b4479a8a53f41b9c08fd9085e6fa1))
* Domain without preceding dot ([f989083](https://github.com/uzh-bf/klicker-uzh/commit/f98908336c3940ef6fee8d34e96eefce3f8f8350))
* Location header with : ([c060d34](https://github.com/uzh-bf/klicker-uzh/commit/c060d34451ecac70499f34326244ef3651019d8a))
* missing semicolon ([f54aa16](https://github.com/uzh-bf/klicker-uzh/commit/f54aa16a48141acd8ab698e11c189bd53189729d))
* Ordering of setcookie ([8af2400](https://github.com/uzh-bf/klicker-uzh/commit/8af2400b5ba6b7769976170971ef93492a3c1781))
* Path in header() ([70648e6](https://github.com/uzh-bf/klicker-uzh/commit/70648e660f09633f820e979e2b9230d64b5415bf))
* Path to docker-shibboleth ([a68c672](https://github.com/uzh-bf/klicker-uzh/commit/a68c672ccf2e0c8e602124a10062ac298cca63e8))
* Set handlerSSL to false ([9f0a873](https://github.com/uzh-bf/klicker-uzh/commit/9f0a873c78418b0a0bb0751e94247b22526ca5aa))
* Set target ([ab3339e](https://github.com/uzh-bf/klicker-uzh/commit/ab3339e4e2aebca12f8a5555c45c473081943426))
* Try with handlerSSL ([58a84a4](https://github.com/uzh-bf/klicker-uzh/commit/58a84a492ed86c7800486ba6ed6d6aa885818cf5))
* Update absolute path in htaccess ([c545c65](https://github.com/uzh-bf/klicker-uzh/commit/c545c65d17b09f2848bec0c9aa6aca6f702f6961))
* Update command override for http container ([1bd96d3](https://github.com/uzh-bf/klicker-uzh/commit/1bd96d3f2a3539ad07b835423cef5aff7aeda57f))
* Use ServerName directive for https ([593dc71](https://github.com/uzh-bf/klicker-uzh/commit/593dc71eec74a6679af51244b4e6e6e7b210c8a0))
* Use slim response header for redirect ([284321c](https://github.com/uzh-bf/klicker-uzh/commit/284321c67fdcced17b806aee0ecebc8836afc444))
* Writing to stdout ([aa60908](https://github.com/uzh-bf/klicker-uzh/commit/aa60908d8efa0ce14dc6f8a1e7bf30854f3f3c8b))


### Enhancements

* **deploy:** add the chart appVersion as SENTRY_RELEASE ([af6601c](https://github.com/uzh-bf/klicker-uzh/commit/af6601c542c67afb66bfa9301a4f2004d23d17c6))
* **deploy:** add the frontend trace sample rate to the config map ([579493a](https://github.com/uzh-bf/klicker-uzh/commit/579493a09e5c011116c02f8165b109cdc3102618))


### Documentation

* **deploy:** add docker-compose sample with isolated network and traefik reverse proxy ([#2550](https://github.com/uzh-bf/klicker-uzh/issues/2550)) ([3dc6812](https://github.com/uzh-bf/klicker-uzh/commit/3dc68128b2ebfa9884ce52451894d607d59a8ae0))
* **deploy:** add redis persistance command to docker compose example ([1b5775b](https://github.com/uzh-bf/klicker-uzh/commit/1b5775b7bc71382df0620135860280a3ba89c610))
* **deploy:** add redis persistence command to traefik example ([02d06aa](https://github.com/uzh-bf/klicker-uzh/commit/02d06aa397ec2578ed95e2dacd254d24cec2704d))


### Other

* adapt README for new shibboleth service and wording for deployments ([4ce9a43](https://github.com/uzh-bf/klicker-uzh/commit/4ce9a43363034c2cabc47fe464c3dddd25fba6d0))
* **ci:** add workflow for shibboleth image ([2e7c453](https://github.com/uzh-bf/klicker-uzh/commit/2e7c453734f2012760c7f4d26f70ee099fad29de))
* **deploy:** remove cruft swp file ([695c165](https://github.com/uzh-bf/klicker-uzh/commit/695c165f69bcda7bbde22731a8435c7ebafaae73))
* **landing:** add next/lint ([6c26adf](https://github.com/uzh-bf/klicker-uzh/commit/6c26adfde272f2062a7104c769541e34bebf6516))
* **README:** adjust linking to shibboleth subdirectory ([ff9ee4f](https://github.com/uzh-bf/klicker-uzh/commit/ff9ee4fb3586b7fe0b8160e2073ef891290cbc59))
* **shibboleth:** merge klicker-aai repo into klicker-uzh ([f9ae729](https://github.com/uzh-bf/klicker-uzh/commit/f9ae7294287087f5b9a192b8ac8cc708b906879d))

### [1.6.2-beta.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.2-beta.0...v1.6.2-beta.1) (2021-10-02)


### Other

* adjust autoscale sensitivity and appVersion ([885a382](https://github.com/uzh-bf/klicker-uzh/commit/885a382bf674bfbe7906893a32a5f836bc959122))

### [1.6.2-beta.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.2-alpha.0...v1.6.2-beta.0) (2021-10-02)


### Other

* **frontend:** add more default CSP rules based on sentry issues ([20f6e8e](https://github.com/uzh-bf/klicker-uzh/commit/20f6e8e15045b800e413f2079fce07b0f4f4f017))

### [1.6.2-alpha.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.1...v1.6.2-alpha.0) (2021-10-01)


### Bug Fixes

* feedback channel - removed response timestamp from question block in student view ([0c08c2d](https://github.com/uzh-bf/klicker-uzh/commit/0c08c2d08ef6469e7fa90e3167b6e37d396ea9b9))


### Other

* adapted readmes to new monorepo structure ([f4aba82](https://github.com/uzh-bf/klicker-uzh/commit/f4aba8252b6eb4790633f6563a6e16c7f28fb085))
* added new feedback channel features to landing page ([118853d](https://github.com/uzh-bf/klicker-uzh/commit/118853d4cf950105c3ff1ca1e4b95219a5526dae))
* **deploy:** add an example docker-compose ([75291b2](https://github.com/uzh-bf/klicker-uzh/commit/75291b2eec832e15e777d5851cc190cafd1ae568))


### Enhancements

* add APP_HOST configuration with all interfaces as a default ([0b42321](https://github.com/uzh-bf/klicker-uzh/commit/0b423216fa7f052aea10f0ca74e0ced14e1a5c1f))
* listen on localhost when in development ([85d9980](https://github.com/uzh-bf/klicker-uzh/commit/85d998079d4648a664348ec74e0c709b8dec0fc1))

### [1.5.5](https://github.com/uzh-bf/klicker-uzh/compare/v1.5.4...v1.5.5) (2021-03-14)

### [1.5.3](https://github.com/uzh-bf/klicker-uzh/compare/v1.5.2...v1.5.3) (2020-09-23)

### [1.5.2](https://github.com/uzh-bf/klicker-uzh/compare/v1.5.1...v1.5.2) (2020-09-22)

### [1.5.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.5.0...v1.5.1) (2020-09-08)

## [1.5.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.5.0-rc.4...v1.5.0) (2020-05-24)

### [1.6.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-rc.8...v1.6.1) (2021-09-24)


### Other

* **deploy:** bump appVersion to 1.6.1 ([f2ea1b1](https://github.com/uzh-bf/klicker-uzh/commit/f2ea1b11ae5d08bc16d657800712896e0d74bf3b))

## [1.6.0-rc.8](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-rc.7...v1.6.0-rc.8) (2021-09-24)


### Features

* allow for filtering on the feedback page of a closed session using a refactored filter hook ([849239a](https://github.com/uzh-bf/klicker-uzh/commit/849239a117f77e7e949fbb6d148fa6f1e0c1786d))


### Bug Fixes

* add DE translation of the descriptive text for the feedback channel ([fa88c13](https://github.com/uzh-bf/klicker-uzh/commit/fa88c138735c4bbb03817f6f06c2452334b0d526))
* ensure that the print view of the feedbacks on a closed session evaluation does not hide overflow (allow for multiple pages) ([7378062](https://github.com/uzh-bf/klicker-uzh/commit/7378062b2165d5f609cb33f5e262980be3a91723))
* **landing:** adjust address in privacy policy ([4b79e90](https://github.com/uzh-bf/klicker-uzh/commit/4b79e90e823b15eff28ddcde8d9f4b5b1814f7f5))
* **landing:** adjust data storage description ([28decd7](https://github.com/uzh-bf/klicker-uzh/commit/28decd72cb9001e53d7219450f15faa43e0f2236))


### Enhancements

* remove the icons from public feedbacks ([a1a798e](https://github.com/uzh-bf/klicker-uzh/commit/a1a798e7646e53e2efbcb76da38ef5e0f22465e3))
* reverse the ordering of feedbacks on the student view to show recent feedbacks on top ([dbede4d](https://github.com/uzh-bf/klicker-uzh/commit/dbede4d0593f45a5be00fa4f858272a1526a5466))


### Other

* **deploy:** adjust autoscaling settings ([59dd925](https://github.com/uzh-bf/klicker-uzh/commit/59dd9255e92a5de6a9691986d108db8858d6e84a))
* **deploy:** bump the version of the app to deploy ([958237d](https://github.com/uzh-bf/klicker-uzh/commit/958237d3b6eb4c87e32fa5b1eea1e4eb5a46ce0c))

## [1.6.0-rc.7](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-rc.6...v1.6.0-rc.7) (2021-09-20)


### Bug Fixes

* ensure that feedbacks are not published in the session update subscription ([2d32f92](https://github.com/uzh-bf/klicker-uzh/commit/2d32f922df5296f52c5a2400d781014a1d2d85c6))


### Other

* **deploy:** adjust resources and add quota for redis ([055ace9](https://github.com/uzh-bf/klicker-uzh/commit/055ace9c0f4ecbfcaca7918ac0ee7cfde6836a1a))
* **deploy:** update appVersion to v1.6.0-rc.7 ([7eb10c8](https://github.com/uzh-bf/klicker-uzh/commit/7eb10c85da1f72b8226f86be5c9b39407490c373))

## [1.6.0-rc.6](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-rc.5...v1.6.0-rc.6) (2021-09-19)


### Refactors

* move q&a to a separate query with polling ([8fbce62](https://github.com/uzh-bf/klicker-uzh/commit/8fbce62c3cca683ddc3861a70ca6e5b567d96e83))
* reduce boilerplate in subscription resolvers ([271021d](https://github.com/uzh-bf/klicker-uzh/commit/271021ddcfc9161288ffd7de6f07225459d291a5))


### Enhancements

* add a subscription for added feedback responses ([d2fb373](https://github.com/uzh-bf/klicker-uzh/commit/d2fb373f4e4565165c842957c50811fb6a0cc76a))
* add a subscription for feedback deletion ([c48feb6](https://github.com/uzh-bf/klicker-uzh/commit/c48feb62a73d7a6be99ff9554d553c583ec47e60))
* add a subscription for newly added or published feedbacks ([5401261](https://github.com/uzh-bf/klicker-uzh/commit/54012610ceb9a0ab6719404356cefc147ad0d4be))
* add a subscription for resolving of feedbacks ([03c0bb4](https://github.com/uzh-bf/klicker-uzh/commit/03c0bb4e903add4f73c5d52c8a382c7f6f94ebab))
* use separate subscriptions for running session and join session screens and new feedbacks ([40b1517](https://github.com/uzh-bf/klicker-uzh/commit/40b151767fa5c5e6c9aad2f17c0aa31dbc55e7c2))


### Other

* **deploy:** bump the appVersion to v1.6.0-rc.6 ([4447e4e](https://github.com/uzh-bf/klicker-uzh/commit/4447e4e4bf02d505dfacb5d35c2036bed2617807))
* **deploy:** update min replicas when autoscaling to three per service ([7834fa4](https://github.com/uzh-bf/klicker-uzh/commit/7834fa4574b1a8c4cc4bf91b04525f4d4b99ef1b))
* **frontend:** move types to a new specific dir ([9fda4af](https://github.com/uzh-bf/klicker-uzh/commit/9fda4af9b9b1da095e54b54f8a442eb2bb1f3f90))
* **frontend:** setup rimraf for .next/cache on nodemon restart ([8184336](https://github.com/uzh-bf/klicker-uzh/commit/818433674b19aeb720e502314b714d704b18561d))

## [1.6.0-rc.5](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-rc.4...v1.6.0-rc.5) (2021-09-19)


### Bug Fixes

* **backend:** use response cache for resolving poll results ([f9f8d68](https://github.com/uzh-bf/klicker-uzh/commit/f9f8d6852ffe743e57649d2f02134f77a1da5b5b))
* **test:** update snapshots to correspond to new Q&A public by default ([b5259e1](https://github.com/uzh-bf/klicker-uzh/commit/b5259e15dc43c65187f30956bfd0ec3a5300b388))


### Other

* **backend:** add mongo test url to .env.template ([aba3813](https://github.com/uzh-bf/klicker-uzh/commit/aba38136b95d7fc44edc980f1a630cdd4d053ed1))
* **deploy:** update appVersion to v1.6.0-rc.5 ([693a151](https://github.com/uzh-bf/klicker-uzh/commit/693a15134a73c21aa5d78aae79ad5671b32feb74))

## [1.6.0-rc.4](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-rc.3...v1.6.0-rc.4) (2021-09-17)


### Bug Fixes

* **deploy:** ensure that the redis password for exec instance is added to the secret ([c6fe6ea](https://github.com/uzh-bf/klicker-uzh/commit/c6fe6ea079bea480634924af00a6f53193be5918))
* **frontend:** ensure that locale stays on page switches and does not revert to browser locale ([58cfa3e](https://github.com/uzh-bf/klicker-uzh/commit/58cfa3e731973ff0a7b34adf082c32105ff73aff))


### Deployment

* use appVersion v1.6.0-rc.3 ([b0887fb](https://github.com/uzh-bf/klicker-uzh/commit/b0887fbecb0d437aaa63d59c93f4ddcca900935a))


### Enhancements

* **deploy:** add minio to the local dev environment for improved default DX ([9ed8ac7](https://github.com/uzh-bf/klicker-uzh/commit/9ed8ac7d9af7214dadf18cc294a42626893c1ac3))

## [1.6.0-rc.3](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-rc.1...v1.6.0-rc.3) (2021-09-17)


### Features

* add initial survey confirmation ([368dca8](https://github.com/uzh-bf/klicker-uzh/commit/368dca89af92ef13ebcbaf02fdad871d3812e84a))
* add second in-cluster redis instance for page caching ([56066a9](https://github.com/uzh-bf/klicker-uzh/commit/56066a9fdc734bb01b6047757c6ed4999c677b43))


### Bug Fixes

* reverse the order of toast and intl provider as toast depends on intl ([f427484](https://github.com/uzh-bf/klicker-uzh/commit/f427484d37e52edb0deef78a70d359ab0c10040e))


### Deployment

* adjust parameters for autoscale ([487ccb1](https://github.com/uzh-bf/klicker-uzh/commit/487ccb13b31651c42009c088c716a00d163e4322))
* enable autoscaling for prod ([ff15bb5](https://github.com/uzh-bf/klicker-uzh/commit/ff15bb53e062ebaa5cb196bd171c7df3d8e3b7ed))
* reapply additional production settings ([bcb163d](https://github.com/uzh-bf/klicker-uzh/commit/bcb163d27c6f51cb7a386e67e63c37a8f37d27e7))
* update resource reservations and limits and autoscaling ([711e9ad](https://github.com/uzh-bf/klicker-uzh/commit/711e9ad024c85c4e2160592039edf63378ae47e1))
* use letsencrypt-based tls ([8e241f9](https://github.com/uzh-bf/klicker-uzh/commit/8e241f9fa19f3e5026a9fd65d7be2275c955d829))


### Other

* **release:** 1.6.0-rc.2 ([be06213](https://github.com/uzh-bf/klicker-uzh/commit/be06213b2190e6ed471bb96b34c38fe78c4de668))
* remove pass of in-cluster redis ([d69fa3e](https://github.com/uzh-bf/klicker-uzh/commit/d69fa3ec7523861e9c3f121619892cbbbfb0afb4))
* reorganize docker-compose with one file at the root ([92687a4](https://github.com/uzh-bf/klicker-uzh/commit/92687a4fd106b143bb03ee3fa56a99d4a6917a59))

## [1.6.0-rc.2](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-rc.1...v1.6.0-rc.2) (2021-09-13)


### Bug Fixes

* reverse the order of toast and intl provider as toast depends on intl ([f427484](https://github.com/uzh-bf/klicker-uzh/commit/f427484d37e52edb0deef78a70d359ab0c10040e))


### Deployment

* enable autoscaling for prod ([ff15bb5](https://github.com/uzh-bf/klicker-uzh/commit/ff15bb53e062ebaa5cb196bd171c7df3d8e3b7ed))
* reapply additional production settings ([bcb163d](https://github.com/uzh-bf/klicker-uzh/commit/bcb163d27c6f51cb7a386e67e63c37a8f37d27e7))
* update resource reservations and limits and autoscaling ([711e9ad](https://github.com/uzh-bf/klicker-uzh/commit/711e9ad024c85c4e2160592039edf63378ae47e1))
* use letsencrypt-based tls ([8e241f9](https://github.com/uzh-bf/klicker-uzh/commit/8e241f9fa19f3e5026a9fd65d7be2275c955d829))


### Other

* reorganize docker-compose with one file at the root ([92687a4](https://github.com/uzh-bf/klicker-uzh/commit/92687a4fd106b143bb03ee3fa56a99d4a6917a59))

## [1.6.0-rc.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-rc.0...v1.6.0-rc.1) (2021-09-12)


### Other

* bump chart appVersion ([6d0f508](https://github.com/uzh-bf/klicker-uzh/commit/6d0f508920440d8773307eddbb690f2da267a27a))


### Enhancements

* add APP_WITH_AAI configuration parameter to enable aai login on prod ([90b27e8](https://github.com/uzh-bf/klicker-uzh/commit/90b27e88faf349750e316c8801f04c0dea19b861))

## [1.6.0-rc.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-beta.2...v1.6.0-rc.0) (2021-09-12)


### Bug Fixes

* createdAt for feedbacks ([83617b1](https://github.com/uzh-bf/klicker-uzh/commit/83617b14eaa0dcd607956f1b9b2aced969ed28ef))
* feedback categorization based on resolved attribute ([593cef5](https://github.com/uzh-bf/klicker-uzh/commit/593cef50c783191d91b47488c8bb72dc9510699c))
* update naming of fingerprint library ([d095592](https://github.com/uzh-bf/klicker-uzh/commit/d0955927276f0217f337bdecd251e2c0bfdc6acf))


### Documentation

* add entry for the fall release 2021 ([da030e2](https://github.com/uzh-bf/klicker-uzh/commit/da030e2fdae07e48a2a9328bb2be780d23bb266e))


### Other

* added optional simplified view for feedback channel on evaluation page as comment ([8195aac](https://github.com/uzh-bf/klicker-uzh/commit/8195aac126baeaa9c3baf492826c77e2a3dffc4f))
* dependency maintenance ([101c169](https://github.com/uzh-bf/klicker-uzh/commit/101c169925374fec542d3569c7ee2331a1f2964f))
* disable caching of the landing page to reduce redis requests ([5a57fe2](https://github.com/uzh-bf/klicker-uzh/commit/5a57fe22468c8189a5a0653485fb44ff74d38bb4))
* lockfile maintenance ([170f8a2](https://github.com/uzh-bf/klicker-uzh/commit/170f8a2eb69ab6f9d981c96e0d62eca33782791b))
* optimization of feedback channel tab on evaluation page after session end ([0f56c05](https://github.com/uzh-bf/klicker-uzh/commit/0f56c05db27f531efde45fb638b82c46ff48397e))
* **release:** 1.6.0-beta.3 ([28f8c72](https://github.com/uzh-bf/klicker-uzh/commit/28f8c7227f49947c94caf92acd4e9a58ba2ac221))
* **release:** 1.6.0-beta.4 ([a4eceef](https://github.com/uzh-bf/klicker-uzh/commit/a4eceefc92db3c39f9786552eec824fa9db49121))
* **release:** 1.6.0-beta.5 ([6b32cf9](https://github.com/uzh-bf/klicker-uzh/commit/6b32cf9431aeede2896b2f3f23fb48b48d898a14))
* remove cruft azure scripting ([4683abf](https://github.com/uzh-bf/klicker-uzh/commit/4683abfb5b1e6857b1a939fb28d8b4a9bc1becf9))


### Enhancements

* improve sentry integration ([2705776](https://github.com/uzh-bf/klicker-uzh/commit/2705776e9253e49409ea96b6a717dc49cc6b7eab))
* improved feedback / question view on evaluation page and print layout ([b59ab02](https://github.com/uzh-bf/klicker-uzh/commit/b59ab02810c489f6915ba520c23182a4b8355c50))
* modified support section with modal containing documentation, feedback and contact links ([66b44d3](https://github.com/uzh-bf/klicker-uzh/commit/66b44d36f55388fca41d9da62052ffbb5606b40a))
* update support screen to incorporate clickup feedback form and additional outgoing links ([766ee87](https://github.com/uzh-bf/klicker-uzh/commit/766ee8736496b40df0641518bc10b22f9fab7284))
* use simplified feedback display and move print button to info bar ([e931d72](https://github.com/uzh-bf/klicker-uzh/commit/e931d72d8bbbd5bcea35bc5014eb3d2636dc1f21))


### Deployment

* add dryrun sync script and use subfolder ([b71ab67](https://github.com/uzh-bf/klicker-uzh/commit/b71ab674f575b013cc3f60c2a71396fc3cb185a4))
* add redis restore and exo commands ([f72e3e7](https://github.com/uzh-bf/klicker-uzh/commit/f72e3e73e20ef0430bebe216d65297b8fd129393))
* add remaining labels to service selector ([7dd0feb](https://github.com/uzh-bf/klicker-uzh/commit/7dd0febea0f697e91d1371b39505cbd7e8cf9fb6))
* ensure that the sentry auth token for frontend is read correctly ([d095b05](https://github.com/uzh-bf/klicker-uzh/commit/d095b057e95a42e96f36618a8c145ff4901d95f8))
* fixed redis migration commands ([e9ba8d2](https://github.com/uzh-bf/klicker-uzh/commit/e9ba8d2c0902a96a72fdfe18439744156040e829))
* more work on script ([338a6eb](https://github.com/uzh-bf/klicker-uzh/commit/338a6eb2f5b8ae8e3986c3a2512d315536d0a716))
* preparations for prod migration ([f23e5c8](https://github.com/uzh-bf/klicker-uzh/commit/f23e5c8951072b1c448804694c31718308948253))
* split values of stage and qa env ([248614e](https://github.com/uzh-bf/klicker-uzh/commit/248614eec6e9731798fc72bc860f9e9fa5a3f6d0))
* update migration scripts ([493e7ab](https://github.com/uzh-bf/klicker-uzh/commit/493e7ab5fa206690ea4f1d1a64d52978143bfa2f))
* update resources and autoscale settings for services ([c0f8994](https://github.com/uzh-bf/klicker-uzh/commit/c0f89946a56cc2ad03464b6e9376bcae87e60c28))
* update service and deployment labels ([4c94b90](https://github.com/uzh-bf/klicker-uzh/commit/4c94b90b4f6fb694bd34ab330e64bb8b4d7d207b))

## [1.6.0-beta.5](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-beta.2...v1.6.0-beta.5) (2021-09-10)


### Bug Fixes

* update naming of fingerprint library ([d095592](https://github.com/uzh-bf/klicker-uzh/commit/d0955927276f0217f337bdecd251e2c0bfdc6acf))


### Documentation

* add entry for the fall release 2021 ([da030e2](https://github.com/uzh-bf/klicker-uzh/commit/da030e2fdae07e48a2a9328bb2be780d23bb266e))


### Enhancements

* improve sentry integration ([2705776](https://github.com/uzh-bf/klicker-uzh/commit/2705776e9253e49409ea96b6a717dc49cc6b7eab))


### Deployment

* add dryrun sync script and use subfolder ([b71ab67](https://github.com/uzh-bf/klicker-uzh/commit/b71ab674f575b013cc3f60c2a71396fc3cb185a4))
* add redis restore and exo commands ([f72e3e7](https://github.com/uzh-bf/klicker-uzh/commit/f72e3e73e20ef0430bebe216d65297b8fd129393))
* add remaining labels to service selector ([7dd0feb](https://github.com/uzh-bf/klicker-uzh/commit/7dd0febea0f697e91d1371b39505cbd7e8cf9fb6))
* ensure that the sentry auth token for frontend is read correctly ([d095b05](https://github.com/uzh-bf/klicker-uzh/commit/d095b057e95a42e96f36618a8c145ff4901d95f8))
* fixed redis migration commands ([e9ba8d2](https://github.com/uzh-bf/klicker-uzh/commit/e9ba8d2c0902a96a72fdfe18439744156040e829))
* more work on script ([338a6eb](https://github.com/uzh-bf/klicker-uzh/commit/338a6eb2f5b8ae8e3986c3a2512d315536d0a716))
* split values of stage and qa env ([248614e](https://github.com/uzh-bf/klicker-uzh/commit/248614eec6e9731798fc72bc860f9e9fa5a3f6d0))
* update migration scripts ([493e7ab](https://github.com/uzh-bf/klicker-uzh/commit/493e7ab5fa206690ea4f1d1a64d52978143bfa2f))
* update resources and autoscale settings for services ([c0f8994](https://github.com/uzh-bf/klicker-uzh/commit/c0f89946a56cc2ad03464b6e9376bcae87e60c28))
* update service and deployment labels ([4c94b90](https://github.com/uzh-bf/klicker-uzh/commit/4c94b90b4f6fb694bd34ab330e64bb8b4d7d207b))


### Other

* dependency maintenance ([101c169](https://github.com/uzh-bf/klicker-uzh/commit/101c169925374fec542d3569c7ee2331a1f2964f))
* disable caching of the landing page to reduce redis requests ([5a57fe2](https://github.com/uzh-bf/klicker-uzh/commit/5a57fe22468c8189a5a0653485fb44ff74d38bb4))
* lockfile maintenance ([170f8a2](https://github.com/uzh-bf/klicker-uzh/commit/170f8a2eb69ab6f9d981c96e0d62eca33782791b))
* **release:** 1.6.0-beta.3 ([28f8c72](https://github.com/uzh-bf/klicker-uzh/commit/28f8c7227f49947c94caf92acd4e9a58ba2ac221))
* **release:** 1.6.0-beta.4 ([a4eceef](https://github.com/uzh-bf/klicker-uzh/commit/a4eceefc92db3c39f9786552eec824fa9db49121))
* remove cruft azure scripting ([4683abf](https://github.com/uzh-bf/klicker-uzh/commit/4683abfb5b1e6857b1a939fb28d8b4a9bc1becf9))

## [1.6.0-beta.4](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-beta.2...v1.6.0-beta.4) (2021-09-09)


### Enhancements

* improve sentry integration ([2705776](https://github.com/uzh-bf/klicker-uzh/commit/2705776e9253e49409ea96b6a717dc49cc6b7eab))


### Other

* disable caching of the landing page to reduce redis requests ([5a57fe2](https://github.com/uzh-bf/klicker-uzh/commit/5a57fe22468c8189a5a0653485fb44ff74d38bb4))
* **release:** 1.6.0-beta.3 ([28f8c72](https://github.com/uzh-bf/klicker-uzh/commit/28f8c7227f49947c94caf92acd4e9a58ba2ac221))
* remove cruft azure scripting ([4683abf](https://github.com/uzh-bf/klicker-uzh/commit/4683abfb5b1e6857b1a939fb28d8b4a9bc1becf9))


### Deployment

* add remaining labels to service selector ([7dd0feb](https://github.com/uzh-bf/klicker-uzh/commit/7dd0febea0f697e91d1371b39505cbd7e8cf9fb6))
* ensure that the sentry auth token for frontend is read correctly ([d095b05](https://github.com/uzh-bf/klicker-uzh/commit/d095b057e95a42e96f36618a8c145ff4901d95f8))
* split values of stage and qa env ([248614e](https://github.com/uzh-bf/klicker-uzh/commit/248614eec6e9731798fc72bc860f9e9fa5a3f6d0))
* update resources and autoscale settings for services ([c0f8994](https://github.com/uzh-bf/klicker-uzh/commit/c0f89946a56cc2ad03464b6e9376bcae87e60c28))

## [1.6.0-beta.3](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-beta.2...v1.6.0-beta.3) (2021-09-08)


### Enhancements

* improve sentry integration ([2705776](https://github.com/uzh-bf/klicker-uzh/commit/2705776e9253e49409ea96b6a717dc49cc6b7eab))

## [1.6.0-beta.2](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.8...v1.6.0-beta.2) (2021-09-08)


### Features

* added button to reach 'pinned feedback' page from running session view ([13a9faa](https://github.com/uzh-bf/klicker-uzh/commit/13a9faa4513caddc4f7ace7f5d63c8716fb196f7))
* added possiblity to print feedback from evaluation for past sessions ([e26bc89](https://github.com/uzh-bf/klicker-uzh/commit/e26bc89205fb73083c2ab47c3c4da9a01b4cb9e7))
* **landing:** rework the roadmap page to incorporate our public clickup roadmap ([7d93b2a](https://github.com/uzh-bf/klicker-uzh/commit/7d93b2a9d3a8b5b0a5ad91f1b539914e3a558b8d))
* response ratings and question responses are now visible for past sessions as well ([8eba2da](https://github.com/uzh-bf/klicker-uzh/commit/8eba2da65e5c068dc0a93a2998cc0d670f43e683))
* rework react-intl integration and migrate to ts-node ([#2533](https://github.com/uzh-bf/klicker-uzh/issues/2533)) ([f9fc0ae](https://github.com/uzh-bf/klicker-uzh/commit/f9fc0ae30b88515f37cf483fe9c36b590a59b955))


### Bug Fixes

* ensure that feedbacks and reactions are initialized correctly ([04d2d39](https://github.com/uzh-bf/klicker-uzh/commit/04d2d39f16272b829abcd570eb825e8ba1bd2257))
* **frontend:** ensure that NEXT_PUBLIC_DISPLAY_AAI is parsed correctly ([58d791f](https://github.com/uzh-bf/klicker-uzh/commit/58d791f6b7842446ca462a23e00cc598168b7dd0))
* **landing:** ensure that the nav on landing can stack on mobile ([53e2014](https://github.com/uzh-bf/klicker-uzh/commit/53e2014ce882b5a3afcf5fcef7334f8c7a10c826))


### Deployment

* update node command in dockerfile ([d505c0f](https://github.com/uzh-bf/klicker-uzh/commit/d505c0f896e2472681e5418b5cb0987051030e03))


### Documentation

* ensure that there is a type for EasyForms ([91fce9a](https://github.com/uzh-bf/klicker-uzh/commit/91fce9aa83841e0d1f60601987bc1ca1a77bc420))
* mini update of audience interaction ([92f451d](https://github.com/uzh-bf/klicker-uzh/commit/92f451d042912848e0fdb5599e47374113041446))
* replace spectrum chat with gh discussions, add mention of ms teams ([094f7ba](https://github.com/uzh-bf/klicker-uzh/commit/094f7ba5f0cf733acef223700f2892dcc6fc28c4))
* update audience interaction documentation ([b156240](https://github.com/uzh-bf/klicker-uzh/commit/b156240da9a908783f2cd968d9064b4401d0e659))
* update evaluation documentation ([3e4d179](https://github.com/uzh-bf/klicker-uzh/commit/3e4d17995922f4970051c37ff443123cffaae2d7))
* update evaluation documentation ([1c6162e](https://github.com/uzh-bf/klicker-uzh/commit/1c6162e16f88af1f880fa9499cc3a8e8ac6670d3))
* update of audience interaction docs ([d2692c4](https://github.com/uzh-bf/klicker-uzh/commit/d2692c435f016058484a6e03b4b4b00557e4dda2))
* update of running session docs ([929c658](https://github.com/uzh-bf/klicker-uzh/commit/929c658b488327ce4b35b8e3ced5bbc430880da8))
* updated audience view doc page ([0914601](https://github.com/uzh-bf/klicker-uzh/commit/09146014fb37b77e69f532ef1099211bd4b06e4b))
* updated screenshot and content for question pool documentation ([4880ba0](https://github.com/uzh-bf/klicker-uzh/commit/4880ba0e6c4760a1fd285306f754501b59ef49ae))
* upgrade dependencies for documentation ([87d5844](https://github.com/uzh-bf/klicker-uzh/commit/87d5844f4eed9e583167105323cb95f5c2b083a5))


### Other

* added scrolling in case of overflow on feedback site for past sessions ([9fe8199](https://github.com/uzh-bf/klicker-uzh/commit/9fe8199f5883224e807e2f8bc987d0b170032b99))
* enable polling on the running session screen ([b7c732c](https://github.com/uzh-bf/klicker-uzh/commit/b7c732c98c7c3a27af364b36f8eebece7fdf62ef))
* **frontend:** add engines spec for node 14+ ([79ec7e4](https://github.com/uzh-bf/klicker-uzh/commit/79ec7e45a1a38ce03d57818ccd4ca0cc41d35dec))
* improved landing site with a call for involvement and some styling ([d9139e8](https://github.com/uzh-bf/klicker-uzh/commit/d9139e8e916a8cabbca5491c866ff18fc26ff64a))
* improved styling of feedback channel for display of past sessions ([41b92b5](https://github.com/uzh-bf/klicker-uzh/commit/41b92b5ae884b6c1e12be209002ed1cdce9af5e3))
* internationalization for running session audience interaction panel ([55f3bd5](https://github.com/uzh-bf/klicker-uzh/commit/55f3bd5147e14c3c03eca29f24b9da4211faec08))
* lockfile maintenance ([454fe8b](https://github.com/uzh-bf/klicker-uzh/commit/454fe8b891ecedd756f62fa52cb755eb991a562b))
* make husky scripts executable ([d9ba16b](https://github.com/uzh-bf/klicker-uzh/commit/d9ba16b05811b783f236113d7fec6d171ca76d70))
* reformat with prettier ([efc0e7b](https://github.com/uzh-bf/klicker-uzh/commit/efc0e7b1147a3f18f32c1ce0011ffd9589189da9))
* **release:** 1.6.0-alpha.10 ([6bbe387](https://github.com/uzh-bf/klicker-uzh/commit/6bbe3876f19bf93f7e40bd5133fb9ce163b78cef))
* **release:** 1.6.0-alpha.9 ([69ff0d7](https://github.com/uzh-bf/klicker-uzh/commit/69ff0d73e35347ace76fb42b2ebc1a71b28750f0))
* **release:** 1.6.0-beta.0 ([1ccd4d9](https://github.com/uzh-bf/klicker-uzh/commit/1ccd4d9aacdff39f93bc83624634853a2f5d567a))
* **release:** 1.6.0-beta.1 ([6badcde](https://github.com/uzh-bf/klicker-uzh/commit/6badcde2183635ccd85dd7133c28491bcd003f9a))
* small upgrades and improvements ([ad764cb](https://github.com/uzh-bf/klicker-uzh/commit/ad764cb6f235e81f59483ddb7d9f25b1500fbfe5))
* updated open source description on landing page ([0ff6cb3](https://github.com/uzh-bf/klicker-uzh/commit/0ff6cb3e75183d641ed54d74b39fac0fceda9d62))


### Dependencies

* perform minor and non-critical deps upgrades ([4ec66e7](https://github.com/uzh-bf/klicker-uzh/commit/4ec66e7c114a563773b87f2f049d3348378b77c3))
* upgrade apollo-server-express to 3.3.0 ([cd0c5c2](https://github.com/uzh-bf/klicker-uzh/commit/cd0c5c23c644d0dabc19fac07c65723b2aad29a5))
* upgrade husky ([1399f20](https://github.com/uzh-bf/klicker-uzh/commit/1399f20c5995d7e79e425f20c19611bd6bf3b292))
* upgrade minor and non-critical dependencies ([d96f846](https://github.com/uzh-bf/klicker-uzh/commit/d96f8467b64d09e868bb3df088e2eb98e0d98f90))
* upgrade node-schedule ([d27b436](https://github.com/uzh-bf/klicker-uzh/commit/d27b436be328abaac3922dbec485925d291242b9))


### Enhancements

* add sentry environment ([40b3657](https://github.com/uzh-bf/klicker-uzh/commit/40b3657d9bc6b3d7d034392d94fbc6356307cfd8))
* **frontend:** allow parametrized display of the AAI login button based on NEXT_PUBLIC_DISPLAY_AAI ([8ba7a83](https://github.com/uzh-bf/klicker-uzh/commit/8ba7a83c8bb7dca746a352e368efe98cb4781a5d))
* **landing:** add compression and caching rules to .htaccess ([8d7f4cd](https://github.com/uzh-bf/klicker-uzh/commit/8d7f4cdc4f60deeed54376bca553671fc9b4d39c))
* prepare apollo response caching plugin and automated persisted queries ([25ddb3c](https://github.com/uzh-bf/klicker-uzh/commit/25ddb3cce8aa9a030df82c5409269b0c0265e015))

## [1.6.0-beta.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.8...v1.6.0-beta.1) (2021-09-06)


### Features

* added button to reach 'pinned feedback' page from running session view ([13a9faa](https://github.com/uzh-bf/klicker-uzh/commit/13a9faa4513caddc4f7ace7f5d63c8716fb196f7))
* added possiblity to print feedback from evaluation for past sessions ([e26bc89](https://github.com/uzh-bf/klicker-uzh/commit/e26bc89205fb73083c2ab47c3c4da9a01b4cb9e7))
* **landing:** rework the roadmap page to incorporate our public clickup roadmap ([7d93b2a](https://github.com/uzh-bf/klicker-uzh/commit/7d93b2a9d3a8b5b0a5ad91f1b539914e3a558b8d))
* response ratings and question responses are now visible for past sessions as well ([8eba2da](https://github.com/uzh-bf/klicker-uzh/commit/8eba2da65e5c068dc0a93a2998cc0d670f43e683))
* rework react-intl integration and migrate to ts-node ([#2533](https://github.com/uzh-bf/klicker-uzh/issues/2533)) ([f9fc0ae](https://github.com/uzh-bf/klicker-uzh/commit/f9fc0ae30b88515f37cf483fe9c36b590a59b955))


### Bug Fixes

* ensure that feedbacks and reactions are initialized correctly ([04d2d39](https://github.com/uzh-bf/klicker-uzh/commit/04d2d39f16272b829abcd570eb825e8ba1bd2257))
* **frontend:** ensure that NEXT_PUBLIC_DISPLAY_AAI is parsed correctly ([58d791f](https://github.com/uzh-bf/klicker-uzh/commit/58d791f6b7842446ca462a23e00cc598168b7dd0))
* **landing:** ensure that the nav on landing can stack on mobile ([53e2014](https://github.com/uzh-bf/klicker-uzh/commit/53e2014ce882b5a3afcf5fcef7334f8c7a10c826))


### Dependencies

* perform minor and non-critical deps upgrades ([4ec66e7](https://github.com/uzh-bf/klicker-uzh/commit/4ec66e7c114a563773b87f2f049d3348378b77c3))
* upgrade husky ([1399f20](https://github.com/uzh-bf/klicker-uzh/commit/1399f20c5995d7e79e425f20c19611bd6bf3b292))


### Deployment

* update node command in dockerfile ([d505c0f](https://github.com/uzh-bf/klicker-uzh/commit/d505c0f896e2472681e5418b5cb0987051030e03))


### Documentation

* ensure that there is a type for EasyForms ([91fce9a](https://github.com/uzh-bf/klicker-uzh/commit/91fce9aa83841e0d1f60601987bc1ca1a77bc420))
* mini update of audience interaction ([92f451d](https://github.com/uzh-bf/klicker-uzh/commit/92f451d042912848e0fdb5599e47374113041446))
* replace spectrum chat with gh discussions, add mention of ms teams ([094f7ba](https://github.com/uzh-bf/klicker-uzh/commit/094f7ba5f0cf733acef223700f2892dcc6fc28c4))
* update audience interaction documentation ([b156240](https://github.com/uzh-bf/klicker-uzh/commit/b156240da9a908783f2cd968d9064b4401d0e659))
* update evaluation documentation ([3e4d179](https://github.com/uzh-bf/klicker-uzh/commit/3e4d17995922f4970051c37ff443123cffaae2d7))
* update evaluation documentation ([1c6162e](https://github.com/uzh-bf/klicker-uzh/commit/1c6162e16f88af1f880fa9499cc3a8e8ac6670d3))
* update of audience interaction docs ([d2692c4](https://github.com/uzh-bf/klicker-uzh/commit/d2692c435f016058484a6e03b4b4b00557e4dda2))
* update of running session docs ([929c658](https://github.com/uzh-bf/klicker-uzh/commit/929c658b488327ce4b35b8e3ced5bbc430880da8))
* updated audience view doc page ([0914601](https://github.com/uzh-bf/klicker-uzh/commit/09146014fb37b77e69f532ef1099211bd4b06e4b))
* updated screenshot and content for question pool documentation ([4880ba0](https://github.com/uzh-bf/klicker-uzh/commit/4880ba0e6c4760a1fd285306f754501b59ef49ae))
* upgrade dependencies for documentation ([87d5844](https://github.com/uzh-bf/klicker-uzh/commit/87d5844f4eed9e583167105323cb95f5c2b083a5))


### Enhancements

* **frontend:** allow parametrized display of the AAI login button based on NEXT_PUBLIC_DISPLAY_AAI ([8ba7a83](https://github.com/uzh-bf/klicker-uzh/commit/8ba7a83c8bb7dca746a352e368efe98cb4781a5d))
* **landing:** add compression and caching rules to .htaccess ([8d7f4cd](https://github.com/uzh-bf/klicker-uzh/commit/8d7f4cdc4f60deeed54376bca553671fc9b4d39c))


### Other

* added scrolling in case of overflow on feedback site for past sessions ([9fe8199](https://github.com/uzh-bf/klicker-uzh/commit/9fe8199f5883224e807e2f8bc987d0b170032b99))
* enable polling on the running session screen ([b7c732c](https://github.com/uzh-bf/klicker-uzh/commit/b7c732c98c7c3a27af364b36f8eebece7fdf62ef))
* improved landing site with a call for involvement and some styling ([d9139e8](https://github.com/uzh-bf/klicker-uzh/commit/d9139e8e916a8cabbca5491c866ff18fc26ff64a))
* improved styling of feedback channel for display of past sessions ([41b92b5](https://github.com/uzh-bf/klicker-uzh/commit/41b92b5ae884b6c1e12be209002ed1cdce9af5e3))
* internationalization for running session audience interaction panel ([55f3bd5](https://github.com/uzh-bf/klicker-uzh/commit/55f3bd5147e14c3c03eca29f24b9da4211faec08))
* lockfile maintenance ([454fe8b](https://github.com/uzh-bf/klicker-uzh/commit/454fe8b891ecedd756f62fa52cb755eb991a562b))
* make husky scripts executable ([d9ba16b](https://github.com/uzh-bf/klicker-uzh/commit/d9ba16b05811b783f236113d7fec6d171ca76d70))
* **release:** 1.6.0-alpha.10 ([6bbe387](https://github.com/uzh-bf/klicker-uzh/commit/6bbe3876f19bf93f7e40bd5133fb9ce163b78cef))
* **release:** 1.6.0-alpha.9 ([69ff0d7](https://github.com/uzh-bf/klicker-uzh/commit/69ff0d73e35347ace76fb42b2ebc1a71b28750f0))
* **release:** 1.6.0-beta.0 ([1ccd4d9](https://github.com/uzh-bf/klicker-uzh/commit/1ccd4d9aacdff39f93bc83624634853a2f5d567a))
* small upgrades and improvements ([ad764cb](https://github.com/uzh-bf/klicker-uzh/commit/ad764cb6f235e81f59483ddb7d9f25b1500fbfe5))

## [1.6.0-beta.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.8...v1.6.0-beta.0) (2021-09-05)


### Features

* added button to reach 'pinned feedback' page from running session view ([13a9faa](https://github.com/uzh-bf/klicker-uzh/commit/13a9faa4513caddc4f7ace7f5d63c8716fb196f7))
* added possiblity to print feedback from evaluation for past sessions ([e26bc89](https://github.com/uzh-bf/klicker-uzh/commit/e26bc89205fb73083c2ab47c3c4da9a01b4cb9e7))
* **landing:** rework the roadmap page to incorporate our public clickup roadmap ([7d93b2a](https://github.com/uzh-bf/klicker-uzh/commit/7d93b2a9d3a8b5b0a5ad91f1b539914e3a558b8d))
* response ratings and question responses are now visible for past sessions as well ([8eba2da](https://github.com/uzh-bf/klicker-uzh/commit/8eba2da65e5c068dc0a93a2998cc0d670f43e683))
* rework react-intl integration and migrate to ts-node ([#2533](https://github.com/uzh-bf/klicker-uzh/issues/2533)) ([f9fc0ae](https://github.com/uzh-bf/klicker-uzh/commit/f9fc0ae30b88515f37cf483fe9c36b590a59b955))


### Bug Fixes

* **frontend:** ensure that NEXT_PUBLIC_DISPLAY_AAI is parsed correctly ([58d791f](https://github.com/uzh-bf/klicker-uzh/commit/58d791f6b7842446ca462a23e00cc598168b7dd0))
* **landing:** ensure that the nav on landing can stack on mobile ([53e2014](https://github.com/uzh-bf/klicker-uzh/commit/53e2014ce882b5a3afcf5fcef7334f8c7a10c826))


### Dependencies

* perform minor and non-critical deps upgrades ([4ec66e7](https://github.com/uzh-bf/klicker-uzh/commit/4ec66e7c114a563773b87f2f049d3348378b77c3))
* upgrade husky ([1399f20](https://github.com/uzh-bf/klicker-uzh/commit/1399f20c5995d7e79e425f20c19611bd6bf3b292))


### Deployment

* update node command in dockerfile ([d505c0f](https://github.com/uzh-bf/klicker-uzh/commit/d505c0f896e2472681e5418b5cb0987051030e03))


### Documentation

* ensure that there is a type for EasyForms ([91fce9a](https://github.com/uzh-bf/klicker-uzh/commit/91fce9aa83841e0d1f60601987bc1ca1a77bc420))
* mini update of audience interaction ([92f451d](https://github.com/uzh-bf/klicker-uzh/commit/92f451d042912848e0fdb5599e47374113041446))
* replace spectrum chat with gh discussions, add mention of ms teams ([094f7ba](https://github.com/uzh-bf/klicker-uzh/commit/094f7ba5f0cf733acef223700f2892dcc6fc28c4))
* update audience interaction documentation ([b156240](https://github.com/uzh-bf/klicker-uzh/commit/b156240da9a908783f2cd968d9064b4401d0e659))
* update evaluation documentation ([3e4d179](https://github.com/uzh-bf/klicker-uzh/commit/3e4d17995922f4970051c37ff443123cffaae2d7))
* update evaluation documentation ([1c6162e](https://github.com/uzh-bf/klicker-uzh/commit/1c6162e16f88af1f880fa9499cc3a8e8ac6670d3))
* update of audience interaction docs ([d2692c4](https://github.com/uzh-bf/klicker-uzh/commit/d2692c435f016058484a6e03b4b4b00557e4dda2))
* update of running session docs ([929c658](https://github.com/uzh-bf/klicker-uzh/commit/929c658b488327ce4b35b8e3ced5bbc430880da8))
* updated audience view doc page ([0914601](https://github.com/uzh-bf/klicker-uzh/commit/09146014fb37b77e69f532ef1099211bd4b06e4b))
* updated screenshot and content for question pool documentation ([4880ba0](https://github.com/uzh-bf/klicker-uzh/commit/4880ba0e6c4760a1fd285306f754501b59ef49ae))
* upgrade dependencies for documentation ([87d5844](https://github.com/uzh-bf/klicker-uzh/commit/87d5844f4eed9e583167105323cb95f5c2b083a5))


### Enhancements

* **frontend:** allow parametrized display of the AAI login button based on NEXT_PUBLIC_DISPLAY_AAI ([8ba7a83](https://github.com/uzh-bf/klicker-uzh/commit/8ba7a83c8bb7dca746a352e368efe98cb4781a5d))
* **landing:** add compression and caching rules to .htaccess ([8d7f4cd](https://github.com/uzh-bf/klicker-uzh/commit/8d7f4cdc4f60deeed54376bca553671fc9b4d39c))


### Other

* added scrolling in case of overflow on feedback site for past sessions ([9fe8199](https://github.com/uzh-bf/klicker-uzh/commit/9fe8199f5883224e807e2f8bc987d0b170032b99))
* enable polling on the running session screen ([b7c732c](https://github.com/uzh-bf/klicker-uzh/commit/b7c732c98c7c3a27af364b36f8eebece7fdf62ef))
* improved landing site with a call for involvement and some styling ([d9139e8](https://github.com/uzh-bf/klicker-uzh/commit/d9139e8e916a8cabbca5491c866ff18fc26ff64a))
* improved styling of feedback channel for display of past sessions ([41b92b5](https://github.com/uzh-bf/klicker-uzh/commit/41b92b5ae884b6c1e12be209002ed1cdce9af5e3))
* internationalization for running session audience interaction panel ([55f3bd5](https://github.com/uzh-bf/klicker-uzh/commit/55f3bd5147e14c3c03eca29f24b9da4211faec08))
* lockfile maintenance ([454fe8b](https://github.com/uzh-bf/klicker-uzh/commit/454fe8b891ecedd756f62fa52cb755eb991a562b))
* make husky scripts executable ([d9ba16b](https://github.com/uzh-bf/klicker-uzh/commit/d9ba16b05811b783f236113d7fec6d171ca76d70))
* **release:** 1.6.0-alpha.10 ([6bbe387](https://github.com/uzh-bf/klicker-uzh/commit/6bbe3876f19bf93f7e40bd5133fb9ce163b78cef))
* **release:** 1.6.0-alpha.9 ([69ff0d7](https://github.com/uzh-bf/klicker-uzh/commit/69ff0d73e35347ace76fb42b2ebc1a71b28750f0))
* small upgrades and improvements ([ad764cb](https://github.com/uzh-bf/klicker-uzh/commit/ad764cb6f235e81f59483ddb7d9f25b1500fbfe5))

## [1.6.0-alpha.10](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.8...v1.6.0-alpha.10) (2021-09-03)


### Features

* added button to reach 'pinned feedback' page from running session view ([13a9faa](https://github.com/uzh-bf/klicker-uzh/commit/13a9faa4513caddc4f7ace7f5d63c8716fb196f7))
* rework react-intl integration and migrate to ts-node ([#2533](https://github.com/uzh-bf/klicker-uzh/issues/2533)) ([f9fc0ae](https://github.com/uzh-bf/klicker-uzh/commit/f9fc0ae30b88515f37cf483fe9c36b590a59b955))


### Dependencies

* perform minor and non-critical deps upgrades ([4ec66e7](https://github.com/uzh-bf/klicker-uzh/commit/4ec66e7c114a563773b87f2f049d3348378b77c3))
* upgrade husky ([1399f20](https://github.com/uzh-bf/klicker-uzh/commit/1399f20c5995d7e79e425f20c19611bd6bf3b292))


### Other

* improved landing site with a call for involvement and some styling ([d9139e8](https://github.com/uzh-bf/klicker-uzh/commit/d9139e8e916a8cabbca5491c866ff18fc26ff64a))
* lockfile maintenance ([454fe8b](https://github.com/uzh-bf/klicker-uzh/commit/454fe8b891ecedd756f62fa52cb755eb991a562b))
* make husky scripts executable ([d9ba16b](https://github.com/uzh-bf/klicker-uzh/commit/d9ba16b05811b783f236113d7fec6d171ca76d70))
* **release:** 1.6.0-alpha.9 ([69ff0d7](https://github.com/uzh-bf/klicker-uzh/commit/69ff0d73e35347ace76fb42b2ebc1a71b28750f0))


### Documentation

* ensure that there is a type for EasyForms ([91fce9a](https://github.com/uzh-bf/klicker-uzh/commit/91fce9aa83841e0d1f60601987bc1ca1a77bc420))
* update audience interaction documentation ([b156240](https://github.com/uzh-bf/klicker-uzh/commit/b156240da9a908783f2cd968d9064b4401d0e659))
* update evaluation documentation ([1c6162e](https://github.com/uzh-bf/klicker-uzh/commit/1c6162e16f88af1f880fa9499cc3a8e8ac6670d3))
* update of audience interaction docs ([d2692c4](https://github.com/uzh-bf/klicker-uzh/commit/d2692c435f016058484a6e03b4b4b00557e4dda2))
* update of running session docs ([929c658](https://github.com/uzh-bf/klicker-uzh/commit/929c658b488327ce4b35b8e3ced5bbc430880da8))
* updated audience view doc page ([0914601](https://github.com/uzh-bf/klicker-uzh/commit/09146014fb37b77e69f532ef1099211bd4b06e4b))
* upgrade dependencies for documentation ([87d5844](https://github.com/uzh-bf/klicker-uzh/commit/87d5844f4eed9e583167105323cb95f5c2b083a5))


### Deployment

* update node command in dockerfile ([d505c0f](https://github.com/uzh-bf/klicker-uzh/commit/d505c0f896e2472681e5418b5cb0987051030e03))

## [1.6.0-alpha.9](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.8...v1.6.0-alpha.9) (2021-09-03)


### Features

* added button to reach 'pinned feedback' page from running session view ([13a9faa](https://github.com/uzh-bf/klicker-uzh/commit/13a9faa4513caddc4f7ace7f5d63c8716fb196f7))
* rework react-intl integration and migrate to ts-node ([#2533](https://github.com/uzh-bf/klicker-uzh/issues/2533)) ([f9fc0ae](https://github.com/uzh-bf/klicker-uzh/commit/f9fc0ae30b88515f37cf483fe9c36b590a59b955))


### Dependencies

* perform minor and non-critical deps upgrades ([4ec66e7](https://github.com/uzh-bf/klicker-uzh/commit/4ec66e7c114a563773b87f2f049d3348378b77c3))
* upgrade husky ([1399f20](https://github.com/uzh-bf/klicker-uzh/commit/1399f20c5995d7e79e425f20c19611bd6bf3b292))


### Documentation

* update audience interaction documentation ([b156240](https://github.com/uzh-bf/klicker-uzh/commit/b156240da9a908783f2cd968d9064b4401d0e659))
* update evaluation documentation ([1c6162e](https://github.com/uzh-bf/klicker-uzh/commit/1c6162e16f88af1f880fa9499cc3a8e8ac6670d3))
* update of audience interaction docs ([d2692c4](https://github.com/uzh-bf/klicker-uzh/commit/d2692c435f016058484a6e03b4b4b00557e4dda2))
* update of running session docs ([929c658](https://github.com/uzh-bf/klicker-uzh/commit/929c658b488327ce4b35b8e3ced5bbc430880da8))
* updated audience view doc page ([0914601](https://github.com/uzh-bf/klicker-uzh/commit/09146014fb37b77e69f532ef1099211bd4b06e4b))


### Other

* improved landing site with a call for involvement and some styling ([d9139e8](https://github.com/uzh-bf/klicker-uzh/commit/d9139e8e916a8cabbca5491c866ff18fc26ff64a))
* lockfile maintenance ([454fe8b](https://github.com/uzh-bf/klicker-uzh/commit/454fe8b891ecedd756f62fa52cb755eb991a562b))
* make husky scripts executable ([d9ba16b](https://github.com/uzh-bf/klicker-uzh/commit/d9ba16b05811b783f236113d7fec6d171ca76d70))

## [1.6.0-alpha.8](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.7...v1.6.0-alpha.8) (2021-09-02)


### Features

* display the feedback channel by default if a session is feedback only ([6e9b214](https://github.com/uzh-bf/klicker-uzh/commit/6e9b214fd4ab6305a10ee4acbe8b2a4f83c4714f))
* implement basic print layout for the running session screen ([0ecd5c7](https://github.com/uzh-bf/klicker-uzh/commit/0ecd5c797cbee0241667f2dd3416d8c9d1e17f2e))


### Deployment

* ensure that autoscalers could be created ([aca6a88](https://github.com/uzh-bf/klicker-uzh/commit/aca6a8874e2fdaccb1d039794cf326c10ac34655))


### Other

* fixed typos in documentation and missing number on docs image ([b4e7ae9](https://github.com/uzh-bf/klicker-uzh/commit/b4e7ae977714fbff8a1d8b4a3102e24001fdff43))


### Enhancements

* add a filter for unpublished feedbacks ([671f2a1](https://github.com/uzh-bf/klicker-uzh/commit/671f2a1a17831addcdb9d409d142be8311bef4ab))
* ensure that session timeline folds if no blocks are added ([118ddb1](https://github.com/uzh-bf/klicker-uzh/commit/118ddb1a740b1a7f521e9922116fd492a16c8c66))
* hide the feedback channel title on mobile ([3880bb2](https://github.com/uzh-bf/klicker-uzh/commit/3880bb28db2c9864b55dac1985c1db5efc29bfbd))
* make refetching unnecessary for simple lecturer interactions in Q&A ([8d3e4d2](https://github.com/uzh-bf/klicker-uzh/commit/8d3e4d28637454c6e7743b294d5d00bd3dc3c70a))

## [1.6.0-alpha.7](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.6...v1.6.0-alpha.7) (2021-08-30)


### Other

* chart version bump ([96c4057](https://github.com/uzh-bf/klicker-uzh/commit/96c40578eafb20ca51c0e80460333d34edf354a3))

## [1.6.0-alpha.6](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.5...v1.6.0-alpha.6) (2021-08-30)


### Features

* add upvoting and reactions on feedback responses ([96e5362](https://github.com/uzh-bf/klicker-uzh/commit/96e5362ff927ec5508d76cb522dddcec44622927))


### Bug Fixes

* ensure sorting works for both recency and votes ([5f064d1](https://github.com/uzh-bf/klicker-uzh/commit/5f064d1a49130104d4b2a97528d6bfccae53cc94))
* issue where upvotedFeedbacks might not exist ([fac8b99](https://github.com/uzh-bf/klicker-uzh/commit/fac8b99be9681dd825399b1e7ccfc8d04e21fd11))
* pull upvote and reaction state to the page level ([ed9a4f4](https://github.com/uzh-bf/klicker-uzh/commit/ed9a4f478d6b7cb9354535feb177b821209716a7))
* sorting and refetch on join page ([1d80ad4](https://github.com/uzh-bf/klicker-uzh/commit/1d80ad403a1fa3ee6836d9666dbfa609b6d20d58))
* undo upvoting ([17babd1](https://github.com/uzh-bf/klicker-uzh/commit/17babd18a523f2dacf3f574d57af6d2d9b01c652))


### Other

* consistently poll running session every 5 seconds ([fc85937](https://github.com/uzh-bf/klicker-uzh/commit/fc85937fa7cef39f86644cb568be7fba23e6a195))
* reduce default join page caching to 10 seconds ([3314eec](https://github.com/uzh-bf/klicker-uzh/commit/3314eec788a81abfd8fc8e96a6ca12d18264de9b))
* subscription updates for q&a ([f466505](https://github.com/uzh-bf/klicker-uzh/commit/f4665051e9b014b7cc0be24e9718ca64afa546eb))


### Enhancements

* add hover and onclick on the entire feedback in q&a ([f21723a](https://github.com/uzh-bf/klicker-uzh/commit/f21723ab39fe257b6be527d0947ce98d05a9d894))
* hide vote count on student view ([df84d55](https://github.com/uzh-bf/klicker-uzh/commit/df84d55be001c6cb3a1d876bf08595f7400965f2))
* make feedbacks public by default ([bade382](https://github.com/uzh-bf/klicker-uzh/commit/bade3828f10b1312f912cf89718b7a525d4b547e))
* reset the session so feedback channel is public by default ([bc85e25](https://github.com/uzh-bf/klicker-uzh/commit/bc85e252282b1eb8cad1057210aac9e2ac5515ad))
* show resolved by default ([caa5ce9](https://github.com/uzh-bf/klicker-uzh/commit/caa5ce9c5257f8f722957b634a31218d92bd9551))

## [1.6.0-alpha.5](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.4...v1.6.0-alpha.5) (2021-08-29)


### Dependencies

* ensure that tailwind and other dependencies are in production deps ([df4c23b](https://github.com/uzh-bf/klicker-uzh/commit/df4c23bfffc693bed197394033f59e229e0b839c))

## [1.6.0-alpha.4](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.3...v1.6.0-alpha.4) (2021-08-29)


### Build and CI

* add missing config files to docker image ([2023958](https://github.com/uzh-bf/klicker-uzh/commit/20239585718d83c03750bbafe76c77917c26d013))


### Other

* bump chart version ([b5124a7](https://github.com/uzh-bf/klicker-uzh/commit/b5124a7f9dab8edd4ab0b9216885d4baaf256dc8))

## [1.6.0-alpha.3](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.2...v1.6.0-alpha.3) (2021-08-29)


### Bug Fixes

* include semantic-ui library in purgecss config ([16e125a](https://github.com/uzh-bf/klicker-uzh/commit/16e125a1b690d0abd54e5c345ddbf3ffb5521e53))

## [1.6.0-alpha.2](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.1...v1.6.0-alpha.2) (2021-08-29)


### Bug Fixes

* import semantic in globals.css to prevent it being purged incorrectly ([ca3b7a9](https://github.com/uzh-bf/klicker-uzh/commit/ca3b7a9144891aa525860e0ad82a1df49a61bc3f))


### Enhancements

* remove the protocol from startup logging as it is not relevant ([91b6728](https://github.com/uzh-bf/klicker-uzh/commit/91b6728831ba0f08742d447cd5163cd6180f6018))
* update the helm chart for a working staging deployment ([450b7ad](https://github.com/uzh-bf/klicker-uzh/commit/450b7adffb9e705d95dfc4cb77f49ac5a83c663a))


### Other

* add cors and rate limit to config map for backend ([e1bb328](https://github.com/uzh-bf/klicker-uzh/commit/e1bb3287eab91f3bab5170fa6056a58a20cfddf4))
* bump the version of klicker-uzh to use in the helm chart ([dbc3220](https://github.com/uzh-bf/klicker-uzh/commit/dbc322066cdbaf27d5167d58b9f9d6f3be95e3d2))
* ensure that git hooks are skipped on releasing ([dce54f3](https://github.com/uzh-bf/klicker-uzh/commit/dce54f3a9f57acfa3cb3845df668e87127a6c550))
* remove legacy helm chart and update app version ([bf82391](https://github.com/uzh-bf/klicker-uzh/commit/bf82391064540129e23e396cf2e8a71a2f222355))

## [1.6.0-alpha.1](https://github.com/uzh-bf/klicker-uzh/compare/v1.6.0-alpha.0...v1.6.0-alpha.1) (2021-08-29)


### Features

* add a page that displays pinned feedbacks ([d47003d](https://github.com/uzh-bf/klicker-uzh/commit/d47003da35e50beab980beca91490c38e9277f63))
* add a query that returns pinned feedbacks ([df43f99](https://github.com/uzh-bf/klicker-uzh/commit/df43f99a31e91812bf4af5ce17ea5b785271b324))
* add local interactions for upvotes and response reactions ([15afb63](https://github.com/uzh-bf/klicker-uzh/commit/15afb631f46fb6483701855d8d7a10aef088831d))
* add tls option for redis connections ([f2b4876](https://github.com/uzh-bf/klicker-uzh/commit/f2b4876383020715439faa34dea9cd1525675424))
* allow moderating feedbacks to publish and unpublish ([e95b610](https://github.com/uzh-bf/klicker-uzh/commit/e95b61025f36c95c0f2fd7452fd3fb44a7d53283))
* implement api for feedback response deletion ([d944d10](https://github.com/uzh-bf/klicker-uzh/commit/d944d1097559b86b3b4213b6c9ec3dfbf235ae65))
* implement basic q&a area in the running session cockpit ([9cba464](https://github.com/uzh-bf/klicker-uzh/commit/9cba4640b2cff9678789002fa7dc54e9daafbd2c))
* implement search and filtering for feedbacks with useEffect ([eb2b719](https://github.com/uzh-bf/klicker-uzh/commit/eb2b71957960b7b88b19e13f1633094aeb8e07e9))
* implement service for resolving, pinning, and responding to feedbacks ([0c3441c](https://github.com/uzh-bf/klicker-uzh/commit/0c3441cb28122fde528cd2e34d2e5819b7dc255b))
* implement the student view for Q&A ([5520a18](https://github.com/uzh-bf/klicker-uzh/commit/5520a18b2df2dff34025bdf57155dd236b595362))
* implement ui for feedback response deletion ([ccae70d](https://github.com/uzh-bf/klicker-uzh/commit/ccae70d20e35fffc9d38f503f8f77ad8e469f6f0))


### Bug Fixes

* add missing fields to the session update subscription ([6c638f9](https://github.com/uzh-bf/klicker-uzh/commit/6c638f93ac62d5cad910e3a88d5ec6fb8f23a1f6))
* ensure that _document uses next Html ([3ff5a5b](https://github.com/uzh-bf/klicker-uzh/commit/3ff5a5b40195def1dc56f9493ab20b0d7f59fd04))
* move viewport back to _app ([ca3a43a](https://github.com/uzh-bf/klicker-uzh/commit/ca3a43a829a36bb42cf7bdb57e8bc53444fb613a))
* remove npm run lint from lint-staged ([083f670](https://github.com/uzh-bf/klicker-uzh/commit/083f6705281aea79b57b532e998d6dd38a30127e))
* resolve and unpin a feedback if a response is given ([914e5a4](https://github.com/uzh-bf/klicker-uzh/commit/914e5a4bfe38c5ee18fd9c6bc5be5c5848f77613))
* specify max bar size as number to satisfy types ([6dc2dd8](https://github.com/uzh-bf/klicker-uzh/commit/6dc2dd8c0c1b0f50e69cd431286aebc1bd65bbd2))
* type issue with resolvedAt ([c065c20](https://github.com/uzh-bf/klicker-uzh/commit/c065c207ecfcd211a33c5178145e8f55d5f3b78c))
* type issues and evaluation page with confusion charts ([5b4d44d](https://github.com/uzh-bf/klicker-uzh/commit/5b4d44d1523a7ea800aec605551ca548b4269ea2))


### Refactors

* extract our own type declarations into a separate file ([479012a](https://github.com/uzh-bf/klicker-uzh/commit/479012a358499d7e99c50d48733825f2166311ac))
* migrate to official sentry/nextjs integration ([3c833f7](https://github.com/uzh-bf/klicker-uzh/commit/3c833f76c3a84ae3b9c5d14f013c044ab8e1fab4))
* move feedback components to interaction directory and partially refactor to tailwind ([5611f31](https://github.com/uzh-bf/klicker-uzh/commit/5611f31398cfb236e99ee83b2e80512a9a762d7d))
* move from classnames to clsx and fix miscellaneous lint errors ([8a51ded](https://github.com/uzh-bf/klicker-uzh/commit/8a51ded2c0cf9b2a62161825a438ed1d7446c8b4))
* move global css to _app ([44bd8d0](https://github.com/uzh-bf/klicker-uzh/commit/44bd8d01cd2e10fc44cf6e7b4799cce58950031b))
* switch to graphql-ws and ws for subscriptions ([f7daddb](https://github.com/uzh-bf/klicker-uzh/commit/f7daddb96d8127c3679b45f909532fcfdafe4377))
* use redis db0 for everything ([c729754](https://github.com/uzh-bf/klicker-uzh/commit/c7297545b9bb05f294335fde6647a5bdb47504b8))


### Enhancements

* allow for deletion of responses and feedbacks ([53012d2](https://github.com/uzh-bf/klicker-uzh/commit/53012d2fb34b09da9dc6f0632ebdc5c3bc9e46fe))
* automatically publish and set resolvedAt when responding to a feedback ([563b991](https://github.com/uzh-bf/klicker-uzh/commit/563b991440346714d1f186d4ba39b4fe146510f8))
* disable response input if a feedback is resolved ([603df5e](https://github.com/uzh-bf/klicker-uzh/commit/603df5e944eecce4c1ab9d1a928e063fb583c7c6))
* display info messages if no feedbacks are available or all filtered out ([ed1e6ff](https://github.com/uzh-bf/klicker-uzh/commit/ed1e6ff5119bb2f274ebc58e2a07fb9dbfa133a7))
* display the number of responses given on a feedback and close editing if responded ([6eae752](https://github.com/uzh-bf/klicker-uzh/commit/6eae752b173c3ff36fb50a1aa638f48fa6312a84))
* exchange icons for postive and negative response reactions ([b8c95ca](https://github.com/uzh-bf/klicker-uzh/commit/b8c95cad959f7b78174b5d842d81ad5b1917da80))
* hide resolved feedbacks by default filter ([c3f056c](https://github.com/uzh-bf/klicker-uzh/commit/c3f056c2bd49b2367329b37ed9735521a4e77bbd))
* integrate the resolved status on the join page ([9a96a5e](https://github.com/uzh-bf/klicker-uzh/commit/9a96a5ed3c2babb50d2902e00a6934e8946060fd))


### Dependencies

* add graphql-ws and ws ([c538fc6](https://github.com/uzh-bf/klicker-uzh/commit/c538fc6f6e028117d53ae98c18c74da347b053e7))
* set up tailwind typography plugin ([48a194e](https://github.com/uzh-bf/klicker-uzh/commit/48a194e23d0cea7d6f288a32d8e5d5a388b450b8))
* upgrade mongodb and mongoose ([d01413e](https://github.com/uzh-bf/klicker-uzh/commit/d01413e95e2514331bb80e96259535d1b12c03bb))
* upgrade next and react ([0dcbe62](https://github.com/uzh-bf/klicker-uzh/commit/0dcbe623a1ee8a2dfff14a55899006f215bf687e))
* upgrade to node 14 ([4c57413](https://github.com/uzh-bf/klicker-uzh/commit/4c574137e3601914f5e135a027253b42ca36fad5))


### Deployment

* add python migrations for redis databases ([f178254](https://github.com/uzh-bf/klicker-uzh/commit/f178254c260f2af2e852e69596ae74766e7554c1))
* adjust the protocol based on https.enabled ([f932c3c](https://github.com/uzh-bf/klicker-uzh/commit/f932c3c6e8b3d6052fe062467bd1975b37192201))
* update chart for staging values and latest app adjustment ([f18b9c4](https://github.com/uzh-bf/klicker-uzh/commit/f18b9c4158b55a608df7eb9673db8c38a9c410e3))
* use https.enabled for APP_HTTPS and APP_SECURE ([b35a6a5](https://github.com/uzh-bf/klicker-uzh/commit/b35a6a5ef2fd1e16d4b4e2db6154ae5ecacdc4a9))


### Other

* add nvmrc files for node 12 ([e33b7db](https://github.com/uzh-bf/klicker-uzh/commit/e33b7db71c1325f882bb5d724c5b9af0932e66e8))
* add prerelease and dry-run release commands ([c28d7cb](https://github.com/uzh-bf/klicker-uzh/commit/c28d7cbb6e802f05150164fa1e6fc0af8019f04e))
* don't use redis for backend rate limiting to reduce requests ([01c35ce](https://github.com/uzh-bf/klicker-uzh/commit/01c35cee3e42799025c6630420fcea0e9ca885db))
* fix structure of top-level package.json ([ac21d48](https://github.com/uzh-bf/klicker-uzh/commit/ac21d484c5029aaa73c729962454919ad2fe6680))
* ignore stories in docker build ([01de86c](https://github.com/uzh-bf/klicker-uzh/commit/01de86cb99ba41b1879918338f4a77537e0ade72))
* improve feedback and response layout with visual elements and add stubs for response reactions ([b02b8a1](https://github.com/uzh-bf/klicker-uzh/commit/b02b8a1c155946ec47121cbc056caa0bb72cd731))
* initial approaches to sorting and filtering in q&a ([bf7a61d](https://github.com/uzh-bf/klicker-uzh/commit/bf7a61d06d501450393ac913a90800f0d041e699))
* install and prepare tailwindcss ([5006cdc](https://github.com/uzh-bf/klicker-uzh/commit/5006cdc741829a8612b8f283e85f714bea38b816))
* move @next/bundle-analyzer to production deps ([e0007a9](https://github.com/uzh-bf/klicker-uzh/commit/e0007a922a4476bef0b1b9a4f61fab39cb4a9f14))
* move postcss to production dep ([7a686a7](https://github.com/uzh-bf/klicker-uzh/commit/7a686a7743e38928b79a6fa4395165d7137545f0))
* move to next/lint as much as possible ([94970c8](https://github.com/uzh-bf/klicker-uzh/commit/94970c854572972fe9132264c267932b62004fef))
* rebuild semantic ([0d54108](https://github.com/uzh-bf/klicker-uzh/commit/0d54108567b50453b42818a74de362f8e3f49391))
* remove initial changelog contents (bloat) ([6e0ee55](https://github.com/uzh-bf/klicker-uzh/commit/6e0ee5570fce82245121830ccf360358b4e7d3a1))
* remove slaask integration ([d08b8a8](https://github.com/uzh-bf/klicker-uzh/commit/d08b8a82ee86572ce23836445b36764611909c9f))
* remove usage of Head.rewind ([5f3ce7e](https://github.com/uzh-bf/klicker-uzh/commit/5f3ce7e64c05e322bd7fc34a1a1355f73b0adf00))
* rename github actions ([a6e2b9f](https://github.com/uzh-bf/klicker-uzh/commit/a6e2b9fdc25b7cfad362ce7c030fc63a838ac285))
* simplify next and babel configs ([916b3b3](https://github.com/uzh-bf/klicker-uzh/commit/916b3b3f6c897d8fe1674f6f5507886631b38ace))
* update lint command to run next lint ([c9d62c9](https://github.com/uzh-bf/klicker-uzh/commit/c9d62c94f8abdf6e3cc35518dfc4ef598b05e24a))
* update lockfile in landing ([7a25a85](https://github.com/uzh-bf/klicker-uzh/commit/7a25a85bb9479c4de79c7589f993814d881e1723))
* update types of version settings ([505f52a](https://github.com/uzh-bf/klicker-uzh/commit/505f52a214cc745a27f0660538b07f99dc280d40))
* upgrade dependencies and improve lighthouse scores ([5170109](https://github.com/uzh-bf/klicker-uzh/commit/5170109b738c21aad5bea96041159272d0ff609f))

## [1.6.0-alpha.0](https://github.com/uzh-bf/klicker-uzh/compare/v1.5.4...v1.6.0-alpha.0) (2021-08-09)

Initial release with standard-version
