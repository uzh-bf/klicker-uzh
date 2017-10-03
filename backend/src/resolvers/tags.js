const { TagModel, UserModel } = require('../models')

/* ----- queries ----- */
const allTagsQuery = async (parentValue, args, { auth }) => {
  const user = await UserModel.findById(auth.sub).populate(['tags'])
  return user.tags
}

const tagByIDQuery = (parentValue, { id }) => TagModel.findById(id)
const tagsByPVQuery = parentValue => TagModel.find({ _id: { $in: parentValue.tags } })

/* ----- mutations ----- */
const createTagMutation = async (parentValue, { tag: { name } }, { auth }) => {
  const newTag = new TagModel({
    name,
    user: auth.sub,
  })

  const updatedUser = UserModel.update(
    { _id: auth.sub },
    {
      $push: { tags: newTag.id },
      $currentDate: { updatedAt: true },
    },
  )

  await Promise.all([newTag.save(), updatedUser])

  return newTag
}

module.exports = {
  // queries
  allTags: allTagsQuery,
  tag: tagByIDQuery,
  tags: tagsByPVQuery,

  // mutations
  createTag: createTagMutation,
}
