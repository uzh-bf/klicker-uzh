import {
  splitGroupsFinal,
  splitGroupsRunning,
} from '../src/lib/randomizedGroups.js'

describe('@klicker-uzh/graphql', () => {
  it('Test the random group assignment on a running basis', () => {
    const participantIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

    // split into groups of 2
    const {
      groups: groups0,
      remainingParticipantIds: remainingParticipantIds0,
    } = splitGroupsRunning({ participantIds, preferredGroupSize: 2 })
    expect(groups0).toHaveLength(4)
    expect(groups0[0]).toHaveLength(2)
    expect(groups0[0]).toEqual(['1', '2'])
    expect(groups0[1]).toHaveLength(2)
    expect(groups0[1]).toEqual(['3', '4'])
    expect(groups0[2]).toHaveLength(2)
    expect(groups0[2]).toEqual(['5', '6'])
    expect(groups0[3]).toHaveLength(2)
    expect(groups0[3]).toEqual(['7', '8'])
    expect(remainingParticipantIds0).toHaveLength(2)

    // split into groups of 3
    const {
      groups: groups1,
      remainingParticipantIds: remainingParticipantIds1,
    } = splitGroupsRunning({ participantIds, preferredGroupSize: 3 })
    expect(groups1).toHaveLength(2)
    expect(groups1[0]).toHaveLength(3)
    expect(groups1[0]).toEqual(['1', '2', '3'])
    expect(groups1[1]).toHaveLength(3)
    expect(groups1[1]).toEqual(['4', '5', '6'])
    expect(remainingParticipantIds1).toHaveLength(4)

    // split into groups of 4
    const {
      groups: groups2,
      remainingParticipantIds: remainingParticipantIds2,
    } = splitGroupsRunning({ participantIds, preferredGroupSize: 4 })
    expect(groups2).toHaveLength(1)
    expect(groups2[0]).toHaveLength(4)
    expect(groups2[0]).toEqual(['1', '2', '3', '4'])
    expect(remainingParticipantIds2).toHaveLength(6)

    // split into groups of 5
    const {
      groups: groups3,
      remainingParticipantIds: remainingParticipantIds3,
    } = splitGroupsRunning({ participantIds, preferredGroupSize: 5 })
    expect(groups3).toHaveLength(1)
    expect(groups3[0]).toHaveLength(5)
    expect(groups3[0]).toEqual(['1', '2', '3', '4', '5'])
    expect(remainingParticipantIds3).toHaveLength(5)

    // split into groups of 6
    const {
      groups: groups4,
      remainingParticipantIds: remainingParticipantIds4,
    } = splitGroupsRunning({ participantIds, preferredGroupSize: 6 })
    expect(groups4).toHaveLength(0)
    expect(remainingParticipantIds4).toHaveLength(10)

    // split into groups of 7
    const {
      groups: groups5,
      remainingParticipantIds: remainingParticipantIds5,
    } = splitGroupsRunning({ participantIds, preferredGroupSize: 7 })
    expect(groups5).toHaveLength(0)
    expect(remainingParticipantIds5).toHaveLength(10)
  })

  it('Test the random group assignment on a running basis for large groups', () => {
    const participantIds = Array.from({ length: 1000 }, (_, i) => i.toString())

    // split into groups of 2
    const {
      groups: groups0,
      remainingParticipantIds: remainingParticipantIds0,
    } = splitGroupsRunning({ participantIds, preferredGroupSize: 2 })
    expect(groups0).toHaveLength(499)
    for (let i = 0; i < 499; i++) {
      expect(groups0[i]).toHaveLength(2)
    }
    expect(remainingParticipantIds0).toHaveLength(2)

    // split into groups of 25
    const {
      groups: groups1,
      remainingParticipantIds: remainingParticipantIds1,
    } = splitGroupsRunning({ participantIds, preferredGroupSize: 25 })
    expect(groups1).toHaveLength(39)
    for (let i = 0; i < 39; i++) {
      expect(groups1[i]).toHaveLength(25)
    }
    for (let i = 0; i < 39; i++) {
      for (let j = 0; j < 25; j++) {
        expect(groups1[i]?.[j]).toEqual((i * 25 + j).toString())
      }
    }
    expect(remainingParticipantIds1).toHaveLength(25)

    // split into groups of 26
    const {
      groups: groups2,
      remainingParticipantIds: remainingParticipantIds2,
    } = splitGroupsRunning({ participantIds, preferredGroupSize: 26 })
    expect(groups2).toHaveLength(37)
    for (let i = 0; i < 37; i++) {
      expect(groups2[i]).toHaveLength(26)
    }
    expect(remainingParticipantIds2).toHaveLength(38)
  })

  it('Test the random group assignment of all remaining participants for groups of 2', () => {
    // return null in case only one participant is left
    const participantIds0 = ['1']
    const groups0 = splitGroupsFinal({
      participantIds: participantIds0,
      preferredGroupSize: 2,
    })
    expect(groups0).toBeNull()

    // total 2 participants -> create one group with 2 members
    const participantIds = ['1', '2']
    const groups1 = splitGroupsFinal({ participantIds, preferredGroupSize: 2 })
    expect(groups1).not.toBeNull()
    expect(groups1).toHaveLength(1)
    expect(groups1![0]).toHaveLength(2)
    expect(groups1![0]).toEqual(['1', '2'])

    // total 3 participants -> create one group with 3 members
    const participantIds2 = ['1', '2', '3']
    const groups2 = splitGroupsFinal({
      participantIds: participantIds2,
      preferredGroupSize: 2,
    })
    expect(groups2).not.toBeNull()
    expect(groups2).toHaveLength(1)
    expect(groups2![0]).toHaveLength(3)
    expect(groups2![0]).toEqual(['1', '2', '3'])

    // total 4 participants -> create two groups with 2 members each
    const participantIds3 = ['1', '2', '3', '4']
    const groups3 = splitGroupsFinal({
      participantIds: participantIds3,
      preferredGroupSize: 2,
    })
    expect(groups3).not.toBeNull()
    expect(groups3).toHaveLength(2)
    expect(groups3![0]).toHaveLength(2)
    expect(groups3![0]).toEqual(['1', '2'])
    expect(groups3![1]).toHaveLength(2)

    // total 5 participants -> create two groups with 3 and 2 members respectively
    const participantIds4 = ['1', '2', '3', '4', '5']
    const groups4 = splitGroupsFinal({
      participantIds: participantIds4,
      preferredGroupSize: 2,
    })
    expect(groups4).not.toBeNull()
    expect(groups4).toHaveLength(2)
    expect(groups4![0]).toHaveLength(3)
    expect(groups4![0]).toEqual(['1', '3', '5'])
    expect(groups4![1]).toHaveLength(2)
    expect(groups4![1]).toEqual(['2', '4'])

    // total 6 participants -> create three groups with 2 members each
    const participantIds5 = ['1', '2', '3', '4', '5', '6']
    const groups5 = splitGroupsFinal({
      participantIds: participantIds5,
      preferredGroupSize: 2,
    })
    expect(groups5).not.toBeNull()
    expect(groups5).toHaveLength(3)
    expect(groups5![0]).toHaveLength(2)
    expect(groups5![0]).toEqual(['1', '2'])
    expect(groups5![1]).toHaveLength(2)
    expect(groups5![1]).toEqual(['3', '4'])
    expect(groups5![2]).toHaveLength(2)
    expect(groups5![2]).toEqual(['5', '6'])

    // total 20 participants -> create 10 groups with 2 members each
    const participantIds6 = Array.from({ length: 20 }, (_, i) =>
      (i + 1).toString()
    )
    const groups6 = splitGroupsFinal({
      participantIds: participantIds6,
      preferredGroupSize: 2,
    })
    expect(groups6).not.toBeNull()
    expect(groups6).toHaveLength(10)
    for (let i = 0; i < 10; i++) {
      expect(groups6![i]).toHaveLength(2)
      expect(groups6![i]).toEqual([
        (i * 2 + 1).toString(),
        (i * 2 + 2).toString(),
      ])
    }

    // total 21 participants -> create one group with 3 people and 9 groups with 2 people each
    const participantIds7 = Array.from({ length: 21 }, (_, i) =>
      (i + 1).toString()
    )
    const groups7 = splitGroupsFinal({
      participantIds: participantIds7,
      preferredGroupSize: 2,
    })
    expect(groups7).not.toBeNull()
    expect(groups7).toHaveLength(10)
    expect(groups7![0]).toHaveLength(3)
    expect(groups7![0]).toEqual(['1', '11', '21'])
    for (let i = 1; i < 10; i++) {
      expect(groups7![i]).toHaveLength(2)
      expect(groups7![i]).toEqual([(i + 1).toString(), (i + 11).toString()])
    }

    // total 1000 participants -> create 500 groups with 2 members each
    const participantIds8 = Array.from({ length: 1000 }, (_, i) => i.toString())
    const groups8 = splitGroupsFinal({
      participantIds: participantIds8,
      preferredGroupSize: 2,
    })
    expect(groups8).not.toBeNull()
    expect(groups8).toHaveLength(500)
    for (let i = 0; i < 500; i++) {
      expect(groups8![i]).toHaveLength(2)
      expect(groups8![i]).toEqual([i * 2, i * 2 + 1].map((x) => x.toString()))
    }

    // total 1001 participants -> create one group with 3 members and 499 groups with 2 members each
    const participantIds9 = Array.from({ length: 1001 }, (_, i) => i.toString())
    const groups9 = splitGroupsFinal({
      participantIds: participantIds9,
      preferredGroupSize: 2,
    })
    expect(groups9).not.toBeNull()
    expect(groups9).toHaveLength(500)
    expect(groups9![0]).toHaveLength(3)
    expect(groups9![0]).toEqual(['0', '500', '1000'])
    for (let i = 1; i < 500; i++) {
      expect(groups9![i]).toHaveLength(2)
      expect(groups9![i]).toEqual([i.toString(), (i + 500).toString()])
    }
  })

  it('Test the random group assignment of all remaining participants for groups of 3', () => {
    // return null in case only one participant is left
    const participantIds0 = ['1']
    const groups0 = splitGroupsFinal({
      participantIds: participantIds0,
      preferredGroupSize: 3,
    })
    expect(groups0).toBeNull()

    // total 2 participants -> create one group with 2 members
    const participantIds = ['1', '2']
    const groups1 = splitGroupsFinal({ participantIds, preferredGroupSize: 3 })
    expect(groups1).not.toBeNull()
    expect(groups1).toHaveLength(1)
    expect(groups1![0]).toHaveLength(2)
    expect(groups1![0]).toEqual(['1', '2'])

    // total 3 participants -> create one group with 3 members
    const participantIds2 = ['1', '2', '3']
    const groups2 = splitGroupsFinal({
      participantIds: participantIds2,
      preferredGroupSize: 3,
    })
    expect(groups2).not.toBeNull()
    expect(groups2).toHaveLength(1)
    expect(groups2![0]).toHaveLength(3)
    expect(groups2![0]).toEqual(['1', '2', '3'])

    // total 4 participants -> create one group with 4 members
    const participantIds3 = ['1', '2', '3', '4']
    const groups3 = splitGroupsFinal({
      participantIds: participantIds3,
      preferredGroupSize: 3,
    })
    expect(groups3).not.toBeNull()
    expect(groups3).toHaveLength(1)
    expect(groups3![0]).toHaveLength(4)
    expect(groups3![0]).toEqual(['1', '2', '3', '4'])

    // total 5 participants -> create two groups with 3 and 2 members respectively
    const participantIds4 = ['1', '2', '3', '4', '5']
    const groups4 = splitGroupsFinal({
      participantIds: participantIds4,
      preferredGroupSize: 3,
    })
    expect(groups4).not.toBeNull()
    expect(groups4).toHaveLength(2)
    expect(groups4![0]).toHaveLength(3)
    expect(groups4![0]).toEqual(['1', '3', '5'])
    expect(groups4![1]).toHaveLength(2)
    expect(groups4![1]).toEqual(['2', '4'])

    // total 6 participants -> create two groups with 3 members each
    const participantIds5 = ['1', '2', '3', '4', '5', '6']
    const groups5 = splitGroupsFinal({
      participantIds: participantIds5,
      preferredGroupSize: 3,
    })
    expect(groups5).not.toBeNull()
    expect(groups5).toHaveLength(2)
    expect(groups5![0]).toHaveLength(3)
    expect(groups5![0]).toEqual(['1', '2', '3'])
    expect(groups5![1]).toHaveLength(3)
    expect(groups5![1]).toEqual(['4', '5', '6'])

    // total 7 participants -> create two groups with 4 and 3 members respectively
    const participantIds6 = ['1', '2', '3', '4', '5', '6', '7']
    const groups6 = splitGroupsFinal({
      participantIds: participantIds6,
      preferredGroupSize: 3,
    })
    expect(groups6).not.toBeNull()
    expect(groups6).toHaveLength(2)
    expect(groups6![0]).toHaveLength(4)
    expect(groups6![0]).toEqual(['1', '3', '5', '7'])
    expect(groups6![1]).toHaveLength(3)
    expect(groups6![1]).toEqual(['2', '4', '6'])

    // total 8 participants -> create two groups with 3 members and one group with 2 members
    const participantIds7 = ['1', '2', '3', '4', '5', '6', '7', '8']
    const groups7 = splitGroupsFinal({
      participantIds: participantIds7,
      preferredGroupSize: 3,
    })
    expect(groups7).not.toBeNull()
    expect(groups7).toHaveLength(3)
    expect(groups7![0]).toHaveLength(3)
    expect(groups7![0]).toEqual(['1', '4', '7'])
    expect(groups7![1]).toHaveLength(3)
    expect(groups7![1]).toEqual(['2', '5', '8'])
    expect(groups7![2]).toHaveLength(2)
    expect(groups7![2]).toEqual(['3', '6'])

    // total 9 participants -> create three groups with 3 members each
    const participantIds8 = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
    const groups8 = splitGroupsFinal({
      participantIds: participantIds8,
      preferredGroupSize: 3,
    })
    expect(groups8).not.toBeNull()
    expect(groups8).toHaveLength(3)
    expect(groups8![0]).toHaveLength(3)
    expect(groups8![0]).toEqual(['1', '2', '3'])
    expect(groups8![1]).toHaveLength(3)
    expect(groups8![1]).toEqual(['4', '5', '6'])
    expect(groups8![2]).toHaveLength(3)
    expect(groups8![2]).toEqual(['7', '8', '9'])

    // total 49 participants -> create one group with 4 members and 15 groups with 3 members each
    const participantIds9 = Array.from({ length: 49 }, (_, i) =>
      (i + 1).toString()
    )
    const groups9 = splitGroupsFinal({
      participantIds: participantIds9,
      preferredGroupSize: 3,
    })
    expect(groups9).not.toBeNull()
    expect(groups9).toHaveLength(16)
    expect(groups9![0]).toHaveLength(4)
    expect(groups9![0]).toEqual(['1', '17', '33', '49'])
    for (let i = 1; i < 16; i++) {
      expect(groups9![i]).toHaveLength(3)
    }

    // total 50 participants -> create 16 groups with 3 members each and one group with two members
    const participantIds10 = Array.from({ length: 50 }, (_, i) =>
      (i + 1).toString()
    )
    const groups10 = splitGroupsFinal({
      participantIds: participantIds10,
      preferredGroupSize: 3,
    })
    expect(groups10).not.toBeNull()
    expect(groups10).toHaveLength(17)
    for (let i = 0; i < 16; i++) {
      expect(groups10![i]).toHaveLength(3)
    }
    expect(groups10![16]).toHaveLength(2)

    // total 51 participants -> create 17 groups with 3 members each
    const participantIds11 = Array.from({ length: 51 }, (_, i) =>
      (i + 1).toString()
    )
    const groups11 = splitGroupsFinal({
      participantIds: participantIds11,
      preferredGroupSize: 3,
    })
    expect(groups11).not.toBeNull()
    expect(groups11).toHaveLength(17)
    for (let i = 0; i < 17; i++) {
      expect(groups11![i]).toHaveLength(3)
    }
  })

  it('Test the random group assignment of all remaining participants for groups of 7', () => {
    // return null in case only one participant is left
    const participantIds0 = ['1']
    const groups0 = splitGroupsFinal({
      participantIds: participantIds0,
      preferredGroupSize: 7,
    })
    expect(groups0).toBeNull()

    // total 2 participants -> create one group with 2 members
    const participantIds = ['1', '2']
    const groups1 = splitGroupsFinal({ participantIds, preferredGroupSize: 7 })
    expect(groups1).not.toBeNull()
    expect(groups1).toHaveLength(1)
    expect(groups1![0]).toHaveLength(2)
    expect(groups1![0]).toEqual(['1', '2'])

    // total 5 participants -> create one group with 5 members
    const participantIds2 = ['1', '2', '3', '4', '5']
    const groups2 = splitGroupsFinal({
      participantIds: participantIds2,
      preferredGroupSize: 7,
    })
    expect(groups2).not.toBeNull()
    expect(groups2).toHaveLength(1)
    expect(groups2![0]).toHaveLength(5)
    expect(groups2![0]).toEqual(['1', '2', '3', '4', '5'])

    // total 7 participants -> create one group with 7 members
    const participantIds3 = ['1', '2', '3', '4', '5', '6', '7']
    const groups3 = splitGroupsFinal({
      participantIds: participantIds3,
      preferredGroupSize: 7,
    })
    expect(groups3).not.toBeNull()
    expect(groups3).toHaveLength(1)
    expect(groups3![0]).toHaveLength(7)
    expect(groups3![0]).toEqual(['1', '2', '3', '4', '5', '6', '7'])

    // total 8 participants -> create one group with 8 members
    const participantIds4 = ['1', '2', '3', '4', '5', '6', '7', '8']
    const groups4 = splitGroupsFinal({
      participantIds: participantIds4,
      preferredGroupSize: 7,
    })
    expect(groups4).not.toBeNull()
    expect(groups4).toHaveLength(1)
    expect(groups4![0]).toHaveLength(8)
    expect(groups4![0]).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])

    // total 9 participants -> create two groups with 5 and 4 members
    const participantIds5 = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
    const groups5 = splitGroupsFinal({
      participantIds: participantIds5,
      preferredGroupSize: 7,
    })
    expect(groups5).not.toBeNull()
    expect(groups5).toHaveLength(2)
    expect(groups5![0]).toHaveLength(5)
    expect(groups5![0]).toEqual(['1', '3', '5', '7', '9'])
    expect(groups5![1]).toHaveLength(4)
    expect(groups5![1]).toEqual(['2', '4', '6', '8'])

    // total 15 participants -> create two groups with 8 and 7 members
    const participantIds6 = Array.from({ length: 15 }, (_, i) =>
      (i + 1).toString()
    )
    const groups6 = splitGroupsFinal({
      participantIds: participantIds6,
      preferredGroupSize: 7,
    })
    expect(groups6).not.toBeNull()
    expect(groups6).toHaveLength(2)
    expect(groups6![0]).toHaveLength(8)
    expect(groups6![0]).toEqual(['1', '3', '5', '7', '9', '11', '13', '15'])
    expect(groups6![1]).toHaveLength(7)
    expect(groups6![1]).toEqual(['2', '4', '6', '8', '10', '12', '14'])

    // total 16 participants -> create three groups
    const participantIds7 = Array.from({ length: 16 }, (_, i) =>
      (i + 1).toString()
    )
    const groups7 = splitGroupsFinal({
      participantIds: participantIds7,
      preferredGroupSize: 7,
    })
    expect(groups7).not.toBeNull()
    expect(groups7).toHaveLength(3)
    expect(groups7![0]).toHaveLength(6)
    expect(groups7![1]).toHaveLength(5)
    expect(groups7![2]).toHaveLength(5)

    // total 22 participants -> create three groups
    const participantIds8 = Array.from({ length: 22 }, (_, i) =>
      (i + 1).toString()
    )
    const groups8 = splitGroupsFinal({
      participantIds: participantIds8,
      preferredGroupSize: 7,
    })
    expect(groups8).not.toBeNull()
    expect(groups8).toHaveLength(3)
    expect(groups8![0]).toHaveLength(8)
    expect(groups8![1]).toHaveLength(7)
    expect(groups8![2]).toHaveLength(7)

    // total 23 participants -> create four groups
    const participantIds9 = Array.from({ length: 23 }, (_, i) =>
      (i + 1).toString()
    )
    const groups9 = splitGroupsFinal({
      participantIds: participantIds9,
      preferredGroupSize: 7,
    })
    expect(groups9).not.toBeNull()
    expect(groups9).toHaveLength(4)
    expect(groups9![0]).toHaveLength(6)
    expect(groups9![1]).toHaveLength(6)
    expect(groups9![2]).toHaveLength(6)
    expect(groups9![3]).toHaveLength(5)

    // total 70 participants -> create 10 groups with 7 members each
    const participantIds10 = Array.from({ length: 70 }, (_, i) =>
      (i + 1).toString()
    )
    const groups10 = splitGroupsFinal({
      participantIds: participantIds10,
      preferredGroupSize: 7,
    })
    expect(groups10).not.toBeNull()
    expect(groups10).toHaveLength(10)
    for (let i = 0; i < 10; i++) {
      expect(groups10![i]).toHaveLength(7)
    }

    // total 71 participants -> create 10 groups with 8 and 7 members respectively
    const participantIds11 = Array.from({ length: 71 }, (_, i) =>
      (i + 1).toString()
    )
    const groups11 = splitGroupsFinal({
      participantIds: participantIds11,
      preferredGroupSize: 7,
    })
    expect(groups11).not.toBeNull()
    expect(groups11).toHaveLength(10)
    expect(groups11![0]).toHaveLength(8)
    for (let i = 1; i < 10; i++) {
      expect(groups11![i]).toHaveLength(7)
    }

    // total 72 participants -> create 11 groups with 6 and 7 members respectively
    const participantIds12 = Array.from({ length: 72 }, (_, i) =>
      (i + 1).toString()
    )
    const groups12 = splitGroupsFinal({
      participantIds: participantIds12,
      preferredGroupSize: 7,
    })
    expect(groups12).not.toBeNull()
    expect(groups12).toHaveLength(11)
    for (let i = 0; i < 6; i++) {
      expect(groups12![i]).toHaveLength(7)
    }
    for (let i = 6; i < 11; i++) {
      expect(groups12![i]).toHaveLength(6)
    }
  })
})
