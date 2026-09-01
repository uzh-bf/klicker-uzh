import { useQuery } from '@apollo/client'
import type { Element } from '@klicker-uzh/graphql/dist/ops'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import type { FormikProps } from 'formik'
import { isEqual, omit } from 'lodash'
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CreationFormValues } from '../components/activities/creation/WizardLayout'

const SNAPSHOT_VERSION = 1
const DERIVED_COURSE_FIELDS = [
  'courseStartDate',
  'courseEndDate',
  'courseGroupDeadline',
]

export type ActivityWizardMode = 'create' | 'duplicate' | 'convert' | 'edit'

export function resolveActivityWizardMode({
  editMode,
  duplicationMode,
  conversionMode = false,
}: {
  editMode: boolean
  duplicationMode: boolean
  conversionMode?: boolean
}): ActivityWizardMode {
  if (editMode) {
    return 'edit'
  }

  if (duplicationMode) {
    return 'duplicate'
  }

  return conversionMode ? 'convert' : 'create'
}

export const ACTIVITY_WIZARD_SNAPSHOT_PREFIX = 'autosave-activity-creation'

interface WizardSnapshotPayload {
  version: number
  mode: ActivityWizardMode
  activityType: string
  sourceId?: string
  savedAt: string
  values: Record<string, unknown>
  selectedElements?: Record<string, unknown>
}

export interface WizardSnapshot<T extends CreationFormValues> {
  values: T
  selectedElements?: Record<number, Element>
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return { __date: value.toISOString() }
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue)
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        serializeValue(val),
      ])
    )
  }

  return value
}

function deserializeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deserializeValue)
  }

  if (
    value !== null &&
    typeof value === 'object' &&
    '__date' in (value as Record<string, unknown>)
  ) {
    const iso = (value as { __date: unknown }).__date
    if (typeof iso !== 'string') {
      throw new Error('Invalid date marker')
    }

    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid date value')
    }
    return date
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        deserializeValue(val),
      ])
    )
  }

  return value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSerializedDate(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value.__date === 'string' &&
    !Number.isNaN(Date.parse(value.__date))
  )
}

function isOptionalSerializedDate(value: unknown): boolean {
  return value === undefined || isSerializedDate(value)
}

// Dates are serialized as { __date: <ISO string> }; a marker with a
// non-string or unparseable value would make deserialization throw, so
// reject the whole payload before hydration.
function hasValidDateMarkers(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every(hasValidDateMarkers)
  }

  if (isPlainObject(value)) {
    if ('__date' in value) {
      return (
        typeof value.__date === 'string' &&
        !Number.isNaN(Date.parse(value.__date))
      )
    }

    return Object.values(value).every(hasValidDateMarkers)
  }

  return true
}

function isElementInstance(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false
  }

  return (
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.type === 'string' &&
    typeof value.hasSampleSolution === 'boolean' &&
    (value.existingInstanceId === null ||
      typeof value.existingInstanceId === 'number') &&
    typeof value.duplicateInstance === 'boolean'
  )
}

function isElementInstanceList(value: unknown): boolean {
  return Array.isArray(value) && value.every(isElementInstance)
}

function isStack(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false
  }

  return (
    (value.displayName === undefined ||
      typeof value.displayName === 'string') &&
    (value.description === undefined ||
      typeof value.description === 'string') &&
    isElementInstanceList(value.elements)
  )
}

function isBlock(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false
  }

  return (
    (value.timeLimit === undefined || typeof value.timeLimit === 'number') &&
    (value.randomSelection === undefined ||
      value.randomSelection === null ||
      typeof value.randomSelection === 'number') &&
    isElementInstanceList(value.elements)
  )
}

function isClue(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false
  }

  return (
    typeof value.name === 'string' &&
    typeof value.displayName === 'string' &&
    (value.type === 'STRING' || value.type === 'NUMBER') &&
    typeof value.value === 'string' &&
    (value.unit === undefined || typeof value.unit === 'string')
  )
}

function isSelectedElement(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false
  }

  return (
    typeof value.id === 'number' &&
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    (value.options === undefined || isPlainObject(value.options))
  )
}

function isSelectedElements(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false
  }

  return Object.entries(value).every(([key, element]) => {
    const numericKey = Number(key)
    return (
      String(numericKey) === key &&
      Number.isInteger(numericKey) &&
      isSelectedElement(element)
    )
  })
}

function validateFormValues(
  activityType: string,
  values: Record<string, unknown>
): boolean {
  const commonOk =
    typeof values.name === 'string' &&
    typeof values.displayName === 'string' &&
    typeof values.description === 'string' &&
    typeof values.multiplier === 'string' &&
    (values.courseId === undefined || typeof values.courseId === 'string') &&
    isOptionalSerializedDate(values.courseStartDate) &&
    isOptionalSerializedDate(values.courseEndDate) &&
    isOptionalSerializedDate(values.courseGroupDeadline)

  if (!commonOk) {
    return false
  }

  switch (activityType) {
    case 'LIVE_QUIZ':
      return (
        Array.isArray(values.blocks) &&
        values.blocks.every(isBlock) &&
        typeof values.isGamificationEnabled === 'boolean' &&
        typeof values.isAssessmentEnabled === 'boolean' &&
        typeof values.isPinProtected === 'boolean' &&
        typeof values.isConfusionFeedbackEnabled === 'boolean' &&
        typeof values.isLiveQAEnabled === 'boolean' &&
        typeof values.isModerationEnabled === 'boolean' &&
        typeof values.defaultPoints === 'number' &&
        typeof values.defaultCorrectPoints === 'number' &&
        typeof values.maxBonusPoints === 'number' &&
        typeof values.timeToZeroBonus === 'number'
      )
    case 'MICRO_LEARNING':
      return (
        Array.isArray(values.stacks) &&
        values.stacks.every(isStack) &&
        isSerializedDate(values.startDate) &&
        isSerializedDate(values.endDate)
      )
    case 'PRACTICE_QUIZ':
      return (
        Array.isArray(values.stacks) &&
        values.stacks.every(isStack) &&
        (values.order === 'SEQUENTIAL' ||
          values.order === 'SPACED_REPETITION') &&
        typeof values.resetTimeDays === 'string'
      )
    case 'GROUP_ACTIVITY':
      return (
        isStack(values.stack) &&
        Array.isArray(values.clues) &&
        values.clues.every(isClue) &&
        isSerializedDate(values.startDate) &&
        isSerializedDate(values.endDate)
      )
    default:
      return false
  }
}

export function buildSnapshotKey(options: {
  userKey: string
  mode: ActivityWizardMode
  activityType: string
  sourceId?: string
}): string {
  return [
    ACTIVITY_WIZARD_SNAPSHOT_PREFIX,
    options.userKey,
    options.mode,
    options.activityType,
    options.sourceId ?? 'new',
  ].join('-')
}

function legacyUnscopedSnapshotKeys(): string[] {
  const keys: string[] = []

  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)

      if (key?.startsWith(ACTIVITY_WIZARD_SNAPSHOT_PREFIX + '-')) {
        const rest = key.slice(ACTIVITY_WIZARD_SNAPSHOT_PREFIX.length + 1)
        // Scoped keys continue with 'user-<shortname>-...'; only keys in
        // the pre-scoping format (starting with the mode segment) are
        // legacy and must not be offered back.
        if (!rest.startsWith('user-') || rest.startsWith('user-unknown-')) {
          keys.push(key)
        }
      }
    }
  } catch {
    return []
  }

  return keys
}

// Snapshots written before user scoping cannot be attributed to an account.
// Evict them on first scoped library mount so they are never offered back.
export function clearLegacyUnscopedSnapshots(): void {
  for (const key of legacyUnscopedSnapshotKeys()) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // best effort
    }
  }
}

export function saveWizardSnapshot(options: {
  userKey: string
  mode: ActivityWizardMode
  activityType: string
  sourceId?: string
  values: CreationFormValues | Record<string, unknown>
  selectedElements?: Record<number, Element>
}): boolean {
  if (options.mode === 'edit' || options.userKey === 'user-unknown') {
    return false
  }

  try {
    const payload: WizardSnapshotPayload = {
      version: SNAPSHOT_VERSION,
      mode: options.mode,
      activityType: options.activityType,
      sourceId: options.sourceId,
      savedAt: new Date().toISOString(),
      values: serializeValue(options.values) as Record<string, unknown>,
      selectedElements: serializeValue(
        options.selectedElements ?? {}
      ) as Record<string, unknown>,
    }

    window.localStorage.setItem(
      buildSnapshotKey(options),
      JSON.stringify(payload)
    )

    return true
  } catch {
    return false
  }
}

// Single validate-and-evict reader shared by the availability check and the
// load path: malformed JSON or payloads are removed and reported as absent
// so a corrupt snapshot is never offered or hydrated.
function readValidatedSnapshot(options: {
  userKey: string
  mode: ActivityWizardMode
  activityType: string
  sourceId?: string
}): WizardSnapshotPayload | undefined {
  const key = buildSnapshotKey(options)

  const evict = (): undefined => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // best effort
    }
    return undefined
  }

  let raw: string | null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    return undefined
  }

  if (!raw) {
    return undefined
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return evict()
  }

  if (!isPlainObject(parsed)) {
    return evict()
  }

  const payload = parsed as unknown as WizardSnapshotPayload
  const valuesOk =
    isPlainObject(payload.values) &&
    validateFormValues(payload.activityType, payload.values)
  const selectionOk =
    payload.selectedElements === undefined ||
    isSelectedElements(payload.selectedElements)

  if (
    payload.version !== SNAPSHOT_VERSION ||
    payload.mode !== options.mode ||
    payload.activityType !== options.activityType ||
    payload.sourceId !== options.sourceId ||
    typeof payload.savedAt !== 'string' ||
    Number.isNaN(Date.parse(payload.savedAt)) ||
    !hasValidDateMarkers(payload) ||
    !valuesOk ||
    !selectionOk
  ) {
    return evict()
  }

  return payload
}

export function loadWizardSnapshot<T extends CreationFormValues>(options: {
  userKey: string
  mode: ActivityWizardMode
  activityType: string
  sourceId?: string
}): WizardSnapshot<T> | undefined {
  if (options.mode === 'edit' || options.userKey === 'user-unknown') {
    return undefined
  }

  const payload = readValidatedSnapshot(options)

  if (!payload) {
    return undefined
  }

  return {
    values: deserializeValue(payload.values) as T,
    ...(payload.selectedElements === undefined
      ? {}
      : {
          selectedElements: deserializeValue(
            payload.selectedElements
          ) as Record<number, Element>,
        }),
  }
}

// The wizard snapshot key must be scoped to the signed-in account so two
// lecturers sharing a browser profile can never see or restore each other's
// draft activity data. While the profile query is loading, use an invalid
// placeholder that cannot be read or written; the key becomes usable once
// the profile arrives.
export function useWizardUserKey(): string {
  const { data } = useQuery(UserProfileDocument)
  const shortname = data?.userProfile?.shortname

  return shortname ? 'user-' + encodeURIComponent(shortname) : 'user-unknown'
}

export function clearWizardSnapshot(options: {
  userKey: string
  mode: ActivityWizardMode
  activityType: string
  sourceId?: string
}): void {
  try {
    window.localStorage.removeItem(buildSnapshotKey(options))
  } catch {
    // Storage cleanup is best effort and must not prevent the wizard from
    // closing when browser storage is unavailable.
  }
}

export function hasWizardSnapshot(options: {
  userKey: string
  mode: ActivityWizardMode
  activityType: string
  sourceId?: string
}): boolean {
  return (
    options.mode !== 'edit' &&
    options.userKey !== 'user-unknown' &&
    readValidatedSnapshot(options) !== undefined
  )
}

interface ActivityWizardRecoveryOptions<T extends CreationFormValues> {
  snapshot: {
    mode: ActivityWizardMode
    activityType: string
    sourceId?: string
  }
  form: {
    data: T
    ref: { current: FormikProps<T> | null }
    setData: Dispatch<SetStateAction<T>>
  }
  elements: {
    selected: Record<number, Element>
    restore: (selection: Record<number, Element>) => void
  }
  lifecycle: {
    isCompleted: boolean
    close: () => void
  }
}

export function useActivityWizardRecovery<T extends CreationFormValues>({
  snapshot: { mode, activityType, sourceId },
  form: { data: formData, ref: formRef, setData: setFormData },
  elements: { selected: selection, restore: restoreSelection },
  lifecycle: { isCompleted, close },
}: ActivityWizardRecoveryOptions<T>) {
  const editMode = mode === 'edit'
  const userKey = useWizardUserKey()
  const recoveryOptions = useMemo(
    () => ({ userKey, mode, activityType, sourceId }),
    [activityType, mode, sourceId, userKey]
  )
  const readCurrentValues = useCallback(
    () => formRef.current?.values,
    [formRef]
  )
  const isClosingRef = useRef(false)
  const hasPersistedSnapshotRef = useRef(false)
  const initialDataRef = useRef(formData)
  const isWizardDirty = useCallback(() => {
    // Course metadata is derived when the settings step mounts, so it does
    // not represent a lecturer edit on an otherwise pristine wizard.
    const merged = {
      ...initialDataRef.current,
      ...formData,
      ...formRef.current?.values,
    }

    return (
      Object.keys(selection).length > 0 ||
      !isEqual(
        omit(initialDataRef.current, DERIVED_COURSE_FIELDS),
        omit(merged, DERIVED_COURSE_FIELDS)
      )
    )
  }, [formData, formRef, selection])
  const [recoveryAvailable, setRecoveryAvailable] = useState(() =>
    hasWizardSnapshot(recoveryOptions)
  )

  // Snapshots written before user scoping cannot be attributed to an
  // account, so drop them once on mount instead of offering them back.
  useEffect(() => {
    clearLegacyUnscopedSnapshots()
  }, [])

  // The user key resolves asynchronously from the profile query; re-check
  // for a snapshot when it lands so a saved draft is still offered.
  useEffect(() => {
    setRecoveryAvailable(hasWizardSnapshot(recoveryOptions))
  }, [recoveryOptions])

  // Steps commit values to formData only on navigation. Sample the mounted
  // Formik step so reload recovery also observes in-progress edits.
  useEffect(() => {
    if (isCompleted || editMode || recoveryAvailable) {
      return
    }

    const sampler = setInterval(() => {
      setFormData((previous) => {
        const merged = { ...previous, ...readCurrentValues() }
        return isEqual(previous, merged) ? previous : merged
      })
    }, 1000)

    return () => clearInterval(sampler)
  }, [editMode, isCompleted, readCurrentValues, recoveryAvailable, setFormData])

  useEffect(() => {
    if (isCompleted || editMode || recoveryAvailable) {
      return
    }

    if (!isWizardDirty()) {
      // Only clear a snapshot written by this mounted wizard. An existing
      // recovery candidate survives until the lecturer loads or discards it.
      if (hasPersistedSnapshotRef.current) {
        clearWizardSnapshot(recoveryOptions)
        hasPersistedSnapshotRef.current = false
        setRecoveryAvailable(false)
      }
      return
    }

    const timer = setTimeout(() => {
      if (isClosingRef.current) {
        return
      }

      if (
        saveWizardSnapshot({
          ...recoveryOptions,
          values: { ...formData, ...readCurrentValues() },
          selectedElements: selection,
        })
      ) {
        hasPersistedSnapshotRef.current = true
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [
    formData,
    editMode,
    isCompleted,
    isWizardDirty,
    readCurrentValues,
    recoveryAvailable,
    recoveryOptions,
    selection,
  ])

  // A completed activity must never be offered as an interrupted draft.
  useEffect(() => {
    if (isCompleted) {
      clearWizardSnapshot(recoveryOptions)
      setRecoveryAvailable(false)
    }
  }, [isCompleted, recoveryOptions])

  const handleRecover = () => {
    const restored = loadWizardSnapshot<T>(recoveryOptions)

    if (restored) {
      setFormData((previous) => ({ ...previous, ...restored.values }))
      // A mounted step owns its Formik state independently from formData, so
      // hydrate both stores to make recovery visible without changing steps.
      formRef.current?.setValues({
        ...formRef.current.values,
        ...restored.values,
      })
      if (restored.selectedElements) {
        restoreSelection(restored.selectedElements)
      }
    }

    setRecoveryAvailable(false)
  }

  const handleDiscardRecovery = () => {
    clearWizardSnapshot(recoveryOptions)
    setRecoveryAvailable(false)
  }

  const closeWizardAndClearSnapshot = useCallback(() => {
    // A pending debounce must not recreate the snapshot after an explicit
    // close, regardless of whether the close guard needed confirmation.
    isClosingRef.current = true
    clearWizardSnapshot(recoveryOptions)
    close()
  }, [close, recoveryOptions])

  return {
    recoveryProps: {
      isDirty: isWizardDirty,
      recoveryAvailable: recoveryAvailable && !editMode,
      onRecover: handleRecover,
      onDiscardRecovery: handleDiscardRecovery,
    },
    closeWizardAndClearSnapshot,
  }
}
