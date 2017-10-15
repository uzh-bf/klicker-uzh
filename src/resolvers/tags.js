const { TagModel, UserModel } = require('../models')

/* ----- queries ----- */
const allTagsQuery = async (parentValue, args, { auth }) => {
  const user = await UserModel.findById(auth.sub).populate(['tags'])
  return user.tags
}

const tagByIDQuery = (parentValue, { id }) => TagModel.findById(id)
const tagsByPVQuery = parentValue => TagModel.find({ _id: { $in: parentValue.tags } })

module.exports = {
  // queries
  allTags: allTagsQuery,
  tag: tagByIDQuery,
  tags: tagsByPVQuery,
}
