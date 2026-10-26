import { createHash } from 'node:crypto'
import { Prisma, type PrismaClient } from '@klicker-uzh/prisma/client'

export type DeletionTarget = { id: string; email: string }

export type DeletionAction = {
  kind:
    | 'element'
    | 'tag'
    | 'liveQuiz'
    | 'practiceQuiz'
    | 'microLearning'
    | 'groupActivity'
    | 'course'
    | 'answerCollection'
    | 'catalogCollection'
    | 'chatbotDisclaimer'
    | 'competencyTree'
  id: string | number
  status?: string
  activityType?: string
}

export type DeletionBlocker = {
  kind: string
  table: string
  id: string
  reason: string
}

export type LecturerDeletionPreview = {
  version: 1
  target: DeletionTarget
  fingerprint: string
  actions: DeletionAction[]
  blockers: DeletionBlocker[]
  mediaIds: string[]
}

export type LecturerDeletionErrorCode =
  | 'INVALID_TARGET'
  | 'PREVIEW_INCOMPLETE'
  | 'ELEMENT_REFUSED'
  | 'MEDIA_STATE_CHANGED'
  | 'RESIDUAL_DEPENDENCIES'
  | 'FINALIZATION_REFUSED'

export class LecturerDeletionError extends Error {
  readonly code: LecturerDeletionErrorCode

  constructor(code: LecturerDeletionErrorCode) {
    super(code)
    this.name = 'LecturerDeletionError'
    this.code = code
  }
}

type Tx = Prisma.TransactionClient

type ForeignKeyEdge = {
  constraint: string
  table: string
  column: string
  targetTable: string
  targetColumn: string
}

type Catalog = {
  foreignKeys: ForeignKeyEdge[]
  byTarget: Map<string, ForeignKeyEdge[]>
  bySource: Map<string, ForeignKeyEdge[]>
  columns: Map<string, Set<string>>
  primaryKeys: Map<string, Array<{ column: string; type: string }>>
  scanColumns: Array<{ table: string; column: string; type: string }>
  userEdges: ForeignKeyEdge[]
  fingerprint: string
}

type RowRef = { table: string; column: string; value: string }

type InventoryRow = {
  pk: string | null
  hash: string
  refs: RowRef[]
  status: string | null
  assessment: boolean
  scheduled: boolean
  deletionMarker: boolean
  hasResults: boolean
  hasAnonymousResults: boolean
  userGroupId: string | null
  access: string | null
}

type Node = { table: string; column: string; value: string | number }

const ROOT_DEFINITIONS = [
  { table: 'Element', column: 'id', kind: 'element', numeric: true },
  { table: 'Tag', column: 'id', kind: 'tag', numeric: true },
  {
    table: 'LiveQuiz',
    column: 'id',
    kind: 'liveQuiz',
    numeric: false,
    activityType: 'LIVE_QUIZ',
  },
  {
    table: 'PracticeQuiz',
    column: 'id',
    kind: 'practiceQuiz',
    numeric: false,
    activityType: 'PRACTICE_QUIZ',
  },
  {
    table: 'MicroLearning',
    column: 'id',
    kind: 'microLearning',
    numeric: false,
    activityType: 'MICRO_LEARNING',
  },
  {
    table: 'GroupActivity',
    column: 'id',
    kind: 'groupActivity',
    numeric: false,
    activityType: 'GROUP_ACTIVITY',
  },
  { table: 'Course', column: 'id', kind: 'course', numeric: false },
  {
    table: 'AnswerCollection',
    column: 'id',
    kind: 'answerCollection',
    numeric: true,
  },
  {
    table: 'CatalogCollection',
    column: 'id',
    kind: 'catalogCollection',
    numeric: false,
  },
] as const

const ROOT_TABLES = new Set<string>(
  ROOT_DEFINITIONS.map((entry) => entry.table)
)
const ACTIVITY_TYPES = new Map<string, string>(
  ROOT_DEFINITIONS.filter((entry) => 'activityType' in entry).map((entry) => [
    entry.table,
    entry.activityType,
  ])
)

const LEAF_DEFINITIONS = [
  { table: 'ChatbotDisclaimer', kind: 'chatbotDisclaimer', numeric: false },
  { table: 'CompetencyTree', kind: 'competencyTree', numeric: true },
] as const

const UNSUPPORTED_ROOTS = new Map([
  ['Chatbot', 'chatbot'],
  ['ChatAccountUsage', 'accountUsage'],
])
const SAFE_STRUCTURES = new Set([
  'ElementBlock',
  'ElementStack',
  'ElementInstance',
  'ActivityTemplate',
  'AnswerCollectionEntry',
  'GroupActivityParameter',
  'GroupActivityClue',
  'ActivityLogEntry',
])
const SHARING_TABLES = new Set([
  'Permission',
  'DerivedPermission',
  'AccessRequest',
  'CatalogCollectionAssignment',
])
const RETAINED_TABLES = new Set([
  'QuestionResponse',
  'QuestionResponseDetail',
  'LiveQuizResponse',
  'PointCorrection',
  'AppliedPointCorrection',
  'ElementFeedback',
  'TimelineEntry',
  'InstanceStatistics',
  'ParticipantAnalytics',
  'AggregatedAnalytics',
  'CompetencyAnalytics',
  'AggregatedCompetencyAnalytics',
  'ParticipantCourseAnalytics',
  'AggregatedCourseAnalytics',
  'ParticipantPerformance',
  'InstancePerformance',
  'ActivityPerformance',
  'ParticipantActivityPerformance',
  'ActivityProgress',
  'ParticipantInvitation',
  'ParticipantDataUseEvent',
  'ParticipantAnalyticsWithdrawal',
  'ParticipantGroup',
  'GroupMessage',
  'Participation',
  'GroupAssignmentPoolEntry',
  'LeaderboardEntry',
  'TemporaryLeaderboardEntry',
  'PushSubscription',
  'Title',
  'Achievement',
  'ParticipantAchievementInstance',
  'GroupAchievementInstance',
  'ClassAchievementInstance',
  'AwardEntry',
  'Feedback',
  'FeedbackResponse',
  'ConfusionTimestep',
  'GroupActivityInstance',
  'GroupActivityClueInstance',
  'GroupActivityClueAssignment',
  'VerifiableCredential',
])

const USER_FK_CLASSIFIER = new Map<string, 'allowed' | 'inspect' | 'block'>([
  ['Account.userId', 'allowed'],
  ['Session.userId', 'allowed'],
  ['UserLogin.userId', 'inspect'],
  ['Permission.userId', 'inspect'],
  ['DerivedPermission.userId', 'inspect'],
  ['AccessRequest.userId', 'inspect'],
  ['MediaFile.ownerId', 'inspect'],
  ['ElementInstance.ownerId', 'inspect'],
  ...LEAF_DEFINITIONS.map(
    (entry) => [`${entry.table}.ownerId`, 'inspect'] as const
  ),
  ['AccessRequest.objectAdminOrOwnerId', 'inspect'],
  ['ActivityLogEntry.userId', 'inspect'],
  ['UserGroup.ownerId', 'block'],
  ['PointCorrection.correctedById', 'block'],
  ['VerifiableCredential.revokedById', 'block'],
  ...ROOT_DEFINITIONS.map(
    (entry) => [`${entry.table}.ownerId`, 'inspect'] as const
  ),
  ...[...UNSUPPORTED_ROOTS.keys()].map(
    (table) => [`${table}.ownerId`, 'inspect'] as const
  ),
  ['_UserGroupMembers.A', 'block'],
  ['_UserGroupMembers.B', 'block'],
  ['_UserGroupAdmins.A', 'block'],
  ['_UserGroupAdmins.B', 'block'],
])

const FINAL_DELETE_USER_FKS = new Set([
  'Account.userId',
  'Session.userId',
  'UserLogin.userId',
  'MediaFile.ownerId',
])

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const MAX_EDGE_ROWS = 250
const MAX_ROWS_PER_ROOT = 1_000
const MAX_NODES = 5_000
const MAX_MEDIA_ROWS = 2_000
const MAX_DEPTH = 8

function quote(identifier: string) {
  if (!IDENTIFIER_RE.test(identifier)) {
    throw new LecturerDeletionError('PREVIEW_INCOMPLETE')
  }

  return `"${identifier}"`
}

function fail(code: LecturerDeletionErrorCode): never {
  throw new LecturerDeletionError(code)
}

function rowKey(table: string, id: string) {
  return `${table}:${id}`
}

function sortedUnique(values: Iterable<string>) {
  return [...new Set(values)].sort()
}

function compareBlocker(a: DeletionBlocker, b: DeletionBlocker) {
  return `${a.table}:${a.id}:${a.kind}:${a.reason}`.localeCompare(
    `${b.table}:${b.id}:${b.kind}:${b.reason}`
  )
}

function buildPreview(
  target: DeletionTarget,
  actions: DeletionAction[],
  blockers: DeletionBlocker[],
  mediaIds: string[],
  rowHashes: Iterable<string>,
  schemaFingerprint: string
): LecturerDeletionPreview {
  const normalizedActions = [...actions].sort((a, b) =>
    `${a.kind}:${String(a.id)}`.localeCompare(`${b.kind}:${String(b.id)}`)
  )
  const normalizedBlockers = [...blockers].sort(compareBlocker)
  const normalizedMediaIds = sortedUnique(mediaIds)
  const normalizedHashes = sortedUnique(rowHashes)
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        version: 1,
        target,
        actions: normalizedActions,
        blockers: normalizedBlockers,
        mediaIds: normalizedMediaIds,
        rowHashes: normalizedHashes,
        schemaFingerprint,
      })
    )
    .digest('hex')

  return {
    version: 1,
    target,
    fingerprint,
    actions: normalizedActions,
    blockers: normalizedBlockers,
    mediaIds: normalizedMediaIds,
  }
}

async function loadCatalog(tx: Tx): Promise<Catalog> {
  const external = await tx.$queryRaw<Array<{ exists: number }>>`
    SELECT 1 AS "exists" FROM pg_constraint con
    JOIN pg_class src ON src.oid = con.conrelid
    JOIN pg_class tgt ON tgt.oid = con.confrelid
    JOIN pg_namespace ns ON ns.oid = src.relnamespace
    JOIN pg_namespace tns ON tns.oid = tgt.relnamespace
    WHERE con.contype = 'f' AND tns.nspname = current_schema()
      AND ns.nspname <> current_schema() LIMIT 1
  `
  if (external.length) fail('PREVIEW_INCOMPLETE')
  const foreignKeys = await tx.$queryRaw<ForeignKeyEdge[]>`
    SELECT
      con.conname AS "constraint",
      src.relname AS "table",
      satt.attname AS "column",
      tgt.relname AS "targetTable",
      tatt.attname AS "targetColumn"
    FROM pg_constraint con
    JOIN pg_class src ON src.oid = con.conrelid
    JOIN pg_class tgt ON tgt.oid = con.confrelid
    JOIN pg_namespace ns ON ns.oid = src.relnamespace
    JOIN pg_namespace tns ON tns.oid = tgt.relnamespace
    JOIN LATERAL unnest(con.conkey, con.confkey) AS keys(source, target) ON true
    JOIN pg_attribute satt
      ON satt.attrelid = src.oid AND satt.attnum = keys.source
    JOIN pg_attribute tatt
      ON tatt.attrelid = tgt.oid AND tatt.attnum = keys.target
    WHERE con.contype = 'f'
      AND ns.nspname = current_schema()
      AND tns.nspname = current_schema()
    ORDER BY src.relname, con.conname, satt.attnum
  `

  const primaryKeyRows = await tx.$queryRaw<
    Array<{ table: string; column: string; type: string }>
  >`
    SELECT
      rel.relname AS "table",
      att.attname AS "column",
      format_type(att.atttypid, att.atttypmod) AS "type"
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN pg_attribute att
      ON att.attrelid = rel.oid
      AND att.attnum = ANY(con.conkey)
    WHERE con.contype = 'p'
      AND ns.nspname = current_schema()
    ORDER BY rel.relname, array_position(con.conkey, att.attnum)
  `

  const columnRows = await tx.$queryRaw<
    Array<{ table: string; column: string; type: string; scannable: boolean }>
  >`
    SELECT
      table_name AS "table",
      column_name AS "column",
      data_type AS "type",
      data_type IN (
        'text', 'character varying', 'character', 'json', 'jsonb', 'ARRAY'
      ) AS "scannable"
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name <> '_prisma_migrations'
      AND EXISTS (
        SELECT 1 FROM information_schema.tables base
        WHERE base.table_schema = columns.table_schema
          AND base.table_name = columns.table_name
          AND base.table_type = 'BASE TABLE'
      )
    ORDER BY table_name, ordinal_position
  `
  if (
    foreignKeys.some(
      (edge) => edge.targetTable === 'User' && edge.targetColumn !== 'id'
    )
  )
    fail('PREVIEW_INCOMPLETE')
  const scanColumns = columnRows
    .filter((entry) => entry.scannable)
    .map(({ table, column, type }) => ({ table, column, type }))

  const byTarget = new Map<string, ForeignKeyEdge[]>()
  const bySource = new Map<string, ForeignKeyEdge[]>()
  for (const edge of foreignKeys) {
    const targetEdges = byTarget.get(edge.targetTable) ?? []
    targetEdges.push(edge)
    byTarget.set(edge.targetTable, targetEdges)

    const sourceEdges = bySource.get(edge.table) ?? []
    sourceEdges.push(edge)
    bySource.set(edge.table, sourceEdges)
  }

  const primaryKeys = new Map<string, Array<{ column: string; type: string }>>()
  for (const row of primaryKeyRows) {
    const columns = primaryKeys.get(row.table) ?? []
    columns.push({ column: row.column, type: row.type })
    primaryKeys.set(row.table, columns)
  }

  const columns = new Map<string, Set<string>>()
  for (const row of columnRows) {
    const entries = columns.get(row.table) ?? new Set<string>()
    entries.add(row.column)
    columns.set(row.table, entries)
  }

  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ foreignKeys, primaryKeyRows, columnRows }))
    .digest('hex')

  return {
    foreignKeys,
    byTarget,
    bySource,
    columns,
    primaryKeys,
    scanColumns,
    userEdges: foreignKeys.filter((edge) => edge.targetTable === 'User'),
    fingerprint,
  }
}

function primaryKeyExpression(catalog: Catalog, table: string, alias = 't') {
  const columns = catalog.primaryKeys.get(table) ?? []
  if (columns.length === 0) {
    return `md5(row_to_json(${alias})::text)`
  }
  if (columns.length === 1) {
    return `${alias}.${quote(columns[0]!.column)}::text`
  }

  return `jsonb_build_object(${columns
    .map((entry) => `'${entry.column}', ${alias}.${quote(entry.column)}::text`)
    .join(', ')})::text`
}

function columnExists(catalog: Catalog, table: string, column: string) {
  return catalog.columns.get(table)?.has(column) ?? false
}

function specialSelect(catalog: Catalog, table: string) {
  const expressions: string[] = []
  const status = columnExists(catalog, table, 'status')
    ? 't."status"::text'
    : 'NULL::text'
  const assessment = columnExists(catalog, table, 'isAssessmentEnabled')
    ? 'COALESCE(t."isAssessmentEnabled", false)'
    : 'false'
  const markerParts = [
    columnExists(catalog, table, 'scheduledPublicationTaskId')
      ? 't."scheduledPublicationTaskId" IS NOT NULL'
      : null,
    columnExists(catalog, table, 'scheduledCompletionTaskId')
      ? 't."scheduledCompletionTaskId" IS NOT NULL'
      : null,
  ].filter((entry): entry is string => entry !== null)
  const deletionMarker = columnExists(catalog, table, 'deletionRequestedAt')
    ? 't."deletionRequestedAt" IS NOT NULL'
    : 'false'
  const scheduled =
    markerParts.length > 0
      ? markerParts.map((entry) => `(${entry})`).join(' OR ')
      : 'false'
  const results = columnExists(catalog, table, 'results')
    ? `jsonb_path_exists(t."results", '$.** ? (@.type() == "string" || @.type() == "number" && @ != 0 || @ == true)') OR jsonb_path_exists(t."results", '$.responses.*')`
    : 'false'
  const anonymousResults = columnExists(catalog, table, 'anonymousResults')
    ? `jsonb_path_exists(t."anonymousResults", '$.** ? (@.type() == "string" || @.type() == "number" && @ != 0 || @ == true)') OR jsonb_path_exists(t."anonymousResults", '$.responses.*')`
    : 'false'
  const userGroupId = columnExists(catalog, table, 'userGroupId')
    ? 't."userGroupId"::text'
    : 'NULL::text'
  const access = columnExists(catalog, table, 'access')
    ? 't."access"::text'
    : 'NULL::text'

  expressions.push(
    `${status} AS "__status"`,
    `${assessment} AS "__assessment"`,
    `${scheduled} AS "__scheduled"`,
    `${deletionMarker} AS "__deletionMarker"`,
    `${results} AS "__hasResults"`,
    `${anonymousResults} AS "__hasAnonymousResults"`,
    `${userGroupId} AS "__userGroupId"`,
    `${access} AS "__access"`
  )

  return expressions.join(', ')
}

async function readRows(
  tx: Tx,
  catalog: Catalog,
  table: string,
  where: string,
  values: unknown[],
  limit: number
) {
  const edges = catalog.bySource.get(table) ?? []
  const refSelect = edges.map(
    (edge, index) => `t.${quote(edge.column)}::text AS "__fk${index}"`
  )
  const sql = `
    SELECT
      ${primaryKeyExpression(catalog, table)} AS "__pk",
      md5(row_to_json(t)::text) AS "__hash",
      ${specialSelect(catalog, table)}
      ${refSelect.length > 0 ? `, ${refSelect.join(', ')}` : ''}
    FROM ${quote(table)} t
    WHERE ${where}
    LIMIT ${Math.min(limit + 1, 10_001)}
  `

  const rawRows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
    sql,
    ...values
  )

  return {
    more: rawRows.length > limit,
    rows: rawRows.slice(0, limit).map(
      (raw): InventoryRow => ({
        pk: typeof raw.__pk === 'string' ? raw.__pk : null,
        hash: String(raw.__hash),
        refs: edges.flatMap((edge, index) => {
          const value = raw[`__fk${index}`]
          return typeof value === 'string' && value.length > 0
            ? [{ table: edge.targetTable, column: edge.column, value }]
            : []
        }),
        status: typeof raw.__status === 'string' ? raw.__status : null,
        assessment: raw.__assessment === true,
        scheduled: raw.__scheduled === true,
        deletionMarker: raw.__deletionMarker === true,
        hasResults: raw.__hasResults === true,
        hasAnonymousResults: raw.__hasAnonymousResults === true,
        userGroupId:
          typeof raw.__userGroupId === 'string' ? raw.__userGroupId : null,
        access: typeof raw.__access === 'string' ? raw.__access : null,
      })
    ),
  }
}

async function readRowsByReference(
  tx: Tx,
  catalog: Catalog,
  edge: ForeignKeyEdge,
  values: Array<string | number>,
  limit = MAX_EDGE_ROWS
) {
  if (values.length === 0) {
    return { rows: [], more: false }
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ')
  return readRows(
    tx,
    catalog,
    edge.table,
    `t.${quote(edge.column)} IN (${placeholders})`,
    values,
    limit
  )
}

function addIncomplete(
  blockers: DeletionBlocker[],
  table: string,
  reason = 'row-limit'
) {
  blockers.push({ kind: 'incomplete', table, id: 'limit', reason })
}

function blocker(
  table: string,
  id: string,
  kind: string,
  reason: string
): DeletionBlocker {
  return { kind, table, id, reason }
}

function rootRefs(row: InventoryRow) {
  return row.refs.filter((ref) => ROOT_TABLES.has(ref.table))
}

function hasForeignRootRef(
  row: InventoryRow,
  rootIds: Map<string, Set<string>>
) {
  return rootRefs(row).some((ref) => !rootIds.get(ref.table)?.has(ref.value))
}

function hasTargetRootRef(
  row: InventoryRow,
  rootIds: Map<string, Set<string>>
) {
  return rootRefs(row).some((ref) => rootIds.get(ref.table)?.has(ref.value))
}

function userRefsAreTargetPrivate(row: InventoryRow, target: DeletionTarget) {
  return row.refs
    .filter((ref) => ref.table === 'User')
    .every((ref) => ref.value === target.id)
}

function rowStatusBlocker(table: string, row: InventoryRow) {
  if (
    (table === 'LiveQuiz' ||
      table === 'PracticeQuiz' ||
      table === 'MicroLearning' ||
      table === 'GroupActivity') &&
    row.status !== 'DRAFT' &&
    row.status !== 'TEMPLATE'
  ) {
    return 'publication-status'
  }
  if (row.assessment) return 'assessment-enabled'
  if (row.scheduled) return 'scheduled-task'
  if (row.deletionMarker) return 'deletion-marker'
  return null
}

function rowIdentity(_table: string, row: InventoryRow) {
  return row.pk ?? row.hash.slice(0, 24)
}

async function scanMediaReferences(
  tx: Tx,
  catalog: Catalog,
  ownerId: string,
  allowedRows: Set<string>
) {
  const columnsByTable = new Map<string, typeof catalog.scanColumns>()
  for (const column of catalog.scanColumns) {
    const entries = columnsByTable.get(column.table) ?? []
    entries.push(column)
    columnsByTable.set(column.table, entries)
  }

  // Container IDs can appear behind custom/CDN hosts or inside encoded URLs.
  // Any occurrence outside verified private rows requires an operator decision.
  const identity = [...ownerId.toLowerCase()]
    .map(
      (char) =>
        `(?:${char}|%(?:25)*${char.charCodeAt(0).toString(16).padStart(2, '0')}|${String.raw`\\u`}${char.charCodeAt(0).toString(16).padStart(4, '0')})`
    )
    .join('')
  const subqueries = [...columnsByTable.entries()].map(([table, columns]) => {
    const pk = primaryKeyExpression(catalog, table)
    const value = columns
      .map((entry) => `t.${quote(entry.column)}::text`)
      .join(", E'\\n', ")
    return `(
      SELECT '${table}'::text AS "table", ${pk} AS "id",
        md5(row_to_json(t)::text) AS "hash"
      FROM ${quote(table)} t
      WHERE lower(concat_ws(E'\\n', ${value})) ~ $1
      LIMIT ${MAX_MEDIA_ROWS + 1}
    )`
  })

  if (subqueries.length === 0) {
    return {
      blockers: [blocker('mediaScan', 'none', 'incomplete', 'no-scan-columns')],
      hashes: [],
    }
  }

  const rows = await tx.$queryRawUnsafe<
    Array<{ table: string; id: string; hash: string }>
  >(
    `SELECT * FROM (${subqueries.join(' UNION ALL ')} ) media_refs LIMIT ${MAX_MEDIA_ROWS + 1}`,
    identity
  )
  const blockers: DeletionBlocker[] = []
  if (rows.length > MAX_MEDIA_ROWS) {
    addIncomplete(blockers, 'mediaScan')
  }

  for (const row of rows.slice(0, MAX_MEDIA_ROWS)) {
    const key = rowKey(row.table, row.id)
    if (!allowedRows.has(key)) {
      blockers.push(
        blocker(row.table, row.id, 'mediaReference', 'non-private-reference')
      )
    }
  }

  return {
    blockers,
    hashes: rows.map((row) => `${row.table}:${row.hash}`),
  }
}

function nodeFromRow(
  catalog: Catalog,
  table: string,
  row: InventoryRow
): Node | null {
  if (!row.pk) return null
  const primaryKeys = catalog.primaryKeys.get(table) ?? []
  if (primaryKeys.length !== 1) return null

  const type = primaryKeys[0]!.type
  const value =
    /^(integer|smallint|bigint|numeric|real|double precision)$/.test(type)
      ? Number(row.pk)
      : row.pk
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null

  return { table, column: primaryKeys[0]!.column, value }
}

async function inspectDirectUserRelations(
  tx: Tx,
  catalog: Catalog,
  target: DeletionTarget,
  privateRows: Set<string>,
  rowHashes: Set<string>,
  blockers: DeletionBlocker[]
) {
  const deferredActivityLogs: Array<{
    key: string
    table: string
    id: string
  }> = []

  for (const edge of catalog.userEdges) {
    const classification = USER_FK_CLASSIFIER.get(
      `${edge.table}.${edge.column}`
    )
    const result = await readRowsByReference(
      tx,
      catalog,
      edge,
      [target.id],
      MAX_ROWS_PER_ROOT
    )
    for (const row of result.rows) {
      rowHashes.add(`${edge.table}:${row.hash}`)
    }
    if (result.more) addIncomplete(blockers, edge.table)

    if (result.rows.length === 0) continue
    if (classification === 'allowed') {
      for (const row of result.rows)
        privateRows.add(rowKey(edge.table, rowIdentity(edge.table, row)))
      continue
    }
    if (classification === 'block') {
      for (const row of result.rows) {
        blockers.push(
          blocker(
            edge.table,
            rowIdentity(edge.table, row),
            edge.table === 'UserGroup' || edge.table.startsWith('_UserGroup')
              ? 'groupMembership'
              : 'unsupportedAttribution',
            'retained-user-reference'
          )
        )
      }
      continue
    }

    for (const row of result.rows) {
      const id = rowIdentity(edge.table, row)
      if (edge.table === 'UserLogin') {
        const scopes = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT "id"::text AS "id" FROM "UserLogin" WHERE "userId" = ${target.id}::uuid AND "scope" <> 'READ_ONLY' LIMIT 1`
        if (scopes.length)
          blockers.push(
            blocker(
              'UserLogin',
              scopes[0]!.id,
              'delegatedLogin',
              'write-capable-login'
            )
          )
        privateRows.add(rowKey(edge.table, id))
      } else if (SHARING_TABLES.has(edge.table) && edge.column === 'userId') {
        if (!privateRows.has(rowKey(edge.table, id))) {
          blockers.push(
            blocker(edge.table, id, 'sharing', 'foreign-object-access')
          )
        }
      } else if (edge.table === 'ActivityLogEntry') {
        deferredActivityLogs.push({
          key: rowKey(edge.table, id),
          table: edge.table,
          id,
        })
      } else if (
        edge.table === 'AccessRequest' &&
        edge.column === 'objectAdminOrOwnerId'
      ) {
        blockers.push(
          blocker(edge.table, id, 'accessRequest', 'foreign-requester')
        )
      } else if (classification === undefined) {
        blockers.push(
          blocker(edge.table, id, 'unclassifiedRelation', 'user-reference')
        )
      } else if (
        edge.table === 'ElementInstance' &&
        !privateRows.has(rowKey(edge.table, id))
      ) {
        blockers.push(blocker(edge.table, id, 'unsupported', 'orphan-instance'))
      }
    }
  }

  for (const log of deferredActivityLogs) {
    if (!privateRows.has(log.key)) {
      blockers.push(blocker(log.table, log.id, 'attribution', 'foreign-object'))
    }
  }
}

async function inventory(
  tx: Tx,
  catalog: Catalog,
  target: DeletionTarget,
  userHash: string,
  userDeletionMarker: boolean
) {
  const actions: DeletionAction[] = []
  const blockers: DeletionBlocker[] = []
  const mediaIds: string[] = []
  const rowHashes = new Set<string>([`User:${userHash}`])
  const privateRows = new Set<string>([rowKey('User', target.id)])
  const parentChecks: Array<{ table: string; id: string; refs: RowRef[] }> = []
  const rootRows: Array<{ table: string; id: string; row: InventoryRow }> = []
  const rootIds = new Map<string, Set<string>>()

  if (userDeletionMarker) {
    blockers.push(
      blocker('User', target.id, 'deletionMarker', 'account-marker')
    )
  }

  for (const root of ROOT_DEFINITIONS) {
    const ownerEdge = catalog.userEdges.find(
      (edge) => edge.table === root.table && edge.column === 'ownerId'
    )
    if (!ownerEdge) {
      blockers.push(
        blocker(root.table, 'schema', 'incomplete', 'owner-fk-missing')
      )
      continue
    }

    const result = await readRows(
      tx,
      catalog,
      root.table,
      `t."ownerId" = $1`,
      [target.id],
      MAX_ROWS_PER_ROOT
    )
    if (result.more) addIncomplete(blockers, root.table)
    if (result.rows.length >= MAX_ROWS_PER_ROOT) {
      addIncomplete(blockers, root.table, 'inventory-cap')
    }

    for (const row of result.rows) {
      if (!row.pk) {
        blockers.push(
          blocker(root.table, row.hash.slice(0, 24), 'incomplete', 'missing-id')
        )
        continue
      }
      const id = root.numeric ? Number(row.pk) : row.pk
      if (root.numeric && !Number.isSafeInteger(id)) {
        blockers.push(blocker(root.table, row.pk, 'incomplete', 'invalid-id'))
        continue
      }

      const ids = rootIds.get(root.table) ?? new Set<string>()
      ids.add(row.pk)
      rootIds.set(root.table, ids)
      privateRows.add(rowKey(root.table, row.pk))
      rowHashes.add(`${root.table}:${row.hash}`)

      const action: DeletionAction = {
        kind: root.kind,
        id: root.numeric ? id : row.pk,
      }
      if (ACTIVITY_TYPES.has(root.table)) {
        if (row.status) action.status = row.status
        action.activityType = ACTIVITY_TYPES.get(root.table)
      }
      actions.push(action)
      rootRows.push({ table: root.table, id: row.pk, row })

      const workBlocker = rowStatusBlocker(root.table, row)
      if (workBlocker) {
        blockers.push(blocker(root.table, row.pk, 'activeWork', workBlocker))
      }
      if (root.table === 'CatalogCollection' && row.access === 'PUBLIC') {
        blockers.push(blocker(root.table, row.pk, 'sharing', 'public-catalog'))
      }
    }
  }

  for (const { table, id, row } of rootRows) {
    if (hasForeignRootRef(row, rootIds)) {
      blockers.push(blocker(table, id, 'foreignReference', 'root-link'))
    }
  }

  for (const [table, reason] of UNSUPPORTED_ROOTS) {
    const result = await readRows(
      tx,
      catalog,
      table,
      `t."ownerId" = $1`,
      [target.id],
      MAX_ROWS_PER_ROOT
    )
    if (result.more) addIncomplete(blockers, table)
    for (const row of result.rows) {
      const id = rowIdentity(table, row)
      rowHashes.add(`${table}:${row.hash}`)
      privateRows.add(rowKey(table, id))
      blockers.push(blocker(table, id, 'unsupported', reason))
    }
  }

  for (const leaf of LEAF_DEFINITIONS) {
    const result = await readRows(
      tx,
      catalog,
      leaf.table,
      't."ownerId" = $1',
      [target.id],
      MAX_ROWS_PER_ROOT
    )
    if (result.more) addIncomplete(blockers, leaf.table)
    for (const row of result.rows) {
      if (!row.pk) {
        addIncomplete(blockers, leaf.table, 'missing-id')
        continue
      }
      rowHashes.add(`${leaf.table}:${row.hash}`)
      privateRows.add(rowKey(leaf.table, row.pk))
      actions.push({
        kind: leaf.kind,
        id: leaf.numeric ? Number(row.pk) : row.pk,
      })
      for (const edge of catalog.byTarget.get(leaf.table) ?? []) {
        const uses = await readRowsByReference(tx, catalog, edge, [
          leaf.numeric ? Number(row.pk) : row.pk,
        ])
        if (uses.more) addIncomplete(blockers, edge.table)
        for (const use of uses.rows)
          blockers.push(
            blocker(
              edge.table,
              rowIdentity(edge.table, use),
              'unsupported',
              'leaf-in-use'
            )
          )
      }
    }
  }

  const mediaRows = await readRows(
    tx,
    catalog,
    'MediaFile',
    `t."ownerId" = $1`,
    [target.id],
    MAX_ROWS_PER_ROOT
  )
  if (mediaRows.more) addIncomplete(blockers, 'MediaFile')
  for (const row of mediaRows.rows) {
    if (!row.pk) {
      addIncomplete(blockers, 'MediaFile', 'missing-id')
      continue
    }
    mediaIds.push(row.pk)
    privateRows.add(rowKey('MediaFile', row.pk))
    rowHashes.add(`MediaFile:${row.hash}`)
  }

  if (rootIds.size === 0 && actions.length === 0) {
    rowHashes.add('roots:none')
  }

  const visited = new Set<string>()
  let frontier: Node[] = []
  for (const [table, ids] of rootIds) {
    const column = catalog.primaryKeys.get(table)?.[0]?.column ?? 'id'
    const type = catalog.primaryKeys.get(table)?.[0]?.type
    for (const id of ids) {
      const value =
        type &&
        /^(integer|smallint|bigint|numeric|real|double precision)$/.test(type)
          ? Number(id)
          : id
      const key = rowKey(table, id)
      if (visited.has(key)) continue
      visited.add(key)
      frontier.push({ table, column, value })
    }
  }

  let traversedNodes = frontier.length
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth += 1) {
    const byTable = new Map<string, Node[]>()
    for (const node of frontier) {
      const entries = byTable.get(node.table) ?? []
      entries.push(node)
      byTable.set(node.table, entries)
    }

    const nextFrontier: Node[] = []
    for (const [table, nodes] of byTable) {
      const inboundEdges = catalog.byTarget.get(table) ?? []
      const values = nodes.map((node) => node.value)
      for (const edge of inboundEdges) {
        if (edge.targetTable === 'User') continue
        const result = await readRowsByReference(tx, catalog, edge, values)
        if (result.more) addIncomplete(blockers, edge.table)

        for (const row of result.rows) {
          const id = rowIdentity(edge.table, row)
          const key = rowKey(edge.table, id)
          rowHashes.add(`${edge.table}:${row.hash}`)

          if (edge.table.startsWith('_')) {
            parentChecks.push({ table: edge.table, id, refs: row.refs })
            privateRows.add(key)
            for (const ref of row.refs) {
              if (ref.table === 'User') {
                blockers.push(
                  blocker(edge.table, id, 'groupMembership', 'user-link')
                )
              } else if (
                RETAINED_TABLES.has(ref.table) ||
                UNSUPPORTED_ROOTS.has(ref.table) ||
                (!ROOT_TABLES.has(ref.table) && !SAFE_STRUCTURES.has(ref.table))
              ) {
                blockers.push(
                  blocker(edge.table, id, 'unsupportedRelation', ref.table)
                )
              }
            }
            continue
          }

          if (UNSUPPORTED_ROOTS.has(edge.table)) {
            blockers.push(
              blocker(
                edge.table,
                id,
                'unsupported',
                UNSUPPORTED_ROOTS.get(edge.table)!
              )
            )
            continue
          }
          if (RETAINED_TABLES.has(edge.table)) {
            blockers.push(
              blocker(edge.table, id, 'retainedData', 'inbound-reference')
            )
            continue
          }

          if (ROOT_TABLES.has(edge.table)) {
            if (!userRefsAreTargetPrivate(row, target)) {
              blockers.push(
                blocker(edge.table, id, 'foreignOwnership', 'root-owner')
              )
              continue
            }
            if (hasForeignRootRef(row, rootIds)) {
              blockers.push(
                blocker(edge.table, id, 'foreignReference', 'root-link')
              )
              continue
            }

            const node = nodeFromRow(catalog, edge.table, row)
            if (node && !visited.has(rowKey(edge.table, String(node.value)))) {
              visited.add(nodeKey(node))
              nextFrontier.push(node)
            }
            continue
          }

          if (SHARING_TABLES.has(edge.table)) {
            if (edge.table === 'AccessRequest') {
              blockers.push(
                blocker(edge.table, id, 'accessRequest', 'pending-request')
              )
            } else if (edge.table === 'CatalogCollectionAssignment') {
              blockers.push(
                blocker(edge.table, id, 'sharing', 'catalog-assignment')
              )
            } else {
              const foreignGrant = row.refs.some(
                (ref) => ref.table === 'User' && ref.value !== target.id
              )
              if (
                foreignGrant ||
                row.userGroupId !== null ||
                !hasTargetRootRef(row, rootIds)
              ) {
                blockers.push(
                  blocker(edge.table, id, 'sharing', 'foreign-grant')
                )
              } else {
                privateRows.add(key)
              }
            }
            continue
          }

          if (SAFE_STRUCTURES.has(edge.table)) {
            if (!userRefsAreTargetPrivate(row, target)) {
              blockers.push(
                blocker(edge.table, id, 'foreignOwnership', 'structural-owner')
              )
              continue
            }
            if (
              hasForeignRootRef(row, rootIds) ||
              !hasTargetRootRef(row, rootIds)
            ) {
              blockers.push(
                blocker(edge.table, id, 'foreignReference', 'structural-parent')
              )
              continue
            }
            if (
              edge.table === 'ElementInstance' &&
              !row.refs.some(
                (ref) =>
                  ref.table === 'ElementBlock' || ref.table === 'ElementStack'
              )
            ) {
              blockers.push(
                blocker(edge.table, id, 'unsupported', 'orphan-instance')
              )
              continue
            }
            if (
              edge.table === 'ElementInstance' &&
              (row.hasResults || row.hasAnonymousResults)
            ) {
              blockers.push(
                blocker(edge.table, id, 'retainedData', 'instance-results')
              )
              continue
            }
            if (
              edge.table === 'ActivityLogEntry' &&
              !userRefsAreTargetPrivate(row, target)
            ) {
              blockers.push(
                blocker(edge.table, id, 'attribution', 'foreign-user')
              )
              continue
            }

            privateRows.add(key)
            parentChecks.push({ table: edge.table, id, refs: row.refs })
            const node = nodeFromRow(catalog, edge.table, row)
            if (node && !visited.has(rowKey(edge.table, String(node.value)))) {
              visited.add(nodeKey(node))
              nextFrontier.push(node)
            }
            continue
          }

          blockers.push(
            blocker(edge.table, id, 'unclassifiedRelation', 'inbound-reference')
          )
        }
      }
    }

    traversedNodes += nextFrontier.length
    if (traversedNodes > MAX_NODES) {
      addIncomplete(blockers, 'traversal', 'node-limit')
      frontier = []
      break
    }
    frontier = nextFrontier
  }

  if (frontier.length > 0) addIncomplete(blockers, 'traversal', 'depth-limit')
  for (const { table, id, refs } of parentChecks) {
    for (const ref of refs) {
      if (
        (ROOT_TABLES.has(ref.table) || SAFE_STRUCTURES.has(ref.table)) &&
        !privateRows.has(rowKey(ref.table, ref.value))
      ) {
        blockers.push(
          blocker(table, id, 'foreignReference', 'non-private-parent')
        )
      }
    }
  }

  const auditRows = await tx.$queryRaw<Array<{ id: number; hash: string }>>`
    SELECT "id", md5(row_to_json(a)::text) AS "hash"
    FROM "AuditLogEntry" a
    WHERE "sourceUserId" = ${target.id}::uuid OR "targetUserId" = ${target.id}::uuid
    LIMIT ${MAX_ROWS_PER_ROOT + 1}
  `
  if (auditRows.length > MAX_ROWS_PER_ROOT)
    addIncomplete(blockers, 'AuditLogEntry')
  for (const row of auditRows.slice(0, MAX_ROWS_PER_ROOT)) {
    rowHashes.add(`AuditLogEntry:${row.hash}`)
    blockers.push(
      blocker(
        'AuditLogEntry',
        String(row.id),
        'attribution',
        'non-fk-user-reference'
      )
    )
  }

  const tokens = await tx.$queryRaw<Array<{ hash: string }>>`
    SELECT md5(row_to_json(v)::text) AS "hash"
    FROM "VerificationToken" v
    WHERE lower("identifier") = lower(${target.email})
    LIMIT 2
  `
  if (tokens.length > 1) addIncomplete(blockers, 'VerificationToken')
  for (const row of tokens) {
    rowHashes.add(`VerificationToken:${row.hash}`)
    blockers.push(
      blocker(
        'VerificationToken',
        row.hash.slice(0, 24),
        'verificationToken',
        'ambiguous-email'
      )
    )
  }

  await inspectDirectUserRelations(
    tx,
    catalog,
    target,
    privateRows,
    rowHashes,
    blockers
  )

  const mediaScan = await scanMediaReferences(
    tx,
    catalog,
    target.id,
    privateRows
  )
  blockers.push(...mediaScan.blockers)
  for (const hash of mediaScan.hashes) rowHashes.add(hash)

  return buildPreview(
    target,
    actions,
    blockers,
    mediaIds,
    rowHashes,
    catalog.fingerprint
  )
}

function nodeKey(node: Node) {
  return rowKey(node.table, String(node.value))
}

async function readExactUser(
  tx: Tx,
  target: DeletionTarget,
  forUpdate: boolean
) {
  const rows = await tx.$queryRawUnsafe<
    Array<{
      id: string
      email: string
      role: string
      hash: string
      deletionMarker: boolean
    }>
  >(
    `
      SELECT
        "id"::text AS "id",
        "email",
        "role"::text AS "role",
        md5(row_to_json(u)::text) AS "hash",
        "deletionRequestedAt" IS NOT NULL OR "deletionToken" IS NOT NULL AS "deletionMarker"
      FROM "User" u
      WHERE "id" = $1::uuid
      ${forUpdate ? 'FOR UPDATE' : ''}
      LIMIT 1
    `,
    target.id
  )
  const user = rows[0]
  if (
    !user ||
    user.id !== target.id ||
    user.email !== target.email ||
    user.role !== 'USER'
  ) {
    fail('INVALID_TARGET')
  }
  return user
}

function lockExactUser(tx: Tx, target: DeletionTarget) {
  return readExactUser(tx, target, true)
}

export async function previewLecturerDeletion(
  prisma: PrismaClient,
  target: DeletionTarget
): Promise<LecturerDeletionPreview> {
  if (!UUID_RE.test(target.id) || target.email.length === 0) {
    fail('INVALID_TARGET')
  }

  let verifiedTarget: DeletionTarget | null = null
  let schemaFingerprint = ''
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5000ms'")
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '1000ms'")
        const user = await readExactUser(tx, target, false)
        verifiedTarget = { id: user.id, email: user.email }
        const catalog = await loadCatalog(tx)
        schemaFingerprint = catalog.fingerprint
        return inventory(
          tx,
          catalog,
          verifiedTarget,
          user.hash,
          user.deletionMarker
        )
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 5_000,
        timeout: 30_000,
      }
    )
  } catch (error) {
    if (error instanceof LecturerDeletionError) throw error
    if (!verifiedTarget) fail('INVALID_TARGET')
    return buildPreview(
      verifiedTarget,
      [],
      [blocker('preview', 'incomplete', 'incomplete', 'query-limit')],
      [],
      [],
      schemaFingerprint
    )
  }
}

export async function purgePrivateElement(
  prisma: PrismaClient,
  target: DeletionTarget,
  id: number
): Promise<void> {
  if (!UUID_RE.test(target.id) || !Number.isSafeInteger(id) || id <= 0) {
    fail('ELEMENT_REFUSED')
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{
            ownerId: string
            isDeleted: boolean
            answerCollectionId: number | null
          }>
        >`
          SELECT "ownerId"::text AS "ownerId", "isDeleted", "answerCollectionId"
          FROM "Element"
          WHERE "id" = ${id}
          FOR UPDATE
        `
        const element = rows[0]
        if (
          !element ||
          element.ownerId !== target.id ||
          !element.isDeleted ||
          element.answerCollectionId !== null
        ) {
          fail('ELEMENT_REFUSED')
        }

        const catalog = await loadCatalog(tx)
        for (const edge of catalog.byTarget.get('Element') ?? []) {
          const result = await readRowsByReference(
            tx,
            catalog,
            edge,
            [id],
            MAX_EDGE_ROWS
          )
          if (result.more) fail('ELEMENT_REFUSED')
          if (edge.table === 'ActivityLogEntry') {
            for (const row of result.rows) {
              if (
                !userRefsAreTargetPrivate(row, target) ||
                row.refs.some(
                  (ref) =>
                    ref.table !== 'User' &&
                    (ref.table !== 'Element' || ref.value !== String(id))
                )
              ) {
                fail('ELEMENT_REFUSED')
              }
            }
          } else if (result.rows.length > 0) fail('ELEMENT_REFUSED')
        }
        await tx.$executeRaw`DELETE FROM "ActivityLogEntry" WHERE "elementId" = ${id}`

        const deleted = await tx.$executeRaw`
          DELETE FROM "Element"
          WHERE "id" = ${id}
            AND "ownerId" = ${target.id}::uuid
            AND "isDeleted" = true
            AND "answerCollectionId" IS NULL
        `
        if (deleted !== 1) fail('ELEMENT_REFUSED')
      },
      { timeout: 15_000 }
    )
  } catch (error) {
    if (error instanceof LecturerDeletionError) throw error
    fail('ELEMENT_REFUSED')
  }
}

async function mediaRowsForTarget(tx: Tx, target: DeletionTarget) {
  return tx.$queryRaw<Array<{ id: string; hash: string }>>`
    SELECT "id"::text AS "id", md5(row_to_json(m)::text) AS "hash"
    FROM "MediaFile" m
    WHERE "ownerId" = ${target.id}::uuid
    ORDER BY "id"
  `
}

async function finalGuard(tx: Tx, catalog: Catalog, target: DeletionTarget) {
  const allowedRows = new Set([rowKey('User', target.id)])
  for (const edge of catalog.userEdges) {
    const allowed = FINAL_DELETE_USER_FKS.has(`${edge.table}.${edge.column}`)
    const result = await readRowsByReference(
      tx,
      catalog,
      edge,
      [target.id],
      allowed ? MAX_ROWS_PER_ROOT : 1
    )
    if (result.more || (!allowed && result.rows.length > 0))
      fail('RESIDUAL_DEPENDENCIES')
    for (const row of result.rows)
      allowedRows.add(rowKey(edge.table, rowIdentity(edge.table, row)))
  }

  const pendingRequests = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "AccessRequest"
    WHERE "objectAdminOrOwnerId" = ${target.id}::uuid
    LIMIT 1
  `
  if (pendingRequests.length > 0) fail('RESIDUAL_DEPENDENCIES')

  const audit = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT "id" FROM "AuditLogEntry"
    WHERE "sourceUserId" = ${target.id}::uuid OR "targetUserId" = ${target.id}::uuid
    LIMIT 1
  `
  if (audit.length > 0) fail('RESIDUAL_DEPENDENCIES')

  const token = await tx.$queryRaw<Array<{ exists: number }>>`
    SELECT 1 AS "exists" FROM "VerificationToken"
    WHERE lower("identifier") = lower(${target.email})
    LIMIT 1
  `
  if (token.length > 0) fail('RESIDUAL_DEPENDENCIES')
  return allowedRows
}

export async function finalizeLecturerDeletion(
  prisma: PrismaClient,
  target: DeletionTarget,
  verifiedMedia: { mediaIds: string[] }
): Promise<void> {
  if (!UUID_RE.test(target.id) || target.email.length === 0) {
    fail('INVALID_TARGET')
  }
  if (
    !Array.isArray(verifiedMedia?.mediaIds) ||
    new Set(verifiedMedia.mediaIds).size !== verifiedMedia.mediaIds.length ||
    verifiedMedia.mediaIds.some((id) => !UUID_RE.test(id))
  ) {
    fail('MEDIA_STATE_CHANGED')
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const user = await lockExactUser(tx, target)
        if (user.deletionMarker) fail('FINALIZATION_REFUSED')
        const catalog = await loadCatalog(tx)

        const mediaRows = await mediaRowsForTarget(tx, target)
        const actualMediaIds = mediaRows.map((row) => row.id).sort()
        const expectedMediaIds = [...verifiedMedia.mediaIds].sort()
        if (
          actualMediaIds.length !== expectedMediaIds.length ||
          actualMediaIds.some((id, index) => id !== expectedMediaIds[index])
        ) {
          fail('MEDIA_STATE_CHANGED')
        }
        const allowedMediaRows = await finalGuard(tx, catalog, target)
        const mediaScan = await scanMediaReferences(
          tx,
          catalog,
          target.id,
          allowedMediaRows
        )
        if (mediaScan.blockers.length > 0) fail('MEDIA_STATE_CHANGED')

        if (expectedMediaIds.length > 0) {
          const deletedMedia = await tx.$executeRaw`
            DELETE FROM "MediaFile"
            WHERE "ownerId" = ${target.id}::uuid
              AND "id" = ANY(${expectedMediaIds}::uuid[])
          `
          if (deletedMedia !== expectedMediaIds.length)
            fail('MEDIA_STATE_CHANGED')
        }

        await tx.$executeRaw`
          DELETE FROM "Account" WHERE "userId" = ${target.id}::uuid
        `
        await tx.$executeRaw`
          DELETE FROM "Session" WHERE "userId" = ${target.id}::uuid
        `
        await tx.$executeRaw`
          DELETE FROM "UserLogin" WHERE "userId" = ${target.id}::uuid
        `
        const deletedUser = await tx.$executeRaw`
          DELETE FROM "User"
          WHERE "id" = ${target.id}::uuid AND "email" = ${target.email}
        `
        if (deletedUser !== 1) fail('FINALIZATION_REFUSED')
      },
      { timeout: 30_000 }
    )
  } catch (error) {
    if (error instanceof LecturerDeletionError) throw error
    fail('FINALIZATION_REFUSED')
  }
}

export async function deleteUnusedLecturerLeaf(
  prisma: PrismaClient,
  target: DeletionTarget,
  action: DeletionAction
) {
  const definition = LEAF_DEFINITIONS.find((leaf) => leaf.kind === action.kind)
  if (!definition || !UUID_RE.test(target.id)) fail('RESIDUAL_DEPENDENCIES')
  await prisma.$transaction(
    async (tx) => {
      await lockExactUser(tx, target)
      const catalog = await loadCatalog(tx)
      const table = quote(definition.table)
      const rows = await tx.$queryRawUnsafe<Array<{ ownerId: string }>>(
        `SELECT "ownerId"::text AS "ownerId" FROM ${table} WHERE "id" = $1 FOR UPDATE`,
        action.id
      )
      if (rows.length !== 1 || rows[0]?.ownerId !== target.id)
        fail('RESIDUAL_DEPENDENCIES')
      for (const edge of catalog.byTarget.get(definition.table) ?? []) {
        const uses = await readRowsByReference(
          tx,
          catalog,
          edge,
          [action.id],
          1
        )
        if (uses.rows.length || uses.more) fail('RESIDUAL_DEPENDENCIES')
      }
      const deleted = await tx.$executeRawUnsafe(
        `DELETE FROM ${table} WHERE "id" = $1 AND "ownerId" = $2::uuid`,
        action.id,
        target.id
      )
      if (deleted !== 1) fail('RESIDUAL_DEPENDENCIES')
    },
    { timeout: 15_000 }
  )
}
