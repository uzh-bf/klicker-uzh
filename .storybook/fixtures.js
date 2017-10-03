// @flow

const question = {
  id: '4c821db7-0940-4a24-b31a-7969104bbc9f',
  lastUsed: ['2015-02-08 14:32:11', '2016-09-09 15:22:09'],
  tags: ['CAPM', 'Risk'],
  title: 'This is a long question',
  type: 'SC',
  version: 1,
}

const questionBlock = {
  id: '4c821db7-0940-4a24-b31a-7969104bbc9f',
  questions: [question, question, question],
  showSolutions: false,
  timeLimit: 60,
}

const question2 = {
  id: question.id,
  question: {
    title: question.title,
    type: question.type,
  },
}

const questionBlock2 = {
  id: '4c821db7-0940-4a24-b31a-7969104bbc9f',
  instances: [question2, question2, question2],
  showSolutions: false,
  timeLimit: 60,
}

const session = {
  blocks: [questionBlock2],
  createdAt: '2015-02-08 14:32:11',
  id: '4c821db7-0940-4a24-b31a-7969104bbc9f',
  name: 'Long session',
  status: 'CREATED',
}

export default {
  question,
  questionBlock,
  session,
}
