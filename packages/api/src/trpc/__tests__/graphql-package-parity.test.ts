import { StackFeedbackStatus } from '@klicker-uzh/types'
import { describe, expect, test } from 'vitest'
import {
  splitGroupsFinal,
  splitGroupsRunning,
} from '../../services/hatchetHandlers.js'
import { combineStackStatus } from '../../services/participantStackEvaluations.js'

function ids(count: number, start = 0) {
  return Array.from({ length: count }, (_, i) => (i + start).toString())
}

function expectGroupLengths(groups: string[][], lengths: number[]) {
  expect(groups).toHaveLength(lengths.length)
  lengths.forEach((length, ix) => {
    expect(groups[ix]).toHaveLength(length)
  })
}

describe('tRPC API package parity with GraphQL package logic tests', () => {
  test('combines stack statuses like the GraphQL response logic test', () => {
    const correct = StackFeedbackStatus.CORRECT
    const partial = StackFeedbackStatus.PARTIAL
    const wrong = StackFeedbackStatus.INCORRECT
    const unanswered = StackFeedbackStatus.UNANSWERED

    expect(
      combineStackStatus({ prevStatus: unanswered, newStatus: unanswered })
    ).toBe(unanswered)
    expect(
      combineStackStatus({ prevStatus: correct, newStatus: unanswered })
    ).toBe(correct)
    expect(
      combineStackStatus({ prevStatus: partial, newStatus: unanswered })
    ).toBe(partial)
    expect(
      combineStackStatus({ prevStatus: wrong, newStatus: unanswered })
    ).toBe(wrong)
    expect(
      combineStackStatus({ prevStatus: unanswered, newStatus: correct })
    ).toBe(correct)
    expect(
      combineStackStatus({ prevStatus: unanswered, newStatus: partial })
    ).toBe(partial)
    expect(
      combineStackStatus({ prevStatus: unanswered, newStatus: wrong })
    ).toBe(wrong)
  })

  test('splits running random group assignments like the GraphQL package test', () => {
    const participantIds = ids(10, 1)

    expect(
      splitGroupsRunning({ participantIds, preferredGroupSize: 2 })
    ).toEqual({
      groups: [
        ['1', '2'],
        ['3', '4'],
        ['5', '6'],
        ['7', '8'],
      ],
      remainingParticipantIds: ['9', '10'],
    })

    expect(
      splitGroupsRunning({ participantIds, preferredGroupSize: 3 })
    ).toEqual({
      groups: [
        ['1', '2', '3'],
        ['4', '5', '6'],
      ],
      remainingParticipantIds: ['7', '8', '9', '10'],
    })

    expect(
      splitGroupsRunning({ participantIds, preferredGroupSize: 4 })
    ).toEqual({
      groups: [['1', '2', '3', '4']],
      remainingParticipantIds: ['5', '6', '7', '8', '9', '10'],
    })

    expect(
      splitGroupsRunning({ participantIds, preferredGroupSize: 5 })
    ).toEqual({
      groups: [['1', '2', '3', '4', '5']],
      remainingParticipantIds: ['6', '7', '8', '9', '10'],
    })

    expect(
      splitGroupsRunning({ participantIds, preferredGroupSize: 6 })
    ).toEqual({ groups: [], remainingParticipantIds: participantIds })
    expect(
      splitGroupsRunning({ participantIds, preferredGroupSize: 7 })
    ).toEqual({ groups: [], remainingParticipantIds: participantIds })
  })

  test('splits large running random group assignments like the GraphQL package test', () => {
    const participantIds = ids(1000)

    const groupsOfTwo = splitGroupsRunning({
      participantIds,
      preferredGroupSize: 2,
    })
    expectGroupLengths(
      groupsOfTwo.groups,
      Array.from({ length: 499 }, () => 2)
    )
    expect(groupsOfTwo.remainingParticipantIds).toHaveLength(2)

    const groupsOf25 = splitGroupsRunning({
      participantIds,
      preferredGroupSize: 25,
    })
    expectGroupLengths(
      groupsOf25.groups,
      Array.from({ length: 39 }, () => 25)
    )
    groupsOf25.groups.forEach((group, groupIx) => {
      group.forEach((participantId, participantIx) => {
        expect(participantId).toEqual((groupIx * 25 + participantIx).toString())
      })
    })
    expect(groupsOf25.remainingParticipantIds).toHaveLength(25)

    const groupsOf26 = splitGroupsRunning({
      participantIds,
      preferredGroupSize: 26,
    })
    expectGroupLengths(
      groupsOf26.groups,
      Array.from({ length: 37 }, () => 26)
    )
    expect(groupsOf26.remainingParticipantIds).toHaveLength(38)
  })

  test('splits final random group assignments for group size 2 like the GraphQL package test', () => {
    expect(
      splitGroupsFinal({ participantIds: ['1'], preferredGroupSize: 2 })
    ).toEqual([])
    expect(
      splitGroupsFinal({ participantIds: ids(2, 1), preferredGroupSize: 2 })
    ).toEqual([['1', '2']])
    expect(
      splitGroupsFinal({ participantIds: ids(3, 1), preferredGroupSize: 2 })
    ).toEqual([['1', '2', '3']])
    expect(
      splitGroupsFinal({ participantIds: ids(4, 1), preferredGroupSize: 2 })
    ).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
    expect(
      splitGroupsFinal({ participantIds: ids(5, 1), preferredGroupSize: 2 })
    ).toEqual([
      ['1', '3', '5'],
      ['2', '4'],
    ])
    expect(
      splitGroupsFinal({ participantIds: ids(6, 1), preferredGroupSize: 2 })
    ).toEqual([
      ['1', '2'],
      ['3', '4'],
      ['5', '6'],
    ])

    const groups20 = splitGroupsFinal({
      participantIds: ids(20, 1),
      preferredGroupSize: 2,
    })
    expectGroupLengths(
      groups20,
      Array.from({ length: 10 }, () => 2)
    )
    groups20.forEach((group, ix) => {
      expect(group).toEqual([(ix * 2 + 1).toString(), (ix * 2 + 2).toString()])
    })

    const groups21 = splitGroupsFinal({
      participantIds: ids(21, 1),
      preferredGroupSize: 2,
    })
    expectGroupLengths(groups21, [3, ...Array.from({ length: 9 }, () => 2)])
    expect(groups21[0]).toEqual(['1', '11', '21'])
    for (let i = 1; i < 10; i++) {
      expect(groups21[i]).toEqual([(i + 1).toString(), (i + 11).toString()])
    }

    const groups1000 = splitGroupsFinal({
      participantIds: ids(1000),
      preferredGroupSize: 2,
    })
    expectGroupLengths(
      groups1000,
      Array.from({ length: 500 }, () => 2)
    )

    const groups1001 = splitGroupsFinal({
      participantIds: ids(1001),
      preferredGroupSize: 2,
    })
    expectGroupLengths(groups1001, [3, ...Array.from({ length: 499 }, () => 2)])
    expect(groups1001[0]).toEqual(['0', '500', '1000'])
    for (let i = 1; i < 500; i++) {
      expect(groups1001[i]).toEqual([i.toString(), (i + 500).toString()])
    }
  })

  test('splits final random group assignments for group size 3 like the GraphQL package test', () => {
    expect(
      splitGroupsFinal({ participantIds: ['1'], preferredGroupSize: 3 })
    ).toEqual([])
    expect(
      splitGroupsFinal({ participantIds: ids(2, 1), preferredGroupSize: 3 })
    ).toEqual([['1', '2']])
    expect(
      splitGroupsFinal({ participantIds: ids(3, 1), preferredGroupSize: 3 })
    ).toEqual([['1', '2', '3']])
    expect(
      splitGroupsFinal({ participantIds: ids(4, 1), preferredGroupSize: 3 })
    ).toEqual([['1', '2', '3', '4']])
    expect(
      splitGroupsFinal({ participantIds: ids(5, 1), preferredGroupSize: 3 })
    ).toEqual([
      ['1', '3', '5'],
      ['2', '4'],
    ])
    expect(
      splitGroupsFinal({ participantIds: ids(6, 1), preferredGroupSize: 3 })
    ).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6'],
    ])
    expect(
      splitGroupsFinal({ participantIds: ids(7, 1), preferredGroupSize: 3 })
    ).toEqual([
      ['1', '3', '5', '7'],
      ['2', '4', '6'],
    ])
    expect(
      splitGroupsFinal({ participantIds: ids(8, 1), preferredGroupSize: 3 })
    ).toEqual([
      ['1', '4', '7'],
      ['2', '5', '8'],
      ['3', '6'],
    ])
    expect(
      splitGroupsFinal({ participantIds: ids(9, 1), preferredGroupSize: 3 })
    ).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
    ])

    const groups49 = splitGroupsFinal({
      participantIds: ids(49, 1),
      preferredGroupSize: 3,
    })
    expectGroupLengths(groups49, [4, ...Array.from({ length: 15 }, () => 3)])
    expect(groups49[0]).toEqual(['1', '17', '33', '49'])

    const groups50 = splitGroupsFinal({
      participantIds: ids(50, 1),
      preferredGroupSize: 3,
    })
    expectGroupLengths(groups50, [...Array.from({ length: 16 }, () => 3), 2])

    const groups51 = splitGroupsFinal({
      participantIds: ids(51, 1),
      preferredGroupSize: 3,
    })
    expectGroupLengths(
      groups51,
      Array.from({ length: 17 }, () => 3)
    )
  })

  test('splits final random group assignments for group size 7 like the GraphQL package test', () => {
    expect(
      splitGroupsFinal({ participantIds: ['1'], preferredGroupSize: 7 })
    ).toEqual([])
    expect(
      splitGroupsFinal({ participantIds: ids(2, 1), preferredGroupSize: 7 })
    ).toEqual([['1', '2']])
    expect(
      splitGroupsFinal({ participantIds: ids(5, 1), preferredGroupSize: 7 })
    ).toEqual([['1', '2', '3', '4', '5']])
    expect(
      splitGroupsFinal({ participantIds: ids(7, 1), preferredGroupSize: 7 })
    ).toEqual([['1', '2', '3', '4', '5', '6', '7']])
    expect(
      splitGroupsFinal({ participantIds: ids(8, 1), preferredGroupSize: 7 })
    ).toEqual([['1', '2', '3', '4', '5', '6', '7', '8']])
    expect(
      splitGroupsFinal({ participantIds: ids(9, 1), preferredGroupSize: 7 })
    ).toEqual([
      ['1', '3', '5', '7', '9'],
      ['2', '4', '6', '8'],
    ])
    expect(
      splitGroupsFinal({ participantIds: ids(15, 1), preferredGroupSize: 7 })
    ).toEqual([
      ['1', '3', '5', '7', '9', '11', '13', '15'],
      ['2', '4', '6', '8', '10', '12', '14'],
    ])

    expectGroupLengths(
      splitGroupsFinal({ participantIds: ids(16, 1), preferredGroupSize: 7 }),
      [6, 5, 5]
    )
    expectGroupLengths(
      splitGroupsFinal({ participantIds: ids(22, 1), preferredGroupSize: 7 }),
      [8, 7, 7]
    )
    expectGroupLengths(
      splitGroupsFinal({ participantIds: ids(23, 1), preferredGroupSize: 7 }),
      [6, 6, 6, 5]
    )
    expectGroupLengths(
      splitGroupsFinal({ participantIds: ids(70, 1), preferredGroupSize: 7 }),
      Array.from({ length: 10 }, () => 7)
    )
    expectGroupLengths(
      splitGroupsFinal({ participantIds: ids(71, 1), preferredGroupSize: 7 }),
      [8, ...Array.from({ length: 9 }, () => 7)]
    )
    expectGroupLengths(
      splitGroupsFinal({ participantIds: ids(72, 1), preferredGroupSize: 7 }),
      [
        ...Array.from({ length: 6 }, () => 7),
        ...Array.from({ length: 5 }, () => 6),
      ]
    )
  })
})
