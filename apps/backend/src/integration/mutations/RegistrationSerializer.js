module.exports = {
  test: (data) => data && !!data.createUser,
  print: ({ createUser: { email, shortname, institution, useCase } }) => `
    createUser {
      email: ${email}
      shortname: ${shortname}
      institution: ${institution}
      useCase: ${useCase}
    }
  `,
}
