require('dotenv').config()

const { UserInputError } = require('apollo-server-express')
const mongoose = require('mongoose')
const JWT = require('jsonwebtoken')

const AccountService = require('./accounts')
const { initializeDb } = require('../lib/test/setup')
const { Errors } = require('../constants')
const { UserModel } = require('../models')

const { ObjectId } = mongoose.Types

const appSecret = process.env.APP_SECRET

mongoose.Promise = Promise

describe('AccountService', () => {
  describe('AccountManagement', () => {
    let userId

    beforeAll(async () => {
      await initializeDb({
        mongoose,
        email: 'existinguser@bf.uzh.ch',
        shortname: 'exusr',
        withLogin: true,
      })
      ;({ userId } = await initializeDb({
        mongoose,
        email: 'testaccounts@bf.uzh.ch',
        shortname: 'accnts',
        withLogin: true,
        withQuestions: true,
      }))
    })

    afterAll(async (done) => {
      userId = undefined
      await mongoose.disconnect(done)
    })

    describe('checkAvailability', () => {
      it('throws on invalid email', async () => {
        expect(
          AccountService.checkAvailability({
            email: 'testblaa',
            shortname: 'testblee',
          })
        ).rejects.toThrow(new UserInputError('INVALID_INPUT'))
      })

      it('throws on invalid shortname', async () => {
        expect(
          AccountService.checkAvailability({
            email: 'testblaa@bf.uzh.ch',
            shortname: 'A',
          })
        ).rejects.toThrow(new UserInputError('INVALID_INPUT'))
      })

      it('returns a correct response for valid email', async () => {
        const result = await AccountService.checkAvailability({
          email: 'existinguser@bf.uzh.ch',
          shortname: undefined,
        })
        expect(result.email).toBeFalsy()
        expect(result.shortname).toBeUndefined()
      })

      it('returns a correct response for valid shortname', async () => {
        const result = await AccountService.checkAvailability({
          email: undefined,
          shortname: 'exusr',
        })
        expect(result.email).toBeUndefined()
        expect(result.shortname).toBeFalsy()
      })

      it('returns a correct response for valid email and shortname', async () => {
        const result = await AccountService.checkAvailability({
          email: 'nonexistent@bf.uzh.ch',
          shortname: 'nonexst',
        })
        expect(result.email).toBeTruthy()
        expect(result.shortname).toBeTruthy()
      })
    })

    describe('updateAccountData', () => {
      it('prevents changing the email address to an already existing one', async () => {
        await expect(
          AccountService.updateAccountData({
            userId,
            email: 'existinguser@bf.uzh.ch',
          })
        ).rejects.toThrow(new UserInputError(Errors.EMAIL_NOT_AVAILABLE))
      })

      it('prevents changing the shortname to an already existing one', async () => {
        await expect(
          AccountService.updateAccountData({
            userId,
            shortname: 'exusr',
          })
        ).rejects.toThrow(new UserInputError(Errors.SHORTNAME_NOT_AVAILABLE))
      })

      it('prevents changing the email address to an invalid value', async () => {
        await expect(
          AccountService.updateAccountData({
            userId,
            email: 'invalidEmail@',
          })
        ).rejects.toThrow(new UserInputError(Errors.INVALID_INPUT))
      })

      it('prevents changing the shortname to an invalid value', async () => {
        await expect(
          AccountService.updateAccountData({
            userId,
            shortname: 'B',
          })
        ).rejects.toThrow(new UserInputError(Errors.INVALID_INPUT))
      })

      it('allows changing user data with valid values', async () => {
        await expect(
          AccountService.updateAccountData({
            userId,
            email: 'changed1@bf.uzh.ch',
            shortname: 'accnts4',
            institution: 'testing4',
            useCase: 'something4',
          })
        ).resolves.toMatchObject({
          id: userId,
          // TODO enable after migration
          // email: 'changed1@bf.uzh.ch',
          institution: 'testing4',
          shortname: 'accnts4',
          useCase: 'something4',
        })
      })
    })

    let deletionToken
    describe('requestAccountDeletion', () => {
      it('throws for an invalid user', async () => {
        await expect(AccountService.requestAccountDeletion(ObjectId())).rejects.toThrow(
          new UserInputError(Errors.INVALID_USER)
        )
      })

      it('generates a valid deletion JWT', async () => {
        deletionToken = await AccountService.requestAccountDeletion(userId)
        expect(JWT.verify(deletionToken, appSecret)).toBeTruthy()
      })
    })

    describe('resolveAccountDeletion', () => {
      it('correctly performs account deletion', async () => {
        await AccountService.resolveAccountDeletion(userId)
      })
    })
  })

  describe('Authentication', () => {
    beforeAll(async () => {
      await initializeDb({
        mongoose,
        email: 'testauth@bf.uzh.ch',
        shortname: 'auth',
      })
    })
    afterAll((done) => {
      mongoose.disconnect(done)
    })

    /* Not used anymore, is tested by the shield tests now
    describe('isAuthenticated', () => {
      it('correctly validates authentication state', () => {
        const auth1 = null
        const auth2 = {}
        const auth3 = { sub: null }
        const auth4 = { sub: 'abcd' }

        expect(AccountService.isAuthenticated(auth1)).toEqual(false)
        expect(AccountService.isAuthenticated(auth2)).toEqual(false)
        expect(AccountService.isAuthenticated(auth3)).toEqual(false)
        expect(AccountService.isAuthenticated(auth4)).toEqual(true)
      })
    })

    describe('requireAuth', () => {
      it('restricts access to authenticated users', () => {
        const auth1 = null
        const auth2 = {}
        const auth3 = { sub: null }
        const auth4 = { sub: 'abcd' }

        const wrappedFunction = AccountService.requireAuth(() => 'something')

        expect(() => wrappedFunction(null, null, { auth: auth1 })).toThrow('INVALID_LOGIN')
        expect(() => wrappedFunction(null, null, { auth: auth2 })).toThrow('INVALID_LOGIN')
        expect(() => wrappedFunction(null, null, { auth: auth3 })).toThrow('INVALID_LOGIN')
        expect(wrappedFunction(null, null, { auth: auth4 })).toEqual('something')
      })
    })
    */

    describe('isValidJWT', () => {
      it('correctly validates JWTs', () => {
        const jwt1 = null
        const jwt2 = 'abcd'
        const jwt3 = JWT.sign({ id: 'abcd' }, appSecret)

        expect(AccountService.isValidJWT(jwt1, appSecret)).toBeFalsy()
        expect(AccountService.isValidJWT(jwt2, appSecret)).toBeFalsy()
        expect(AccountService.isValidJWT(jwt3, appSecret)).toBeTruthy()
      })
    })

    describe('getToken', () => {
      const baseReq = {
        cookies: {},
        headers: {},
      }
      const validJWT = JWT.sign({ id: 'abcd' }, appSecret)

      it('handles nonexistent tokens', () => {
        expect(AccountService.getToken(baseReq)).toBeNull()
      })

      it('extracts tokens from cookies', () => {
        // invalid JWT handling
        expect(AccountService.getToken({ ...baseReq, cookies: { jwt: 'invalid-token' } })).toBeNull()

        // valid JWT handling
        expect(AccountService.getToken({ ...baseReq, cookies: { jwt: validJWT } })).toEqual(validJWT)
      })

      it('extracts tokens from headers', () => {
        // invalid JWT handling
        expect(
          AccountService.getToken({
            ...baseReq,
            headers: {
              authorization: 'Bearer invalid-token',
            },
          })
        ).toBeNull()

        // valid JWT handling
        expect(
          AccountService.getToken({
            ...baseReq,
            headers: {
              authorization: `Bearer ${validJWT}`,
            },
          })
        ).toEqual(validJWT)
      })
    })

    describe('signup', () => {
      it.each`
        email                | password       | expected
        ${'invalidEmail'}    | ${'validPass'} | ${new UserInputError(Errors.INVALID_EMAIL)}
        ${'valid@bf.uzh.ch'} | ${'ps'}        | ${new UserInputError(Errors.INVALID_PASSWORD)}
      `('fails with invalid email or password', ({ email, password, expected }) => {
        expect(AccountService.signup(email, password, 'validsrt', 'Institution', 'Testing...')).rejects.toThrowError(
          expected
        )
      })
      it.each`
        shortname
        ${'toolongshort'}
        ${'sh'}
        ${'srt-inv'}
      `('fails with invalid shortname', ({ shortname }) => {
        expect(AccountService.signup(shortname, 'Institution', 'Testing...')).rejects.toThrow()
      })

      it.each`
        email                  | expected
        ${'Abc.Abc@BF.uzh.CH'} | ${'abc.abc@bf.uzh.ch'}
        ${'abc.abc@gmail.com'} | ${'abcabc@gmail.com'}
      `('normalizes emails', async ({ email, expected }) => {
        await UserModel.findOneAndRemove({ email: expected })

        const newUser = await AccountService.signup(email, 'somePassword', 'normaliz', 'IBF Test', 'Testing...')
        expect(newUser.email).toEqual(expected)

        await UserModel.findOneAndRemove({ email: expected })
      })

      it('works with valid user data', async () => {
        // remove a user with the given test email if he already exists
        await UserModel.findOneAndRemove({ email: 'testsignup@bf.uzh.ch' })

        // try creating a new user with valid data
        const newUser = await AccountService.signup(
          'testsignup@bf.uzh.ch',
          'somePassword',
          'signup',
          'IBF Testitution',
          'Work stuff..'
        )

        // expect the new user to contain correct data
        expect(newUser).toEqual(
          expect.objectContaining({
            email: 'testsignup@bf.uzh.ch',
            shortname: 'signup',
            institution: 'IBF Testitution',
            useCase: 'Work stuff..',
            isAAI: false,
            isActive: false,
          })
        )

        // expect the password to not be the same (as it is hashed)
        expect(newUser.password).not.toEqual('somePassword')
      })
    })

    describe('login', () => {
      // mock the response object
      // let it save the params to res.cookie(...) into a temporary cookieStore
      let cookieStore
      const res = {
        cookie: (...params) => {
          cookieStore = params
        },
      }

      afterAll(() => {
        cookieStore = undefined
      })

      it('fails with invalid email', () => {
        expect(AccountService.login(res, 'thisisinvalid', 'abcd')).rejects.toEqual(
          new UserInputError(Errors.INVALID_EMAIL)
        )

        // expect that cookies should not have been touched
        expect(cookieStore).toBeUndefined()
      })

      it('fails with wrong email/password combination', () => {
        // expect the login to fail and the promise to reject
        expect(AccountService.login(res, 'blaa@bluub.com', 'abcd')).rejects.toEqual(new Error('INVALID_LOGIN'))

        // expect that cookies should not have been touched
        expect(cookieStore).toBeUndefined()
      })

      it('works with a real user', async () => {
        const userId = await AccountService.login(res, 'testauth@bf.uzh.ch', 'somePassword')

        // expect the returned user to contain the correct email and shortname
        // the shortname is only saved in the database (thus the connection must work)
        expect(userId).toBeTruthy()

        // expect a new cookie to have been set
        expect(cookieStore[0]).toEqual('jwt')
      })

      it('allows changing the password', async () => {
        // expect the old login to work and the promise to resolve
        const userId = await AccountService.login(res, 'testauth@bf.uzh.ch', 'somePassword')
        expect(userId).toBeTruthy()

        // change the user's password
        const updatedUser = await AccountService.changePassword(userId, 'someOtherPassword')
        expect(updatedUser).toEqual(
          expect.objectContaining({
            email: 'testauth@bf.uzh.ch',
            shortname: 'auth',
          })
        )

        // expect the old login to fail and the promise to reject
        expect(AccountService.login(res, 'testauth@bf.uzh.ch', 'somePassword')).rejects.toEqual(
          new Error('INVALID_LOGIN')
        )

        // expect the new login to work
        expect(AccountService.login(res, 'testauth@bf.uzh.ch', 'someOtherPassword')).resolves.toBeTruthy()
      })

      it('allows logging the user out', async () => {
        // expect the login to work and the promise to resolve
        const userId = await AccountService.login(res, 'testauth@bf.uzh.ch', 'someOtherPassword')
        expect(userId).toBeTruthy()

        // expect a new cookie to have been set
        expect(cookieStore[0]).toEqual('jwt')

        // logout
        await AccountService.logout(res)

        // TODO: expect something
      })

      it('allows requesting a password reset link', async () => {})
    })
  })
})
