# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
