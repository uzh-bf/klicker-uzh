const DataLoader = require('dataloader')
const {
  QuestionInstanceModel, SessionModel, QuestionModel, TagModel,
} = require('../models')

// create a mapping from a mongo result array to a dataloader array
function createMapping(arr) {
  const mapping = {}
  arr.forEach((item) => {
    mapping[item.id] = item
  })
  return mapping
}

// create a factory function for simple dataloaders
const createBasicLoader = model => auth =>
  new DataLoader(async (ids) => {
    const results = await model.find({ _id: { $in: ids }, user: auth.sub })
    const mapping = createMapping(results)
    return ids.map(id => mapping[id])
  })

// setup the real loaders using the factory
const tagsLoader = createBasicLoader(TagModel)
const questionsLoader = createBasicLoader(QuestionModel)
const sessionsLoader = createBasicLoader(SessionModel)
const questionInstancesLoader = createBasicLoader(QuestionInstanceModel)

const createLoaders = (auth) => {
  if (!auth) {
    return null
  }

  return {
    questions: questionsLoader(auth),
    questionInstances: questionInstancesLoader(auth),
    sessions: sessionsLoader(auth),
    tags: tagsLoader(auth),
  }
}

module.exports = {
  createLoaders,
  questions: questionsLoader,
  questionInstances: questionInstancesLoader,
  sessions: sessionsLoader,
  tags: tagsLoader,
}
