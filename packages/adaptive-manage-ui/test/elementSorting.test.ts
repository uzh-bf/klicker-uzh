import { describe, expect, it } from 'vitest'
import { sortByName, sortByNameOrResponses } from '../src/lib/elementSorting'

const names = (items: { elementName: string }[]) =>
  items.map((item) => item.elementName)

describe('sortByName', () => {
  const items = [
    { elementName: 'Question 10' },
    { elementName: 'question 2' },
    { elementName: 'Äpfel' },
    { elementName: 'Birnen' },
    { elementName: 'Question 1' },
  ]

  it('keeps the original order by default without mutating input', () => {
    const result = sortByName(items, 'default')
    expect(result).toEqual(items)
    expect(result).not.toBe(items)
  })

  it('sorts A–Z with numeric and case-insensitive comparison', () => {
    expect(names(sortByName(items, 'nameAsc', 'de'))).toEqual([
      'Äpfel',
      'Birnen',
      'Question 1',
      'question 2',
      'Question 10',
    ])
    expect(names(items)[0]).toBe('Question 10')
  })

  it('sorts Z–A', () => {
    expect(names(sortByName(items, 'nameDesc', 'de'))).toEqual([
      'Question 10',
      'question 2',
      'Question 1',
      'Birnen',
      'Äpfel',
    ])
  })

  it('is stable for equal names', () => {
    const duplicates = [
      { elementName: 'Same', key: 'a' },
      { elementName: 'same', key: 'b' },
      { elementName: 'Same', key: 'c' },
    ]
    expect(sortByName(duplicates, 'nameAsc').map((item) => item.key)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(sortByName(duplicates, 'nameDesc').map((item) => item.key)).toEqual([
      'a',
      'b',
      'c',
    ])
  })
})

describe('sortByNameOrResponses', () => {
  const items = [
    { elementName: 'C', responseCount: 5 },
    { elementName: 'Hidden B', responseCount: null },
    { elementName: 'A', responseCount: 12 },
    { elementName: 'B', responseCount: 5 },
    { elementName: 'Hidden A', responseCount: undefined },
    { elementName: 'D', responseCount: 0 },
  ]

  it('sorts by most responses, ties by name, missing counts last', () => {
    expect(names(sortByNameOrResponses(items, 'responsesDesc'))).toEqual([
      'A',
      'B',
      'C',
      'D',
      'Hidden A',
      'Hidden B',
    ])
  })

  it('sorts by least responses, missing counts still last', () => {
    expect(names(sortByNameOrResponses(items, 'responsesAsc'))).toEqual([
      'D',
      'B',
      'C',
      'A',
      'Hidden A',
      'Hidden B',
    ])
  })

  it('delegates name and default sorts', () => {
    expect(names(sortByNameOrResponses(items, 'default'))).toEqual(names(items))
    expect(names(sortByNameOrResponses(items, 'nameAsc'))).toEqual([
      'A',
      'B',
      'C',
      'D',
      'Hidden A',
      'Hidden B',
    ])
  })
})
