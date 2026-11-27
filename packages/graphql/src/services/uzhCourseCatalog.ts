/**
 * Read-only client for the public UZH course catalogue (Vorlesungsverzeichnis,
 * https://courses.uzh.ch). It resolves a catalogue link to the module and
 * returns the module's responsible persons and lecturers with their contact
 * data, so a chatbot's video source approval can be requested from them.
 *
 * The catalogue is a SAP UI5 app backed by anonymous OData services. See
 * docs/solutions/integration/uzh-course-catalog-contacts.md for the API facts
 * and quirks this client depends on.
 *
 * The result contains personal data (names, e-mail addresses). Callers store
 * it as a dated snapshot next to the approval request and must not log it.
 */

import { GraphQLError } from 'graphql'

export const UZH_CATALOG_ORIGIN = 'https://studentservices.uzh.ch'
const DATA_SERVICE_PATH = '/sap/opu/odata/uzh/vvz_data_srv/'
const SAP_CLIENT = '001'
const DEFAULT_TIMEOUT_MS = 15_000
const PERSON_LOOKUP_CONCURRENCY = 4
const NOT_OFFERED_OBJECT_ID = '00000000'

// The backend only implements the exact $expand strings the catalogue UI
// sends. A narrower expand (e.g. only `Responsible`) answers 200 with empty
// navigation sets or fails with 500, so never trim these.
const MODULE_EXPAND =
  'Partof,Organizations,Responsible,Events,Events/Persons,OfferPeriods'
const PERSON_EXPAND = 'Events,Events/Persons,Responsible'
const EVENT_EXPAND =
  'Rooms,Persons,Schedule,Schedule/Rooms,Schedule/Persons,Modules,Links'

export type CatalogSemesterSession = '003' | '004'

/**
 * A catalogue semester. `piqYear` is the start year of the academic year;
 * session 003 is the fall semester (HS), 004 the spring semester (FS).
 * Example: HS26 = { piqYear: '2026', piqSession: '003' },
 * FS27 = { piqYear: '2026', piqSession: '004' }.
 */
export interface CatalogSemester {
  piqYear: string
  piqSession: CatalogSemesterSession
}

export type CatalogObjectType = 'SM' | 'E'

export interface CatalogReference {
  objectType: CatalogObjectType
  objectId: string
  semester: CatalogSemester | null
}

export type CatalogContactRole = 'RESPONSIBLE' | 'LECTURER'

export interface CatalogContact {
  personId: string
  roles: CatalogContactRole[]
  title: string | null
  firstName: string
  lastName: string
  email: string | null
  function: string | null
  organization: string | null
  /** Catalogue events (lectures, exercises) this person teaches in the module. */
  eventIds: string[]
}

export interface CatalogEvent {
  eventId: string
  title: string
  shortName: string
  category: string | null
  scheduleText: string | null
}

export interface CatalogModuleSnapshot {
  catalogUrl: string
  moduleId: string
  semester: CatalogSemester
  semesterLabel: string
  title: string
  shortName: string
  offeringOrganization: string | null
  offerPattern: string | null
  events: CatalogEvent[]
  contacts: CatalogContact[]
  warnings: string[]
  retrievedAt: string
}

export type UzhCourseCatalogErrorCode =
  | 'INVALID_URL'
  | 'NOT_OFFERED'
  | 'UNAVAILABLE'
  | 'UNEXPECTED_RESPONSE'

export class UzhCourseCatalogError extends GraphQLError {
  constructor(
    message: string,
    readonly code: UzhCourseCatalogErrorCode
  ) {
    super(message, { extensions: { code: `UZH_CATALOG_${code}` } })
    this.name = 'UzhCourseCatalogError'
  }
}

type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal }
) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
}>

export interface UzhCourseCatalogClientOptions {
  fetch?: FetchLike
  origin?: string
  timeoutMs?: number
  now?: () => Date
}

const SEMESTER_PATH_PATTERN =
  /details\/(\d{4})\/(003|004)\/(SM|E)\/(\d{8})(?:[/?]|$)/
const NO_SEMESTER_PATH_PATTERN = /details\/(SM|E)\/(\d{8})(?:[/?]|$)/
const CATALOG_HOSTS = new Set(['courses.uzh.ch', 'studentservices.uzh.ch'])

/**
 * Parses a catalogue link such as
 * https://courses.uzh.ch/#/details/2026/003/SM/51110643 or the
 * studentservices.uzh.ch URL it redirects to. Module (SM) and event (E) links
 * are accepted; links without a semester resolve against the requested one.
 */
export function parseCatalogUrl(url: string): CatalogReference {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new UzhCourseCatalogError(
      'Catalogue link is not a URL',
      'INVALID_URL'
    )
  }
  if (parsed.protocol !== 'https:' || !CATALOG_HOSTS.has(parsed.hostname)) {
    throw new UzhCourseCatalogError(
      'Catalogue link must point to courses.uzh.ch',
      'INVALID_URL'
    )
  }

  const route = `${parsed.pathname}${parsed.hash}`
  const withSemester = SEMESTER_PATH_PATTERN.exec(route)
  if (withSemester) {
    return {
      objectType: withSemester[3] as CatalogObjectType,
      objectId: withSemester[4]!,
      semester: {
        piqYear: withSemester[1]!,
        piqSession: withSemester[2] as CatalogSemesterSession,
      },
    }
  }
  const withoutSemester = NO_SEMESTER_PATH_PATTERN.exec(route)
  if (withoutSemester) {
    return {
      objectType: withoutSemester[1] as CatalogObjectType,
      objectId: withoutSemester[2]!,
      semester: null,
    }
  }
  throw new UzhCourseCatalogError(
    'Catalogue link does not point to a module or event',
    'INVALID_URL'
  )
}

/**
 * Parses HS26, FS27, HS2026, "Fall Semester 2026" or "Spring Semester 2027"
 * (also the German Herbstsemester/Frühjahrssemester forms).
 */
export function parseSemesterLabel(label: string): CatalogSemester {
  const normalized = label.trim().toLowerCase()
  const match =
    /^(hs|fs|fall(?: semester)?|spring(?: semester)?|herbstsemester|frühjahrssemester)\s*(\d{2}|\d{4})$/.exec(
      normalized
    )
  if (!match) {
    throw new UzhCourseCatalogError(
      `Unknown semester label: ${label}`,
      'INVALID_URL'
    )
  }
  const year =
    match[2]!.length === 2 ? 2000 + Number(match[2]) : Number(match[2])
  const isFall = /^(hs|fall|herbst)/.test(match[1]!)
  return isFall
    ? { piqYear: String(year), piqSession: '003' }
    : { piqYear: String(year - 1), piqSession: '004' }
}

/**
 * The catalogue semester a date falls into. UZH fall semesters run from
 * 1 August to 31 January, spring semesters from 1 February to 31 July.
 * Do not use SemesterSet.IsCurrent for this: it marks the newest published
 * semester, which is the next one once its catalogue is out.
 */
export function semesterForDate(date: Date): CatalogSemester {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  if (month >= 8) return { piqYear: String(year), piqSession: '003' }
  if (month === 1) return { piqYear: String(year - 1), piqSession: '003' }
  return { piqYear: String(year - 1), piqSession: '004' }
}

export function formatSemester(semester: CatalogSemester): string {
  const startYear = Number(semester.piqYear)
  return semester.piqSession === '003'
    ? `HS${String(startYear % 100).padStart(2, '0')}`
    : `FS${String((startYear + 1) % 100).padStart(2, '0')}`
}

export function buildCatalogModuleUrl(
  moduleId: string,
  semester: CatalogSemester
): string {
  return `https://courses.uzh.ch/#/details/${semester.piqYear}/${semester.piqSession}/SM/${moduleId}`
}

const DECIMAL_ENTITY = /&#(\d+);/g
const HEX_ENTITY = /&#x([0-9a-f]+);/gi
const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(DECIMAL_ENTITY, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(HEX_ENTITY, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&(amp|lt|gt|quot|apos);/g, (entity) => NAMED_ENTITIES[entity]!)
}

const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/
const EMAIL_TOKEN = /[^\s@<>"':]+@[^\s@<>"']+\.[^\s@<>"']+/

/**
 * PDetails.Email is an HTML anchor (`<a href="mailto:x@uzh.ch">x@uzh.ch</a>`),
 * sometimes a plain address, and empty when the person hides it.
 */
export function parseCatalogEmail(raw: string | null | undefined) {
  if (!raw) return null
  const decoded = decodeHtmlEntities(raw)
  // Extract the address instead of stripping markup: the value is HTML and
  // only a validated address may leave this function.
  const mailto = /mailto:([^"'?>\s]+)/i.exec(decoded)
  let candidate = mailto?.[1] ?? EMAIL_TOKEN.exec(decoded)?.[0]
  if (!candidate) return null
  try {
    candidate = decodeURIComponent(candidate)
  } catch {
    return null
  }
  candidate = candidate.trim().toLowerCase()
  return EMAIL_PATTERN.test(candidate) ? candidate : null
}

function emptyToNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new UzhCourseCatalogError(
      `Catalogue response is missing ${field}`,
      'UNEXPECTED_RESPONSE'
    )
  }
  return value
}

type ODataRecord = Record<string, unknown>

function navResults(entity: ODataRecord, nav: string): ODataRecord[] {
  const value = entity[nav] as { results?: unknown } | undefined
  if (!value || !Array.isArray(value.results)) {
    throw new UzhCourseCatalogError(
      `Catalogue response is missing ${nav}`,
      'UNEXPECTED_RESPONSE'
    )
  }
  return value.results as ODataRecord[]
}

function entityKey(set: string, keys: Record<string, string>): string {
  const parts = Object.entries(keys).map(([key, value]) => {
    if (!/^[0-9]+$/.test(value)) {
      throw new UzhCourseCatalogError(
        `Invalid catalogue key ${key}`,
        'INVALID_URL'
      )
    }
    return `${key}='${value}'`
  })
  return `${set}(${parts.join(',')})`
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index]!)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  )
  return results
}

export function createUzhCourseCatalogClient(
  options: UzhCourseCatalogClientOptions = {}
) {
  const fetchImpl = options.fetch ?? (globalThis.fetch as FetchLike)
  const origin = options.origin ?? UZH_CATALOG_ORIGIN
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const now = options.now ?? (() => new Date())

  async function getEntity(path: string, expand: string): Promise<ODataRecord> {
    const url = `${origin}${DATA_SERVICE_PATH}${path}?sap-client=${SAP_CLIENT}&$expand=${encodeURIComponent(expand)}`
    let response: Awaited<ReturnType<FetchLike>>
    try {
      response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new UzhCourseCatalogError(
        `Course catalogue request failed: ${(error as Error).message}`,
        'UNAVAILABLE'
      )
    }
    if (!response.ok) {
      throw new UzhCourseCatalogError(
        `Course catalogue answered HTTP ${response.status}`,
        response.status >= 500 ? 'UNAVAILABLE' : 'UNEXPECTED_RESPONSE'
      )
    }
    let body: { d?: ODataRecord } | null
    try {
      body = (await response.json()) as { d?: ODataRecord } | null
    } catch (error) {
      throw new UzhCourseCatalogError(
        `Course catalogue answered with an unreadable body: ${(error as Error).message}`,
        error instanceof SyntaxError ? 'UNEXPECTED_RESPONSE' : 'UNAVAILABLE'
      )
    }
    if (!body?.d || typeof body.d !== 'object') {
      throw new UzhCourseCatalogError(
        'Course catalogue answered without an entity',
        'UNEXPECTED_RESPONSE'
      )
    }
    return body.d
  }

  async function getModuleEntity(moduleId: string, semester: CatalogSemester) {
    const entity = await getEntity(
      entityKey('SmDetailsSet', {
        SmObjId: moduleId,
        PiqYear: semester.piqYear,
        PiqSession: semester.piqSession,
      }),
      MODULE_EXPAND
    )
    const id = emptyToNull(entity.SmObjId)
    return id && id !== NOT_OFFERED_OBJECT_ID ? entity : null
  }

  async function getModuleIdForEvent(
    eventId: string,
    semester: CatalogSemester
  ) {
    const entity = await getEntity(
      entityKey('EDetailsSet', {
        EObjId: eventId,
        PiqYear: semester.piqYear,
        PiqSession: semester.piqSession,
      }),
      EVENT_EXPAND
    )
    const moduleIds = [
      ...new Set(
        navResults(entity, 'Modules')
          .map((module) => emptyToNull(module.SmObjId))
          .filter((id): id is string => !!id && id !== NOT_OFFERED_OBJECT_ID)
      ),
    ]
    if (moduleIds.length !== 1) {
      throw new UzhCourseCatalogError(
        moduleIds.length === 0
          ? 'Catalogue event belongs to no module in this semester'
          : 'Catalogue event belongs to several modules; use the module link',
        'NOT_OFFERED'
      )
    }
    return moduleIds[0]!
  }

  async function getPerson(personId: string, semester: CatalogSemester) {
    const entity = await getEntity(
      entityKey('PDetailsSet', {
        Objid: personId,
        PiqYear: semester.piqYear,
        PiqSession: semester.piqSession,
      }),
      PERSON_EXPAND
    )
    return {
      email: parseCatalogEmail(entity.Email as string | undefined),
      function: emptyToNull(entity.FunctionTxt),
      organization: emptyToNull(entity.OrgText),
    }
  }

  /**
   * Fetches the module behind a catalogue link and its contacts for one
   * semester. Without `semester`, the semester in the link is used, then the
   * semester of `now()`. Modules keep their id across semesters, so a link
   * from an earlier run resolves against the requested semester; a module not
   * offered in that semester raises NOT_OFFERED.
   */
  async function getModuleContacts({
    catalogUrl,
    semester,
  }: {
    catalogUrl: string
    semester?: CatalogSemester
  }): Promise<CatalogModuleSnapshot> {
    const reference = parseCatalogUrl(catalogUrl)
    // Copy, so a caller mutating its object mid-request cannot mix semesters.
    const targetSemester: CatalogSemester = {
      ...(semester ?? reference.semester ?? semesterForDate(now())),
    }
    const linkSemester = reference.semester ?? targetSemester

    // Event ids change every semester, so map an event link to its module
    // in the semester of the link and then read the module in the target.
    const moduleId =
      reference.objectType === 'SM'
        ? reference.objectId
        : await getModuleIdForEvent(reference.objectId, linkSemester)

    const module = await getModuleEntity(moduleId, targetSemester)
    if (!module) {
      throw new UzhCourseCatalogError(
        `Module ${moduleId} is not offered in ${formatSemester(targetSemester)}`,
        'NOT_OFFERED'
      )
    }

    const warnings: string[] = []
    const contacts = new Map<string, CatalogContact>()
    const addContact = (
      person: ODataRecord,
      role: CatalogContactRole,
      eventId?: string
    ) => {
      const personId = requireString(person.Objid, 'person id')
      const existing = contacts.get(personId)
      const contact: CatalogContact = existing ?? {
        personId,
        roles: [],
        title: emptyToNull(person.Title),
        firstName: emptyToNull(person.FirstName) ?? '',
        lastName: emptyToNull(person.LastName) ?? '',
        email: null,
        function: null,
        organization: null,
        eventIds: [],
      }
      if (!contact.roles.includes(role)) contact.roles.push(role)
      if (eventId && !contact.eventIds.includes(eventId)) {
        contact.eventIds.push(eventId)
      }
      contacts.set(personId, contact)
    }

    for (const person of navResults(module, 'Responsible')) {
      addContact(person, 'RESPONSIBLE')
    }
    const events: CatalogEvent[] = navResults(module, 'Events').map((event) => {
      const eventId = requireString(event.Objid, 'event id')
      for (const person of navResults(event, 'Persons')) {
        addContact(person, 'LECTURER', eventId)
      }
      return {
        eventId,
        title: emptyToNull(event.EStext) ?? '',
        shortName: emptyToNull(event.EShort) ?? '',
        category: emptyToNull(event.CategoryText),
        scheduleText: emptyToNull(event.ScheduleText),
      }
    })

    const contactList = [...contacts.values()]
    await mapWithConcurrency(
      contactList,
      PERSON_LOOKUP_CONCURRENCY,
      async (contact) => {
        try {
          Object.assign(
            contact,
            await getPerson(contact.personId, targetSemester)
          )
        } catch (error) {
          warnings.push(
            `Contact details for person ${contact.personId} unavailable: ${(error as Error).message}`
          )
        }
        if (!contact.email) {
          warnings.push(`Person ${contact.personId} has no public e-mail`)
        }
      }
    )

    if (!contactList.some((contact) => contact.roles.includes('RESPONSIBLE'))) {
      warnings.push('Module lists no responsible person')
    }
    if (!contactList.some((contact) => contact.email)) {
      warnings.push(
        'No contact has a public e-mail; approval cannot be requested'
      )
    }

    return {
      catalogUrl: buildCatalogModuleUrl(moduleId, targetSemester),
      moduleId,
      semester: targetSemester,
      semesterLabel: formatSemester(targetSemester),
      title: requireString(module.SmText, 'module title'),
      shortName: emptyToNull(module.SmShort) ?? '',
      offeringOrganization: emptyToNull(
        navResults(module, 'Organizations')[0]?.OText
      ),
      offerPattern: emptyToNull(module.OfferpatternText),
      events,
      contacts: contactList,
      warnings,
      retrievedAt: now().toISOString(),
    }
  }

  return { getModuleContacts }
}
