module.exports = {
  test: (data) => data && data.id && data.content && data.votes,
  print: (val) => `
    FEEDBACK

    content: ${val.content}
    votes: ${val.votes}
  `,
}
