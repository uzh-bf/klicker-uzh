const AuthService = require('../services/auth')
const { TagModel, UserModel } = require('../models')

/* ----- queries ----- */
const allTagsQuery = async (parentValue, args, { auth }) => {
  AuthService.isAuthenticated(auth)

  const user = await UserModel.findById(auth.sub).populate(['tags'])
  return user.tags
}

/* ----- mutations ----- */
const createTagMutation = async (parentValue, { tag: { name } }, { auth }) => {
  AuthService.isAuthenticated(auth)

  const newTag = await new TagModel({
    name,
  }).save()

  const user = await UserModel.findById(auth.sub)

  await user.update({
    $set: { tags: [...user.tags, newTag.id] },
    $currentDate: { updatedAt: true },
  })

  return newTag
}

module.exports = {
  allTags: allTagsQuery,
  createTag: createTagMutation,
}
