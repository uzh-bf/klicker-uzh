import { describe, expect, it, vi } from 'vitest'
import {
  buildCatalogModuleUrl,
  createUzhCourseCatalogClient,
  formatSemester,
  parseCatalogEmail,
  parseCatalogUrl,
  parseSemesterLabel,
  semesterForDate,
  UzhCourseCatalogError,
} from '../src/services/uzhCourseCatalog.js'

// Synthetic catalogue data only. Never paste real catalogue responses here:
// they contain names and e-mail addresses of real people.
const MODULE_ID = '51000001'
const EVENT_ID = '52000001'
const FALL_26 = { piqYear: '2026', piqSession: '003' } as const

function person(objid: string, firstName: string, lastName: string) {
  return {
    Objid: objid,
    FirstName: firstName,
    LastName: lastName,
    Title: 'Prof. Dr.',
    Rank: '000',
  }
}

function moduleEntity(overrides: Record<string, unknown> = {}) {
  return {
    SmObjId: MODULE_ID,
    SmText: 'Synthetic Finance I (L+E)',
    SmShort: '03SMTEST01',
    OfferpatternText: '1 Semester (Every Fall Semester)',
    Organizations: { results: [{ OText: 'Department of Testing' }] },
    Responsible: { results: [person('01000001', 'Ada', 'Responsible')] },
    Events: {
      results: [
        {
          Objid: EVENT_ID,
          EStext: 'Synthetic Finance I (L+E)',
          EShort: '03VUTEST01',
          CategoryText: 'Lecture with Practical Exercises',
          ScheduleText: 'Mon 14:00-15:45',
          Persons: {
            results: [
              person('01000001', 'Ada', 'Responsible'),
              person('01000002', 'Bob', 'Lecturer'),
            ],
          },
        },
      ],
    },
    ...overrides,
  }
}

const PERSONS: Record<string, Record<string, unknown>> = {
  '01000001': {
    Email:
      '<a href="mailto:ada.responsible@example.org">ada.responsible@example.org</a>',
    FunctionTxt: 'Professor of Testing',
    OrgText: 'Faculty of Testing',
  },
  '01000002': {
    Email: '',
    FunctionTxt: 'Lecturer',
    OrgText: 'Faculty of Testing',
  },
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

function createFetch(
  handlers: { module?: (url: string) => unknown; event?: unknown } = {}
) {
  return vi.fn(async (url: string) => {
    if (url.includes('SmDetailsSet(')) {
      return jsonResponse({ d: handlers.module?.(url) ?? moduleEntity() })
    }
    if (url.includes('EDetailsSet(')) {
      return jsonResponse({
        d: handlers.event ?? {
          Modules: { results: [{ SmObjId: MODULE_ID }] },
        },
      })
    }
    const personId = /PDetailsSet\(Objid='(\d+)'/.exec(url)?.[1]
    if (personId && PERSONS[personId]) {
      return jsonResponse({ d: { Objid: personId, ...PERSONS[personId] } })
    }
    return jsonResponse({ error: 'not found' }, 404)
  })
}

describe('parseCatalogUrl', () => {
  it('parses courses.uzh.ch module links with a semester', () => {
    expect(
      parseCatalogUrl(
        `https://courses.uzh.ch/#/details/2026/003/SM/${MODULE_ID}`
      )
    ).toEqual({ objectType: 'SM', objectId: MODULE_ID, semester: FALL_26 })
  })

  it('parses the studentservices redirect target and event links', () => {
    expect(
      parseCatalogUrl(
        `https://studentservices.uzh.ch/uzh/anonym/vvz/index.html#/details/2026/004/E/${EVENT_ID}/50000003/Org`
      )
    ).toEqual({
      objectType: 'E',
      objectId: EVENT_ID,
      semester: { piqYear: '2026', piqSession: '004' },
    })
  })

  it('accepts links without a semester', () => {
    expect(
      parseCatalogUrl(`https://courses.uzh.ch/#/details/SM/${MODULE_ID}`)
    ).toEqual({ objectType: 'SM', objectId: MODULE_ID, semester: null })
  })

  it.each([
    'not a url',
    `http://courses.uzh.ch/#/details/2026/003/SM/${MODULE_ID}`,
    `https://courses.example.org/#/details/2026/003/SM/${MODULE_ID}`,
    'https://courses.uzh.ch/#/details/2026/003/P/01000001',
    'https://courses.uzh.ch/',
  ])('rejects %s', (url) => {
    expect(() => parseCatalogUrl(url)).toThrow(UzhCourseCatalogError)
  })
})

describe('semester helpers', () => {
  it.each([
    ['HS26', FALL_26],
    ['hs2026', FALL_26],
    ['Fall Semester 2026', FALL_26],
    ['FS27', { piqYear: '2026', piqSession: '004' }],
    ['Spring Semester 2027', { piqYear: '2026', piqSession: '004' }],
    ['Frühjahrssemester 2027', { piqYear: '2026', piqSession: '004' }],
  ])('parses %s', (label, expected) => {
    expect(parseSemesterLabel(label)).toEqual(expected)
  })

  it.each([
    ['2026-09-15', FALL_26],
    ['2026-08-01', FALL_26],
    ['2027-01-31', FALL_26],
    ['2027-02-01', { piqYear: '2026', piqSession: '004' }],
    ['2027-07-31', { piqYear: '2026', piqSession: '004' }],
  ])('maps %s to its semester', (date, expected) => {
    expect(semesterForDate(new Date(`${date}T12:00:00Z`))).toEqual(expected)
  })

  it('formats semesters as HS/FS labels and round-trips', () => {
    expect(formatSemester(FALL_26)).toBe('HS26')
    expect(formatSemester({ piqYear: '2026', piqSession: '004' })).toBe('FS27')
    expect(parseSemesterLabel(formatSemester(FALL_26))).toEqual(FALL_26)
  })

  it('builds canonical module links', () => {
    expect(buildCatalogModuleUrl(MODULE_ID, FALL_26)).toBe(
      `https://courses.uzh.ch/#/details/2026/003/SM/${MODULE_ID}`
    )
  })
})

describe('parseCatalogEmail', () => {
  it.each([
    ['<a href="mailto:a.b@example.org">a.b@example.org</a>', 'a.b@example.org'],
    ['<a href="mailto:A.B@Example.org">x</a>', 'a.b@example.org'],
    ['<a href=&quot;mailto:a.b@example.org&quot;>x</a>', 'a.b@example.org'],
    ['a.b@example.org', 'a.b@example.org'],
    ['', null],
    [undefined, null],
    ['<a href="https://example.org">no mail</a>', null],
  ])('parses %s', (raw, expected) => {
    expect(parseCatalogEmail(raw)).toBe(expected)
  })
})

describe('getModuleContacts', () => {
  const now = () => new Date('2026-11-23T12:00:00Z')

  it('returns responsible persons and lecturers, merged by person', async () => {
    const fetch = createFetch()
    const client = createUzhCourseCatalogClient({ fetch, now })

    const snapshot = await client.getModuleContacts({
      catalogUrl: `https://courses.uzh.ch/#/details/2026/003/SM/${MODULE_ID}`,
    })

    expect(snapshot).toMatchObject({
      moduleId: MODULE_ID,
      semester: FALL_26,
      semesterLabel: 'HS26',
      title: 'Synthetic Finance I (L+E)',
      shortName: '03SMTEST01',
      offeringOrganization: 'Department of Testing',
      retrievedAt: '2026-11-23T12:00:00.000Z',
      events: [{ eventId: EVENT_ID, shortName: '03VUTEST01' }],
    })
    expect(snapshot.contacts).toEqual([
      expect.objectContaining({
        personId: '01000001',
        roles: ['RESPONSIBLE', 'LECTURER'],
        email: 'ada.responsible@example.org',
        function: 'Professor of Testing',
        eventIds: [EVENT_ID],
      }),
      expect.objectContaining({
        personId: '01000002',
        roles: ['LECTURER'],
        email: null,
      }),
    ])
    expect(snapshot.warnings).toEqual(['Person 01000002 has no public e-mail'])
  })

  it('sends the exact expands the catalogue backend supports', async () => {
    const fetch = createFetch()
    await createUzhCourseCatalogClient({ fetch, now }).getModuleContacts({
      catalogUrl: `https://courses.uzh.ch/#/details/2026/003/SM/${MODULE_ID}`,
    })

    const urls = fetch.mock.calls.map(([url]) => decodeURIComponent(url))
    expect(urls[0]).toBe(
      `https://studentservices.uzh.ch/sap/opu/odata/uzh/vvz_data_srv/SmDetailsSet(SmObjId='${MODULE_ID}',PiqYear='2026',PiqSession='003')?sap-client=001&$expand=Partof,Organizations,Responsible,Events,Events/Persons,OfferPeriods`
    )
    expect(urls.filter((url) => url.includes('PDetailsSet'))).toHaveLength(2)
    for (const url of urls.filter((url) => url.includes('PDetailsSet'))) {
      expect(url).toContain('$expand=Events,Events/Persons,Responsible')
    }
  })

  it('resolves a link from an earlier run against the requested semester', async () => {
    const fetch = createFetch()
    const snapshot = await createUzhCourseCatalogClient({
      fetch,
      now,
    }).getModuleContacts({
      catalogUrl: `https://courses.uzh.ch/#/details/2025/003/SM/${MODULE_ID}`,
      semester: FALL_26,
    })

    expect(snapshot.semester).toEqual(FALL_26)
    expect(snapshot.catalogUrl).toBe(buildCatalogModuleUrl(MODULE_ID, FALL_26))
    expect(fetch.mock.calls[0]![0]).toContain("PiqYear='2026'")
  })

  it('uses the current semester for links without one', async () => {
    const fetch = createFetch()
    const snapshot = await createUzhCourseCatalogClient({
      fetch,
      now,
    }).getModuleContacts({
      catalogUrl: `https://courses.uzh.ch/#/details/SM/${MODULE_ID}`,
    })
    expect(snapshot.semester).toEqual(FALL_26)
  })

  it('maps an event link to its module in the link semester', async () => {
    const fetch = createFetch()
    const snapshot = await createUzhCourseCatalogClient({
      fetch,
      now,
    }).getModuleContacts({
      catalogUrl: `https://courses.uzh.ch/#/details/2025/003/E/${EVENT_ID}`,
      semester: FALL_26,
    })

    const urls = fetch.mock.calls.map(([url]) => url)
    expect(urls[0]).toContain(
      `EDetailsSet(EObjId='${EVENT_ID}',PiqYear='2025',PiqSession='003')`
    )
    expect(urls[1]).toContain(
      `SmDetailsSet(SmObjId='${MODULE_ID}',PiqYear='2026',PiqSession='003')`
    )
    expect(snapshot.moduleId).toBe(MODULE_ID)
  })

  it('raises NOT_OFFERED for a semester without the module', async () => {
    const fetch = createFetch({
      module: () => moduleEntity({ SmObjId: '00000000' }),
    })
    await expect(
      createUzhCourseCatalogClient({ fetch, now }).getModuleContacts({
        catalogUrl: `https://courses.uzh.ch/#/details/2026/004/SM/${MODULE_ID}`,
      })
    ).rejects.toMatchObject({ code: 'NOT_OFFERED' })
  })

  it('rejects ambiguous event links', async () => {
    const fetch = createFetch({
      event: {
        Modules: {
          results: [{ SmObjId: '51000001' }, { SmObjId: '51000002' }],
        },
      },
    })
    await expect(
      createUzhCourseCatalogClient({ fetch, now }).getModuleContacts({
        catalogUrl: `https://courses.uzh.ch/#/details/2026/003/E/${EVENT_ID}`,
      })
    ).rejects.toMatchObject({ code: 'NOT_OFFERED' })
  })

  it('treats a response without navigation sets as unexpected', async () => {
    const fetch = createFetch({
      module: () => ({ SmObjId: MODULE_ID, SmText: 'x' }),
    })
    await expect(
      createUzhCourseCatalogClient({ fetch, now }).getModuleContacts({
        catalogUrl: `https://courses.uzh.ch/#/details/2026/003/SM/${MODULE_ID}`,
      })
    ).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' })
  })

  it('reports catalogue outages as UNAVAILABLE', async () => {
    const failing = vi.fn(async () => jsonResponse({}, 503))
    await expect(
      createUzhCourseCatalogClient({
        fetch: failing,
        now,
      }).getModuleContacts({
        catalogUrl: `https://courses.uzh.ch/#/details/2026/003/SM/${MODULE_ID}`,
      })
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' })

    const throwing = vi.fn(async () => {
      throw new Error('socket hang up')
    })
    await expect(
      createUzhCourseCatalogClient({
        fetch: throwing,
        now,
      }).getModuleContacts({
        catalogUrl: `https://courses.uzh.ch/#/details/2026/003/SM/${MODULE_ID}`,
      })
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' })
  })

  it('keeps contacts and warns when a person lookup fails', async () => {
    const base = createFetch()
    const fetch = vi.fn(async (url: string) =>
      url.includes("Objid='01000001'") ? jsonResponse({}, 500) : base(url)
    )
    const snapshot = await createUzhCourseCatalogClient({
      fetch,
      now,
    }).getModuleContacts({
      catalogUrl: `https://courses.uzh.ch/#/details/2026/003/SM/${MODULE_ID}`,
    })

    expect(snapshot.contacts.map((contact) => contact.personId)).toEqual([
      '01000001',
      '01000002',
    ])
    expect(snapshot.warnings).toContain(
      'No contact has a public e-mail; approval cannot be requested'
    )
    expect(
      snapshot.warnings.some((warning) =>
        warning.startsWith('Contact details for person 01000001 unavailable')
      )
    ).toBe(true)
  })
})
