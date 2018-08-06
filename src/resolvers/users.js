const crypto = require('crypto')

const cfg = require('../klicker.conf.js')
const AccountService = require('../services/accounts')
const { UserModel } = require('../models')

const APP_CFG = cfg.get('app')

/* ----- queries ----- */
const authUserByIDQuery = (parentValue, args, { auth }) => UserModel.findById(auth.sub)
const userByIDQuery = parentValue => UserModel.findById(parentValue.user)
const checkAvailabilityQuery = (parentValue, { email, shortname }) =>
  AccountService.checkAvailability({ email, shortname })

// Generate an HMAC for user identity verification
const hmacQuery = (parentValue, args, { auth }) =>
  crypto
    .createHmac('sha256', APP_CFG.secret)
    .update(auth.sub)
    .digest('hex')

/* ----- mutations ----- */
const createUserMutation = (parentValue, { email, password, shortname, institution, useCase }) =>
  AccountService.signup(email, password, shortname, institution, useCase)

const modifyUserMutation = (parentValue, { user: { email, shortname, institution, useCase } }, { auth }) =>
  AccountService.updateAccountData({ userId: auth.sub, email, shortname, institution, useCase })

const loginMutation = (parentValue, { email, password }, { res }) => AccountService.login(res, email, password)

const logoutMutation = (parentValue, args, { res }) => AccountService.logout(res)

const requestPasswordMutation = (parentValue, { email }, { res }) => AccountService.requestPassword(res, email)

const changePasswordMutation = (parentValue, { newPassword }, { auth }) =>
  AccountService.changePassword(auth.sub, newPassword)

const requestAccountDeletionMutation = (parentValue, args, { auth }) => {
  AccountService.requestAccountDeletion(auth.sub)
  return 'ACCOUNT_DELETION_EMAIL_SENT'
}

const resolveAccountDeletionMutation = (parentValue, { deletionToken }, { auth }) =>
  AccountService.resolveAccountDeletion(auth.sub, deletionToken)

const activateAccountMutation = (parentValue, { activationToken }) => AccountService.activateAccount(activationToken)

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
  requestAccountDeletion: requestAccountDeletionMutation,
  resolveAccountDeletion: resolveAccountDeletionMutation,
  activateAccount: activateAccountMutation,
}
