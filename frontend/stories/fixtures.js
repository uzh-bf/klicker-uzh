const question = {
  id: '4c821db7-0940-4a24-b31a-7969104bbc9f',
  lastUsed: ['2015-02-08 14:32:11', '2016-09-09 15:22:09'],
  tags: ['CAPM', 'Risk'],
  title: 'This is a long question',
  type: 'SC',
  version: 1,
}

const questionBlock = {
  questions: [question, question, question],
  showSolutions: false,
  timeLimit: 60,
}

const session = {
  blocks: [{ questions: [], showSolutions: false, timeLimit: 60 }],
  createdAt: '2015-02-08 14:32:11',
  id: '4c821db7-0940-4a24-b31a-7969104bbc9f',
  name: 'Long session',
  status: 'created',
}

export { questionBlock, question, session }
