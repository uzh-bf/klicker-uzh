const fs = require('fs')
const path = require('path')
const handlebars = require('handlebars')
const bcrypt = require('bcryptjs')
const JWT = require('jsonwebtoken')
const nodemailer = require('nodemailer')
const _has = require('lodash/has')

const { UserModel } = require('../models')
const { sendSlackNotification } = require('./notifications')

const dev = process.env.NODE_ENV !== 'production'

// check whether an authentication object is valid
const isAuthenticated = (auth) => {
  if (auth && auth.sub) {
    return true
  }
  return false
}

// HOC to ensure the requester is authenticated
// wraps a graphql resolver
const requireAuth = wrapped => (parentValue, args, context) => {
  if (!isAuthenticated(context.auth)) {
    // redirect the user to the login page
    if (process.env.NODE_ENV !== 'test') {
      context.res.redirect('/user/login')
    }

    throw new Error('INVALID_LOGIN')
  }
  return wrapped(parentValue, args, context)
}

// check whether a JWT is valid
const isValidJWT = (jwt, secret) => {
  try {
    JWT.verify(jwt, secret)
    return true
  } catch (err) {
    return false
  }
}

// extract JWT from header or cookie
const getToken = (req) => {
  // try to parse an authorization cookie
  if (req.cookies && req.cookies.jwt && isValidJWT(req.cookies.jwt, process.env.APP_SECRET)) {
    return req.cookies.jwt
  }

  // try to parse the authorization header
  if (req.headers.authorization) {
    const split = req.headers.authorization.split(' ')

    if (split[0] === 'Bearer' && isValidJWT(split[1], process.env.APP_SECRET)) {
      return split[1]
    }
  }

  // if no token was found, but would be needed
  // additionally look for a token in the GraphQL variables
  if (_has(req, 'body[0].variables.jwt') && isValidJWT(req.body[0].variables.jwt, process.env.APP_SECRET)) {
    return req.body[0].variables.jwt
  }

  // no token found
  return null
}

// signup a new user
// make this an async function such that it returns a promise
// we can later use this promise as a return value for resolvers or similar
const signup = async (email, password, shortname) => {
  // TODO: validation etc.
  // TODO: activation of new accounts (send an email)

  // generate a salt with bcyrpt using 10 rounds
  // hash and salt the password
  const hash = bcrypt.hashSync(password, 10)

  // create a new user based on the passed data
  const newUser = await new UserModel({
    email,
    password: hash,
    shortname,
    isAAI: false,
  }).save()

  if (newUser) {
    // send a slack notification (if configured)
    sendSlackNotification(`[auth] New user has registered: ${email}, ${shortname}`)

    // return the data of the newly created user
    return newUser
  }

  throw new Error('SIGNUP_FAILED')
}

// login an existing user
// make this an async function such that it returns a promise
// we can later use this promise as a return value for resolvers or similar
const login = async (res, email, password) => {
  // look for a single user with the given email
  const user = await UserModel.findOne({ email })

  // check whether the user exists and hashed passwords match
  if (!user || !bcrypt.compareSync(password, user.password)) {
    sendSlackNotification(`[auth] Login failed for ${email}`)

    throw new Error('INVALID_LOGIN')
  }

  // generate a JWT for future authentication
  // expiresIn: one day equals 86400 seconds
  // TODO: add more necessary properties for the JWT
  const jwt = JWT.sign(
    {
      expiresIn: 86400,
      sub: user.id,
      scope: ['user'],
      shortname: user.shortname,
    },
    process.env.APP_SECRET,
  )

  // set a cookie with the generated JWT
  // domain: the domain the cookie should be valid for
  // maxAge: one day equals 86400000 milliseconds
  // path: cookie should only be valid for the graphql API
  // httpOnly: don't allow interactions from javascript
  // secure: whether the cookie should only be sent over https
  // TODO: set other important cookie settings
  if (res && res.cookie) {
    res.cookie('jwt', jwt, {
      domain: process.env.APP_DOMAIN,
      httpOnly: true,
      maxAge: 86400000,
      path: process.env.APP_PATH ? `${process.env.APP_PATH}/graphql` : '/graphql',
      secure: !dev && process.env.APP_HTTPS,
    })
  }

  // resolve with data about the user
  return user.id
}

// log the user out (remove the cookie and redirect)
const logout = async (res) => {
  if (res && res.cookie) {
    res.cookie('jwt', null, {
      domain: process.env.APP_DOMAIN,
      httpOnly: true,
      maxAge: -1,
      path: process.env.APP_PATH ? `${process.env.APP_PATH}/graphql` : '/graphql',
      secure: !dev && process.env.APP_HTTPS,
    })
  }
  return 'LOGGED_OUT'
}

// change the password of an existing user
const changePassword = async (userId, newPassword) => {
  // look for a user with the given id
  // and check whether the user exists
  const user = await UserModel.findById(userId)
  if (!user) {
    throw new Error('PASSWORD_UPDATE_FAILED')
  }

  // generate a salt with bcyrpt using 10 rounds
  // hash and salt the password
  // set the new password and save the user
  user.password = bcrypt.hashSync(newPassword, 10)
  const updatedUser = await user.save()
  if (!updatedUser) {
    throw new Error('PASSWORD_UPDATE_FAILED')
  }

  // return the updated user
  return updatedUser
}

// request a password reset link
const requestPassword = async (res, email) => {
  // look for a user with the given email
  // and check whether the user exists
  const user = await UserModel.findOne({ email })
  if (!user) {
    return 'PASSWORD_RESET_FAILED'
  }

  // generate a temporary JWT for password reset
  const jwt = JWT.sign(
    {
      expiresIn: 86400,
      sub: user.id,
      scope: ['user'],
      shortname: user.shortname,
    },
    process.env.APP_SECRET,
  )

  // create reusable transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE || false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER, // generated ethereal user
      pass: process.env.EMAIL_PASS, // generated ethereal password
    },
  })

  // load the template source and compile it
  const source = fs.readFileSync(path.join(__dirname, 'emails', 'passwordReset.hbs'), 'utf8')
  const template = handlebars.compile(source)

  // send mail with defined transport object
  if (process.env.NODE_ENV !== 'test') {
    try {
      await transporter.sendMail({
        // bcc: 'roland.schlaefli@bf.uzh.ch',
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: 'Klicker UZH - Password Reset',
        html: template({
          email: user.email,
          jwt,
        }),
      })

      // notify slack that a password has been requested
      // TODO: remove this after the initial beta phase
      sendSlackNotification(`[auth] Password has been requested for: ${user.email}`)
    } catch (e) {
      return 'PASSWORD_RESET_FAILED'
    }
  }

  return 'PASSWORD_RESET_SENT'
}

module.exports = {
  isAuthenticated,
  requireAuth,
  isValidJWT,
  getToken,
  signup,
  login,
  logout,
  changePassword,
  requestPassword,
}
