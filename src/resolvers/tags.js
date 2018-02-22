const { TagModel } = require('../models')

/* ----- queries ----- */
const allTagsQuery = async (parentValue, args, { auth, loaders }) => {
  // get all the tags for the given user
  const results = await TagModel.find({ user: auth.sub }).sort({ name: 1 })

  // prime the dataloader cache
  results.forEach(tag => loaders.tags.prime(tag.id, tag))

  return results
}

const tagByIDQuery = (parentValue, { id }, { loaders }) => loaders.tags.load(id)
const tagsByPVQuery = (parentValue, args, { loaders }) => loaders.tags.loadMany(parentValue.tags)

module.exports = {
  // queries
  allTags: allTagsQuery,
  tag: tagByIDQuery,
  tags: tagsByPVQuery,
}
