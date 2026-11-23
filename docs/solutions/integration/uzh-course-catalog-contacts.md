---
type: Solution
title: Read module contacts from the UZH course catalogue
description: The course catalogue (courses.uzh.ch) exposes anonymous SAP OData services that return a module's responsible persons, lecturers and their e-mail addresses; only the UI's exact $expand strings work.
module: graphql
date: 2026-11-23
problem_type: integration
severity: medium
tags:
  - course-catalogue
  - vvz
  - chatbot
  - video-ingestion
  - personal-data
---

# Read module contacts from the UZH course catalogue

## Context

Chatbot video sources need approval from a course's responsible person or a
lecturer, as listed in the UZH course catalogue (Vorlesungsverzeichnis, VVZ).
`packages/graphql/src/services/uzhCourseCatalog.ts` turns a catalogue link into
a dated snapshot of the module and those contacts.

## What the catalogue offers

`https://courses.uzh.ch` redirects to a SAP UI5 app at
`https://studentservices.uzh.ch/uzh/anonym/vvz/index.html`. There is no
documented API or export, but the app reads anonymous OData services that need
no authentication:

- OData v2 `/sap/opu/odata/uzh/vvz_data_srv/` for details: `SmDetailsSet`
  (module), `EDetailsSet` (event), `PDetailsSet` (person, including `Email`),
  `SemesterSet`.
- OData v4 `/sap/opu/zodatav4/sap/zcm_vvz_v4_ui/srvd/sap/zsb_vvz/0001/` for
  search: `SMSearch`, `ESearch`, `PSearch` with `$filter`/`contains()`. The
  client does not use it yet; it is the way to find a module by title.

## Quirks the client depends on

- **Only the UI's exact `$expand` strings work.** `SmDetailsSet` needs
  `Partof,Organizations,Responsible,Events,Events/Persons,OfferPeriods`,
  `PDetailsSet` needs `Events,Events/Persons,Responsible` (it answers 501
  without an expand), `EDetailsSet` needs
  `Rooms,Persons,Schedule,Schedule/Rooms,Schedule/Persons,Modules,Links`.
  A narrower expand either fails with 500 or, worse, answers 200 with empty
  `Responsible`/`Events` sets. The client treats missing navigation sets as an
  unexpected response.
- Send `sap-client=001` and `Accept: application/json`. Adding `$format=json`
  together with an expand makes some calls fail.
- `PDetails.Email` is an HTML anchor (`<a href="mailto:…">…</a>`) and is empty
  when a person hides it.
- A semester is `(PiqYear, PiqSession)`: `PiqYear` is the start year of the
  academic year, session `003` is fall (HS), `004` spring (FS). FS27 is
  `(2026, 004)`. `SemesterSet.IsCurrent = 1` marks the newest published
  semester, not the one in progress, so the client maps dates itself.
- Module ids (`SmObjId`) are stable across semesters; titles and event ids
  change. A module not offered in a semester comes back with
  `SmObjId = '00000000'` instead of 404. Contacts differ between semesters, so
  a snapshot is only valid for the semester it was taken for.

## Rules for callers

- The snapshot holds personal data. Store it with the approval request it
  backs, never log it, and keep real catalogue responses out of tests and
  fixtures (the unit tests use synthetic data).
- Re-read the catalogue for each new semester; a changed contact list needs a
  new approval.
- The runtime that calls the catalogue needs egress to
  `studentservices.uzh.ch`.
