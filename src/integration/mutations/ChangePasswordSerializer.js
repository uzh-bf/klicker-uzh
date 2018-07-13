module.exports = {
  test: ({ changePassword }) => !!changePassword,
  print: ({ changePassword: { email, shortname } }) => `
      changePassword {
        email: ${email}
        shortname: ${shortname}
      }
    `,
}
