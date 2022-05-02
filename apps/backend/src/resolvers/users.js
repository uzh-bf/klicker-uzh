const crypto = require('crypto')

const { UserModel } = require('@klicker-uzh/db')
const cfg = require('../klicker.conf.js')
const AccountService = require('../services/accounts')

const APP_CFG = cfg.get('app')

/* ----- queries ----- */
const allUsersQuery = () => UserModel.find().sort({ createdAt: -1 })
const authUserByIDQuery = (parentValue, args, { auth }) => UserModel.findById(auth.sub)
const userByIDQuery = (parentValue) => UserModel.findById(parentValue.user)
const checkAvailabilityQuery = (parentValue, { email, shortname }) =>
  AccountService.checkAvailability({ email, shortname })
const checkAccountStatusQuery = (parentValue, args, { auth, res }) => AccountService.checkAccountStatus({ auth, res })

// Generate an HMAC for user identity verification
const hmacQuery = (parentValue, args, { auth }) =>
  crypto.createHmac('sha256', APP_CFG.secret).update(auth.sub).digest('hex')

/* ----- mutations ----- */
const createUserMutation = (parentValue, { email, password, shortname, institution, useCase }) =>
  AccountService.signup(email, password, shortname, institution, useCase)

const deleteUserMutation = (parentValue, { id }) => {
  return AccountService.resolveAccountDeletion(id)
}
const modifyUserMutation = (parentValue, { user: { email, shortname, institution, useCase } }, { auth }) =>
  AccountService.updateAccountData({ userId: auth.sub, email, shortname, institution, useCase })

// caller param can be removed when users are also able to edit their email
const modifyUserAsAdminMutation = (parentValue, { id, user: { email, shortname, institution, role } }) => {
  return AccountService.updateAccountData({ userId: id, email, shortname, institution, role, caller: 'ADMIN' })
}

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

const movoImportMutation = (parentValue, { dataset }, { auth }) =>
  AccountService.movoImport({ userId: auth.sub, dataset })

module.exports = {
  // queries
  allUsers: allUsersQuery,
  authUser: authUserByIDQuery,
  user: userByIDQuery,
  hmac: hmacQuery,
  checkAvailability: checkAvailabilityQuery,
  checkAccountStatus: checkAccountStatusQuery,

  // mutations
  changePassword: changePasswordMutation,
  createUser: createUserMutation,
  deleteUser: deleteUserMutation,
  login: loginMutation,
  logout: logoutMutation,
  modifyUser: modifyUserMutation,
  modifyUserAsAdmin: modifyUserAsAdminMutation,
  requestPassword: requestPasswordMutation,
  requestAccountDeletion: requestAccountDeletionMutation,
  resolveAccountDeletion: resolveAccountDeletionMutation,
  activateAccount: activateAccountMutation,
  movoImport: movoImportMutation,
}
