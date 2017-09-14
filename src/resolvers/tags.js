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
  allTags: allTagsQuery,
  createTag: createTagMutation,
}
