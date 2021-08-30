# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
