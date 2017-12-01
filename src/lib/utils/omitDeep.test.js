import omitDeep from './omitDeep'

describe('omitDeep', () => {
  it('omits __typename correctly', () => {
    const obj = {
      __typename: 'ABCD',
      hello: 1,
      test: 2,
      test2: {
        __typename: 'DEFG',
        content: true,
        items: [
          {
            __typename: 'ITEM',
            a: 1,
          },
          {
            __typename: 'ITEM',
            a: 2,
          },
        ],
      },
    }

    expect(omitDeep(obj, '__typename')).toEqual({
      hello: 1,
      test: 2,
      test2: {
        content: true,
        items: [{ a: 1 }, { a: 2 }],
      },
    })
  })
})
