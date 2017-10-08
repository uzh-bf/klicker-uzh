const question = {
  id: '4c821db7-0940-4a24-b31a-7969104bbc9f',
  lastUsed: ['2015-02-08 14:32:11', '2016-09-09 15:22:09'],
  tags: ['CAPM', 'Risk'],
  title: 'This is a long question',
  type: 'SC',
  version: 1,
}

const questionBlock = {
  key: 0,
  questions: [question, question, question],
  showSolutions: false,
  timeLimit: 60,
}

const question2 = {
  id: question.id,
  question: {
    id: '4c821db7-0940-4a24-b31a-7969104bbc9f',
    title: question.title,
    type: question.type,
  },
}

const questionBlock2 = {
  key: 1,
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

const questions = [
  {
    id: '1',
    title: 'question1',
    tags: [{ name: 'tag1' }, { name: 'tag2' }],
    instances: [{ createdAt: '06.12.1993' }],
    type: 'SC',
    versions: [0],
  },
  {
    id: '2',
    title: 'question2',
    tags: [{ name: 'tag3' }, { name: 'tag2' }],
    instances: [{ createdAt: '07.12.1993' }, { createdAt: '07.12.1994' }],
    type: 'MC',
    versions: [0, 1],
  },
]

export default {
  question,
  questions,
  questionBlock,
  questionBlock2,
  session,
}
