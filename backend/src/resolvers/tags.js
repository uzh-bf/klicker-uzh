const { TagModel } = require('../models')
const { ensureLoaders } = require('../lib/utils')
/* ----- queries ----- */
const allTagsQuery = async (parentValue, args, { auth, loaders }) => {
  // get all the tags for the given user
  const results = await TagModel.find({ user: auth.sub }).sort({ name: 1 })

  // prime the dataloader cache
  results.forEach(tag => ensureLoaders(loaders).tags.prime(tag.id, tag))

  return results
}

const tagByIDQuery = (parentValue, { id }, { loaders }) => ensureLoaders(loaders).tags.load(id)
const tagsByPVQuery = (parentValue, args, { loaders }) => ensureLoaders(loaders).tags.loadMany(parentValue.tags)

module.exports = {
  // queries
  allTags: allTagsQuery,
  tag: tagByIDQuery,
  tags: tagsByPVQuery,
}
