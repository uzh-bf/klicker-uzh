import { filterQuestions } from './filters'

const questions = [
  {
    id: '1',
    tags: ['Tag 1', 'Tag 2', 'Tag 3'],
    title: 'Question 1',
    type: 'SC',
  },
  {
    id: '2',
    tags: ['Tag 1', 'Tag 4', 'Tag 5'],
    title: 'Question 2',
    type: 'MC',
  },
  {
    id: '3',
    tags: ['Tag 1', 'Tag 6', 'Tag 7'],
    title: 'Question 3',
    type: 'FREE',
  },
  {
    id: '4',
    tags: ['Tag 1', 'Tag 4', 'Tag 5'],
    title: 'Question 4',
    type: 'SC',
  },
]

expect.addSnapshotSerializer({
  print: val => `Question #${val.id}
  - Title: ${val.title}
  - Tags: ${val.tags}
  - Type: ${val.type}`,
  test: val => val.id && val.tags && val.title && val.type,
})

describe('filterQuestions', () => {
  it('returns all on empty filter', () => {
    expect(filterQuestions(questions, {})).toMatchSnapshot()
  })
  it('filters by title', () => {
    expect(filterQuestions(questions, { title: 'tion 1' })).toMatchSnapshot()
    expect(filterQuestions(questions, { title: 'nonexistent' })).toMatchSnapshot()
  })
  it('filters by tags', () => {
    expect(filterQuestions(questions, { tags: ['Tag 1'] })).toMatchSnapshot()
    expect(filterQuestions(questions, { tags: ['Tag 6'] })).toMatchSnapshot()
    expect(filterQuestions(questions, { tags: ['Tag 1', 'Tag 6'] }))
    expect(filterQuestions(questions, { tags: ['nonexistent'] })).toMatchSnapshot()
  })
  it('filters by type', () => {
    expect(filterQuestions(questions, { type: 'SC' })).toMatchSnapshot()
    expect(filterQuestions(questions, { type: 'nonexistent' })).toMatchSnapshot()
  })
})
