const mongoose = require('mongoose')
const JWT = require('jsonwebtoken')

mongoose.Promise = Promise
process.env.APP_SECRET = 'hello-world'

const {
  isAuthenticated, isValidJWT, signup, login,
} = require('./auth')
const { UserModel } = require('../models')

describe('AuthService', () => {
  beforeAll(() => {
    mongoose.connect('mongodb://klicker:klicker@ds161042.mlab.com:61042/klicker-dev')
  })
  afterAll((done) => {
    mongoose.disconnect(done)
  })

  describe('isAuthenticated', () => {
    it('correctly validates authentication state', () => {
      const auth1 = null
      const auth2 = {}
      const auth3 = { sub: null }
      const auth4 = { sub: 'abcd' }

      expect(() => isAuthenticated(auth1)).toThrow('INVALID_LOGIN')
      expect(() => isAuthenticated(auth2)).toThrow('INVALID_LOGIN')
      expect(() => isAuthenticated(auth3)).toThrow('INVALID_LOGIN')
      expect(isAuthenticated(auth4)).toBeUndefined()
    })
  })

  describe('isValidJWT', () => {
    it('correctly validates JWTs', () => {
      const jwt1 = null
      const jwt2 = 'abcd'
      const jwt3 = JWT.sign({ id: 'abcd' }, 'hello-world')

      expect(isValidJWT(jwt1, 'hello-world')).toBeFalsy()
      expect(isValidJWT(jwt2, 'hello-world')).toBeFalsy()
      expect(isValidJWT(jwt3, 'hello-world')).toBeTruthy()
    })
  })

  describe('signup', () => {
    it('works with valid user data', async () => {
      // remove a user with the given test email if he already exists
      await UserModel.findOneAndRemove({ email: 'testEmail@bf.uzh.ch' })

      // try creating a new user with valid data
      const newUser = await signup('testEmail@bf.uzh.ch', 'somePassword', 'shorty')

      // expect the new user to contain correct data
      expect(newUser).toEqual(expect.objectContaining({
        email: 'testEmail@bf.uzh.ch',
        shortname: 'shorty',
        isAAI: false,
      }))

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

    it('fails with wrong email/password combination', () => {
      // expect the login to fail and the promise to reject
      expect(login(res, 'notExistent', 'abcd')).rejects.toEqual(new Error('INVALID_LOGIN'))

      // expect that cookies should not have been touched
      expect(cookieStore).toBeUndefined()
    })

    it('works with a real user', async () => {
      const user = await login(res, 'roland.schlaefli@bf.uzh.ch', 'abcd')

      // expect the returned user to contain the correct email and shortname
      // the shortname is only saved in the database (thus the connection must work)
      expect(user).toEqual(expect.objectContaining({
        email: 'roland.schlaefli@bf.uzh.ch',
        shortname: 'rsc',
      }))

      // expect a new cookie to have been set
      expect(cookieStore[0]).toEqual('jwt')
    })
  })
})
