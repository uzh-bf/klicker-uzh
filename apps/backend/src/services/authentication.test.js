require('dotenv').config()
const { ForbiddenError } = require('apollo-server-express')

const { Errors } = require('@klicker-uzh/db')
const AuthenticationService = require('./authentication')
const { generateScopedToken } = require('./accounts')

describe('AuthenticationService', () => {
  const dummyUser = {
    id: 'asdf1234qwertz',
    role: 'User',
    shortname: 'test',
  }

  const deletionToken = generateScopedToken(dummyUser, 'delete')

  const activationToken = generateScopedToken(dummyUser, 'activate')

  describe('TokenVerification', () => {
    it('error is returned when passed an invalid deletion token', () => {
      expect(AuthenticationService.verifyToken('invalidToken', 'delete', dummyUser.id)).toEqual(
        new ForbiddenError(Errors.INVALID_TOKEN)
      )
    })

    it('error is returned when users in deletion and auth token do not match', () => {
      expect(AuthenticationService.verifyToken(deletionToken, 'delete', 'someOtherUserId')).toEqual(
        new ForbiddenError(Errors.INVALID_TOKEN)
      )
    })

    it('error is returned when user and auth token match, but scope does not', () => {
      expect(AuthenticationService.verifyToken(deletionToken, 'activate', dummyUser.id)).toEqual(
        new ForbiddenError(Errors.INVALID_TOKEN)
      )
    })

    it('correctly verifies deletionToken', () => {
      expect(AuthenticationService.verifyToken(deletionToken, 'delete', dummyUser.id)).toBeTruthy()
    })

    it('correctly verifies activationToken', () => {
      expect(AuthenticationService.verifyToken(activationToken, 'activate', dummyUser.id)).toBeTruthy()
    })
  })

  /* Is it possible to write unit tests for the shield?

  describe('UserAuthentiction', () => {
    it('correctly validates authentication state', () => {
      const context1 = null
      const context2 = {}
      const context3 = { auth : {sub: null} }
      const context4 = { auth : {sub: 'abcd'} }

      expect(AuthenticationService.isAuthenticated(undefined, undefined, context1)).toEqual(new AuthenticationError(Errors.UNAUTHORIZED))
      expect(AuthenticationService.isAuthenticated(undefined, undefined, context2)).toEqual(new AuthenticationError(Errors.UNAUTHORIZED))
      expect(AuthenticationService.isAuthenticated(undefined, undefined, context3)).toEqual(new AuthenticationError(Errors.UNAUTHORIZED))
      expect(AuthenticationService.isAuthenticated(undefined, undefined, context4)).toEqual(true)
    })
  })
  */
})
