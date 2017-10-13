const AuthService = require('../services/auth')
const { UserModel } = require('../models')

/* ----- queries ----- */
const authUserByIDQuery = (parentValue, args, { auth }) => UserModel.findById(auth.sub)
const userByIDQuery = parentValue => UserModel.findById(parentValue.user)

/* ----- mutations ----- */
const createUserMutation = (parentValue, { user: { email, password, shortname } }) =>
  AuthService.signup(email, password, shortname)

const loginMutation = (parentValue, { email, password }, { res }) =>
  AuthService.login(res, email, password)

module.exports = {
  // queries
  authUser: authUserByIDQuery,
  user: userByIDQuery,

  // mutations
  createUser: createUserMutation,
  login: loginMutation,
}
