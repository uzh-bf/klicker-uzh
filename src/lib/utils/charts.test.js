import { indexToLetter } from './charts'

describe('charts', () => {
  const data = [
    { index: 0, letter: 'A' },
    { index: 1, letter: 'B' },
    { index: 25, letter: 'Z' },
    { index: 26, letter: 'AA' },
    { index: 52, letter: 'AAA' },
  ]

  it('convert integer index to letter', () => {
    for (let i = 0; i < data.length; i += 1) {
      expect(indexToLetter(data[i].index)).toEqual(data[i].letter)
    }
  })
})
