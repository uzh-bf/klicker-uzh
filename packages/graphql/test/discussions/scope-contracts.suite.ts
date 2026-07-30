import {
  buildCourseDiscussionScopeKey,
  buildExternalBlockDiscussionScopeKey,
  buildPracticeStackDiscussionScopeKey,
  parseCourseDiscussionScopeKey,
} from '@klicker-uzh/types'
import { readFileSync } from 'node:fs'
import type { DiscussionTestContext } from './fixtures.js'

export function registerScopeContractsSuite(
  getContext: () => DiscussionTestContext
) {
  it('publishes only the embed-generation mutation in persisted manifests', () => {
    const clientManifest = JSON.parse(
      readFileSync(
        new URL('../../src/public/client.json', import.meta.url),
        'utf8'
      )
    ) as Record<string, string>
    const serverManifest = JSON.parse(
      readFileSync(
        new URL('../../src/public/server.json', import.meta.url),
        'utf8'
      )
    ) as Record<string, string>
    const operationHash = clientManifest.GenerateCourseDiscussionEmbeddingInfo

    if (!operationHash) {
      throw new Error('Embed-generation mutation is missing from client.json')
    }
    expect(serverManifest[operationHash]).toMatch(
      /^mutation GenerateCourseDiscussionEmbeddingInfo\b/
    )
    expect(
      clientManifest.GenerateCourseDiscussionCourseEmbeddingInfo
    ).toBeUndefined()
    expect(clientManifest.GetCourseDiscussionEmbeddingInfo).toBeUndefined()
    expect(
      clientManifest.GetCourseDiscussionCourseEmbeddingInfo
    ).toBeUndefined()
    expect(Object.values(serverManifest)).not.toContainEqual(
      expect.stringMatching(/^query GetCourseDiscussion.*EmbeddingInfo\b/)
    )

    const postingOperations = [
      {
        name: 'CreateCourseDiscussionThread',
        itemField: 'thread',
      },
      {
        name: 'CreateCourseDiscussionReply',
        itemField: 'reply',
      },
    ]
    for (const { name, itemField } of postingOperations) {
      const hash = clientManifest[name]
      if (!hash) throw new Error(`${name} is missing from client.json`)

      expect(serverManifest[hash]).toContain(`${itemField} {`)
      expect(serverManifest[hash]).toContain('failureCode')
    }
  })

  it('round-trips canonical course discussion scope keys', () => {
    const courseKey = buildCourseDiscussionScopeKey('course-1')
    const stackKey = buildPracticeStackDiscussionScopeKey(42)
    const externalKey = buildExternalBlockDiscussionScopeKey(
      'moodle:section',
      'block/7:question'
    )

    expect(parseCourseDiscussionScopeKey(courseKey)).toEqual({
      kind: 'course',
      courseId: 'course-1',
    })
    expect(parseCourseDiscussionScopeKey(stackKey)).toEqual({
      kind: 'practiceStack',
      stackId: 42,
    })
    expect(parseCourseDiscussionScopeKey(externalKey)).toEqual({
      kind: 'externalBlock',
      externalSource: 'moodle:section',
      externalRef: 'block/7:question',
    })
    expect(parseCourseDiscussionScopeKey('stack:0')).toBeNull()
    expect(
      parseCourseDiscussionScopeKey('stack:999999999999999999999')
    ).toBeNull()
    expect(parseCourseDiscussionScopeKey('ext:%E0%A4%A:block')).toBeNull()
  })

  it('keeps the discussion schema limited to the shipped alpha scope', async () => {
    const { prisma } = getContext()
    const removedSpaceColumns = await prisma.$queryRaw<
      Array<{ column_name: string }>
    >`
      SELECT column_name::text
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'DiscussionSpace'
        AND column_name IN ('liveQuizId')
    `

    expect(removedSpaceColumns).toHaveLength(0)

    const discussionSpaceCourseColumn = await prisma.$queryRaw<
      Array<{ is_nullable: string }>
    >`
      SELECT is_nullable::text
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'DiscussionSpace'
        AND column_name = 'courseId'
    `

    expect(discussionSpaceCourseColumn).toEqual([{ is_nullable: 'NO' }])

    const removedScopeColumns = await prisma.$queryRaw<
      Array<{ column_name: string }>
    >`
      SELECT column_name::text
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'DiscussionScope'
        AND column_name IN ('practiceQuizId', 'instanceId', 'liveBlockId')
    `

    expect(removedScopeColumns).toHaveLength(0)

    const redundantAncestryColumns = await prisma.$queryRaw<
      Array<{ table_name: string; column_name: string }>
    >`
      SELECT table_name::text, column_name::text
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'DiscussionThread' AND column_name = 'spaceId')
          OR (
            table_name = 'DiscussionReply'
            AND column_name IN ('spaceId', 'scopeId')
          )
          OR (
            table_name = 'DiscussionEvent'
            AND column_name IN ('spaceId', 'threadId', 'replyId')
          )
        )
    `

    expect(redundantAncestryColumns).toHaveLength(0)

    const discussionEventColumns = await prisma.$queryRaw<
      Array<{ column_name: string; is_nullable: string }>
    >`
      SELECT column_name::text, is_nullable::text
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'DiscussionEvent'
        AND column_name IN ('scopeId', 'subjectId')
      ORDER BY column_name
    `

    expect(discussionEventColumns).toEqual([
      { column_name: 'scopeId', is_nullable: 'NO' },
      { column_name: 'subjectId', is_nullable: 'YES' },
    ])

    const discussionEventSubjectConstraint = await prisma.$queryRaw<
      Array<{ definition: string }>
    >`
      SELECT pg_get_constraintdef(oid)::text AS definition
      FROM pg_constraint
      WHERE conname = 'DiscussionEvent_subjectId_check'
    `

    expect(discussionEventSubjectConstraint).toHaveLength(1)
    expect(discussionEventSubjectConstraint[0]?.definition).toContain(
      "'ANON_RATE_LIMITED'"
    )

    const discussionSpaceTypes = await prisma.$queryRaw<
      Array<{ label: string }>
    >`
      SELECT enumlabel::text AS label
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'DiscussionSpaceType'
      ORDER BY enumsortorder
    `

    expect(discussionSpaceTypes.map(({ label }) => label)).toEqual(['COURSE'])

    const discussionScopeTypes = await prisma.$queryRaw<
      Array<{ label: string }>
    >`
      SELECT enumlabel::text AS label
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'DiscussionScopeType'
      ORDER BY enumsortorder
    `

    expect(discussionScopeTypes.map(({ label }) => label)).toEqual([
      'COURSE',
      'PRACTICE_STACK',
      'EXTERNAL_BLOCK',
    ])
  })
}
