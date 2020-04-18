module.exports = {
  test: (data) => data && !!data.changePassword,
  print: ({ changePassword: { email, shortname } }) => `
      changePassword {
        email: ${email}
        shortname: ${shortname}
      }
    `,
}
