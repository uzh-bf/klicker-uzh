module.exports = {
  test: (data) => data && data.content && data.votes,
  print: (val) => `
    FEEDBACK

    content: ${val.content}
    votes: ${val.votes}
  `,
}
