import { indexToLetter } from './charts'

describe('charts', () => {
  const data = [
    { index: 0, letter: 'A' },
    { index: 1, letter: 'B' },
    { index: 24, letter: 'AA' },
    { index: 48, letter: 'AAA' },
  ]

  it('convert integer index to letter', () => {
    for (let i = 0; i < data.length; i++) {
      expect(indexToLetter(data[i].index)).toEqual(data[i].letter)
    }
  })
})
