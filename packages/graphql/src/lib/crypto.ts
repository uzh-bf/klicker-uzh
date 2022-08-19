import bcrypt from 'bcrypt'
import generatePassword from 'generate-password'

export function generatePasswordHash(password: string) {
  // generate a random salt for password security
  const salt = generatePassword.generate({
    length: 16,
    uppercase: true,
    symbols: true,
    numbers: true,
  })

  // hash the password alongside the salt
  const hash = bcrypt.hashSync(`${salt}${password}`, 10)

  return {
    hash,
    salt,
  }
}
