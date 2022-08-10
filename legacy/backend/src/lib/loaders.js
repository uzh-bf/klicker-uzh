const DataLoader = require('dataloader')
const { QuestionInstanceModel, SessionModel, QuestionModel, TagModel, FileModel } = require('@klicker-uzh/db')

// create a mapping from a mongo result array to a dataloader array
function createMapping(arr) {
  const mapping = {}
  arr.forEach((item) => {
    mapping[item.id] = item
  })
  return mapping
}

// create a factory function for simple dataloaders
// optionally provided authentication enables user-scoped loaders
const createBasicLoader = (model) => (auth) =>
  new DataLoader(async (ids) => {
    const query = { _id: { $in: ids } }

    // if the request was authenticated, inject the subject into the loader
    if (typeof auth !== 'undefined') {
      query.user = auth.sub
    }

    const results = await model.find(query)
    const mapping = createMapping(results)
    return ids.map((id) => mapping[id])
  })

// setup the real loaders using the factory
const tagsLoader = createBasicLoader(TagModel)
const questionsLoader = createBasicLoader(QuestionModel)
const sessionsLoader = createBasicLoader(SessionModel)
const questionInstancesLoader = createBasicLoader(QuestionInstanceModel)
const filesLoader = createBasicLoader(FileModel)

const createLoaders = (auth) => ({
  files: filesLoader(auth),
  questions: questionsLoader(auth),
  questionInstances: questionInstancesLoader(auth),
  sessions: sessionsLoader(auth),
  tags: tagsLoader(auth),
})

const ensureLoaders = (loaders) => {
  if (!loaders) {
    throw new Error('LOADERS_NOT_INITIALIZED')
  }

  return loaders
}

module.exports = {
  createLoaders,
  questions: questionsLoader,
  questionInstances: questionInstancesLoader,
  sessions: sessionsLoader,
  tags: tagsLoader,
  files: filesLoader,
  ensureLoaders,
}
