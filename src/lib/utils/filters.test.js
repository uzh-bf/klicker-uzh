import { filterQuestions } from './filters'

const questions = [
  {
    id: '1',
    tags: [{ name: 'Tag 1' }, { name: 'Tag 2' }, { name: 'Tag 3' }],
    title: 'Question 1',
    type: 'SC',
  },
  {
    id: '2',
    tags: [{ name: 'Tag 1' }, { name: 'Tag 4' }, { name: 'Tag 5' }],
    title: 'Question 2',
    type: 'MC',
  },
  {
    id: '3',
    tags: [{ name: 'Tag 1' }, { name: 'Tag 6' }, { name: 'Tag 7' }],
    title: 'Question 3',
    type: 'FREE',
  },
  {
    id: '4',
    tags: [{ name: 'Tag 1' }, { name: 'Tag 4' }, { name: 'Tag 5' }],
    title: 'Question 4',
    type: 'SC',
  },
]

expect.addSnapshotSerializer({
  print: val => `Question #${val.id}
  - Title: ${val.title}
  - Tags: ${val.tags.map(tag => tag.name)}
  - Type: ${val.type}`,
  test: val => val.id && val.tags && val.title && val.type,
})

describe('filterQuestions', () => {
  it('returns all on empty filter', () => {
    expect(filterQuestions(questions, {})).toMatchSnapshot()
  })

  it('filters by title (tion 1)', () => {
    expect(filterQuestions(questions, { title: 'tion 1' })).toMatchSnapshot()
  })

  it('filters by title (st)', () => {
    expect(filterQuestions(questions, { title: 'st' })).toMatchSnapshot()
  })

  it('filters by title (nonexistent)', () => {
    expect(filterQuestions(questions, { title: 'nonexistent' })).toMatchSnapshot()
  })

  it('filters by tags (Tag 1)', () => {
    expect(filterQuestions(questions, { tags: ['Tag 1'] })).toMatchSnapshot()
  })

  it('filters by tags (Tag 6)', () => {
    expect(filterQuestions(questions, { tags: ['Tag 6'] })).toMatchSnapshot()
  })

  it('filters by tags (Tag 1 & Tag 6)', () => {
    expect(filterQuestions(questions, { tags: ['Tag 1', 'Tag 6'] }))
  })

  it('filters by tags (nonexistent)', () => {
    expect(filterQuestions(questions, { tags: ['nonexistent'] })).toMatchSnapshot()
  })

  it('filters by type (SC)', () => {
    expect(filterQuestions(questions, { type: 'SC' })).toMatchSnapshot()
  })
  it('filters by type (nonexistent)', () => {
    expect(filterQuestions(questions, { type: 'nonexistent' })).toMatchSnapshot()
  })
})
