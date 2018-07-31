const crypto = require('crypto')

const AuthService = require('../services/auth')
const AccountService = require('../services/accounts')
const { UserModel } = require('../models')

/* ----- queries ----- */
const authUserByIDQuery = (parentValue, args, { auth }) => UserModel.findById(auth.sub)
const userByIDQuery = parentValue => UserModel.findById(parentValue.user)
const checkAvailabilityQuery = (parentValue, { email, shortname }) =>
  AccountService.checkAvailability({ email, shortname })

// Generate an HMAC for user identity verification
const hmacQuery = (parentValue, args, { auth }) =>
  crypto
    .createHmac('sha256', process.env.APP_SECRET)
    .update(auth.sub)
    .digest('hex')

/* ----- mutations ----- */
const createUserMutation = (parentValue, { email, password, shortname, institution, useCase }) =>
  AuthService.signup(email, password, shortname, institution, useCase)

const modifyUserMutation = (parentValue, { user: { email, shortname, institution, useCase } }, { auth }) =>
  AccountService.updateAccountData({ userId: auth.sub, email, shortname, institution, useCase })

const loginMutation = (parentValue, { email, password }, { res }) => AuthService.login(res, email, password)

const logoutMutation = (parentValue, args, { res }) => AuthService.logout(res)

const requestPasswordMutation = (parentValue, { email }, { res }) => AuthService.requestPassword(res, email)

const changePasswordMutation = (parentValue, { newPassword }, { auth }) =>
  AuthService.changePassword(auth.sub, newPassword)

module.exports = {
  // queries
  authUser: authUserByIDQuery,
  user: userByIDQuery,
  hmac: hmacQuery,
  checkAvailability: checkAvailabilityQuery,

  // mutations
  changePassword: changePasswordMutation,
  createUser: createUserMutation,
  login: loginMutation,
  logout: logoutMutation,
  modifyUser: modifyUserMutation,
  requestPassword: requestPasswordMutation,
}
