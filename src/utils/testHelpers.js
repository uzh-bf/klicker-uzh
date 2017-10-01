const {
  QuestionModel, QuestionInstanceModel, SessionModel, TagModel, UserModel,
} = require('../models')
const AuthService = require('../services/auth')

const setupTestEnv = async ({ email, password, shortname }) => {
  // find the id of the user to reset
  const user = await UserModel.findOne({ email })

  // if the user already exists, delete everything associated
  if (user) {
    await Promise.all([
      QuestionInstanceModel.remove({ user: user.id }),
      SessionModel.remove({ user: user.id }),
      QuestionModel.remove({ user: user.id }),
      TagModel.remove({ user: user.id }),
      UserModel.findByIdAndRemove(user.id),
    ])
  }

  // sign up a fresh user
  return AuthService.signup(email, password, shortname)
}

module.exports = {
  setupTestEnv,
}
