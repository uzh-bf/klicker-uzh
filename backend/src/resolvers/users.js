const AuthService = require('../services/auth')
const { UserModel } = require('../models')

/* ----- queries ----- */
const userQuery = (parentValue, args, { auth }) => {
  AuthService.isAuthenticated(auth)

  return UserModel.findById(auth.sub).populate(['questions', 'sessions', 'tags'])
}

/* ----- mutations ----- */
const createUserMutation = (parentValue, { user: { email, password, shortname } }) =>
  AuthService.signup(email, password, shortname)

const loginMutation = (parentValue, { email, password }, { res }) => AuthService.login(res, email, password)

module.exports = {
  createUser: createUserMutation,
  login: loginMutation,
  user: userQuery,
}
