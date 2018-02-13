const { TagModel } = require('../models')

/* ----- queries ----- */
const allTagsQuery = async (parentValue, args, { auth }) => TagModel.find({ user: auth.sub }).sort({ name: 1 })

const tagByIDQuery = (parentValue, { id }) => TagModel.findById(id)
const tagsByPVQuery = parentValue => TagModel.find({ _id: { $in: parentValue.tags } })

module.exports = {
  // queries
  allTags: allTagsQuery,
  tag: tagByIDQuery,
  tags: tagsByPVQuery,
}
