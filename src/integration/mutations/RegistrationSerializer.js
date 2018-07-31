module.exports = {
  test: ({ createUser }) => !!createUser,
  print: ({ createUser: { email, shortname, institution, useCase } }) => `
    createUser {
      email: ${email}
      shortname: ${shortname}
      institution: ${institution}
      useCase: ${useCase}
    }
  `,
}
