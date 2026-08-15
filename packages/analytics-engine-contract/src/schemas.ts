import { z } from 'zod'

import {
  ANALYTICS_ENGINE_CONTRACT_VERSION,
  COURSE_WORKFLOW_MODES,
  COURSE_WORKFLOW_NAME,
  PLATFORM_WORKFLOW_NAME,
} from './constants.js'

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const RFC3339_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

function isValidCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value)
  )
}

export const calendarDateSchema = z
  .string()
  .refine(isValidCalendarDate, 'Expected a valid YYYY-MM-DD calendar date')

export const rfc3339DateTimeSchema = z
  .string()
  .regex(RFC3339_DATETIME_PATTERN)
  .datetime({ offset: true })

type FieldDescriptor =
  | readonly ['required', 'literal', string]
  | readonly ['required', 'uuid']
  | readonly ['required', 'enum', readonly [string, ...string[]]]
  | readonly ['required', 'datetime', 'RFC3339-with-offset']
  | readonly [
      'optional',
      'calendar-date',
      'YYYY-MM-DD',
      'reject-explicit-undefined',
    ]

type FieldValue<Descriptor extends FieldDescriptor> =
  Descriptor extends readonly [
    'required',
    'literal',
    infer Value extends string,
  ]
    ? Value
    : Descriptor extends readonly [
          'required',
          'enum',
          infer Values extends readonly string[],
        ]
      ? Values[number]
      : Descriptor extends readonly ['optional', 'calendar-date', ...string[]]
        ? string | undefined
        : string

type ContractField<Descriptor extends FieldDescriptor = FieldDescriptor> = {
  readonly descriptor: Descriptor
  readonly schema: z.ZodType<FieldValue<Descriptor>>
}

type ContractFields = Readonly<Record<string, ContractField>>
type ContractShape<Fields extends ContractFields> = {
  readonly [Name in keyof Fields]: Fields[Name]['schema']
}
type DescribedField = readonly [string, ...FieldDescriptor]

function contractField<const Descriptor extends FieldDescriptor>(
  descriptor: Descriptor
): ContractField<Descriptor> {
  let schema: z.ZodTypeAny

  switch (descriptor[1]) {
    case 'literal':
      schema = z.literal(descriptor[2])
      break
    case 'uuid':
      schema = z.string().uuid()
      break
    case 'enum':
      schema = z.enum(descriptor[2])
      break
    case 'datetime':
      schema = rfc3339DateTimeSchema
      break
    case 'calendar-date':
      schema = calendarDateSchema.optional()
      break
  }

  return {
    descriptor,
    schema: schema as z.ZodType<FieldValue<Descriptor>>,
  }
}

function schemaShape<Fields extends ContractFields>(
  fields: Fields
): ContractShape<Fields> {
  return Object.fromEntries(
    Object.entries(fields).map(([name, field]) => [name, field.schema])
  ) as ContractShape<Fields>
}

function describeFields(fields: ContractFields): readonly DescribedField[] {
  return Object.entries(fields).map(
    ([name, field]) => [name, ...field.descriptor] as DescribedField
  )
}

function buildStrictContractObject<const Fields extends ContractFields>(
  fields: Fields
) {
  const explicitUndefinedFields = Object.entries(fields)
    .filter(
      ([, field]) =>
        field.descriptor[0] === 'optional' &&
        field.descriptor.at(-1) === 'reject-explicit-undefined'
    )
    .map(([name]) => name)

  const schema = z
    .object(schemaShape(fields))
    .strict()
    .superRefine((value, context) => {
      const entries = Object.entries(value)
      for (const fieldName of explicitUndefinedFields) {
        const ownField = entries.find(([name]) => name === fieldName)
        if (ownField !== undefined && ownField[1] === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [fieldName],
            message: `${fieldName} must be omitted or contain a value`,
          })
        }
      }
    })

  return {
    schema,
    descriptor: ['strict', describeFields(fields)] as const,
  }
}

const versionField = contractField([
  'required',
  'literal',
  ANALYTICS_ENGINE_CONTRACT_VERSION,
])
const runIdField = contractField(['required', 'uuid'])
const completedAtField = contractField([
  'required',
  'datetime',
  'RFC3339-with-offset',
])
const courseInputFields = {
  contractVersion: versionField,
  runId: runIdField,
  courseId: contractField(['required', 'uuid']),
  mode: contractField(['required', 'enum', COURSE_WORKFLOW_MODES]),
  windowSince: contractField([
    'optional',
    'calendar-date',
    'YYYY-MM-DD',
    'reject-explicit-undefined',
  ]),
} as const
const courseSuccessFields = {
  ...courseInputFields,
  completedAt: completedAtField,
} as const
const platformInputFields = {
  contractVersion: versionField,
  runId: runIdField,
} as const
const platformSuccessFields = {
  ...platformInputFields,
  completedAt: completedAtField,
} as const

const courseInputContract = buildStrictContractObject(courseInputFields)
const courseSuccessContract = buildStrictContractObject(courseSuccessFields)
const platformInputContract = buildStrictContractObject(platformInputFields)
const platformSuccessContract = buildStrictContractObject(platformSuccessFields)

export const courseWorkflowInputSchema = courseInputContract.schema
export const courseWorkflowSuccessSchema = courseSuccessContract.schema
export const platformWorkflowInputSchema = platformInputContract.schema
export const platformWorkflowSuccessSchema = platformSuccessContract.schema

export const canonicalContract = [
  ['generation', ANALYTICS_ENGINE_CONTRACT_VERSION],
  [
    'workflow',
    COURSE_WORKFLOW_NAME,
    [
      ['input', courseInputContract.descriptor],
      ['success', courseSuccessContract.descriptor],
    ],
  ],
  [
    'workflow',
    PLATFORM_WORKFLOW_NAME,
    [
      ['input', platformInputContract.descriptor],
      ['success', platformSuccessContract.descriptor],
    ],
  ],
] as const

export type CourseWorkflowInput = z.infer<typeof courseWorkflowInputSchema>
export type CourseWorkflowSuccess = z.infer<typeof courseWorkflowSuccessSchema>
export type PlatformWorkflowInput = z.infer<typeof platformWorkflowInputSchema>
export type PlatformWorkflowSuccess = z.infer<
  typeof platformWorkflowSuccessSchema
>
