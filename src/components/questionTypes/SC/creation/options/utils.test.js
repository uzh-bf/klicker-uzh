import { reorder, onDragEnd } from './utils'

expect.addSnapshotSerializer({
  print: val => val.name,
  test: val => val.name,
})

const options = [{ name: 'option 1' }, { name: 'option 2' }, { name: 'option 3' }]

describe('reorder', () => {
  it('updates order correctly', () => {
    // [1, 2, 3] => [2, 3, 1]
    const options2 = reorder(options, 0, 2)
    expect(options2).toMatchSnapshot()

    // [2, 3, 1] => [1, 2, 3]
    const options3 = reorder(options2, 2, 0)
    expect(options3).toMatchSnapshot()

    // [1, 2, 3] => [3, 1, 2]
    const options4 = reorder(options3, 2, 0)
    expect(options4).toMatchSnapshot()

    // [3, 1, 2] => [2, 3, 1]
    const options5 = reorder(options4, 2, 0)
    expect(options5).toMatchSnapshot()
  })

  it('handles overflowing indices', () => {
    // TODO
  })
})

describe('onDragEnd', () => {
  // [1, 2, 3] => [2, 3, 1]
  const result = { destination: { index: 2 }, source: { index: 0 } }

  it('handles dragging an item correctly', () => {
    onDragEnd(options, result, (reordered) => {
      expect(reordered).toMatchSnapshot()
    })
  })

  it('handles items dropped outside the dropzone', () => {
    onDragEnd(options, { ...result, destination: null }, (reordered) => {
      expect(reordered).toBeNull()
    })
  })
})
