const { UserInputError } = require('apollo-server-express')

const { Errors } = require('../constants')
const validators = require('../lib/validators')
const { UserModel } = require('../models')

/**
 * Check the availability of fields with uniqueness constraints
 * @param {String} email
 * @param {String} shortname
 */
const checkAvailability = async ({ email, shortname }) => {
  const result = {}

  try {
    if (email) {
      validators.email.check(email)
      result.email = (await UserModel.countDocuments({ email })) === 0
    }

    if (shortname) {
      validators.shortname.check(shortname)
      result.shortname = (await UserModel.countDocuments({ shortname })) === 0
    }
  } catch (e) {
    throw new UserInputError(Errors.INVALID_INPUT)
  }

  return result
}

/**
 * Update personal account data
 * @param {ID} userId
 * @param {String} email
 * @param {String} shortname
 * @param {String} institution
 * @param {String} useCase
 */
const updateAccountData = async ({ userId, email, shortname, institution, useCase }) => {
  let user
  try {
    user = await UserModel.findById(userId)
  } catch (e) {
    throw new UserInputError(Errors.INVALID_USER)
  }

  if (!user) {
    throw new UserInputError(Errors.INVALID_USER)
  }

  if (email || shortname) {
    const availability = await checkAvailability({ email, shortname })

    if (email) {
      if (user.email !== email && availability.email === false) {
        throw new UserInputError(Errors.EMAIL_NOT_AVAILABLE)
      }

      user.email = email
    }

    if (shortname) {
      if (user.shortname !== shortname && availability.shortname === false) {
        throw new UserInputError(Errors.SHORTNAME_NOT_AVAILABLE)
      }

      user.shortname = shortname
    }
  }

  try {
    if (institution) {
      validators.institution.check(institution)
      user.institution = institution
    }

    if (useCase) {
      validators.useCase.check(useCase)
      user.useCase = useCase
    }
  } catch (e) {
    throw new UserInputError(Errors.INVALID_INPUT)
  }

  return user.save()
}

module.exports = {
  checkAvailability,
  updateAccountData,
}
