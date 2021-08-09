module.exports = {
  bumpFiles: ['', 'backend/', 'frontend/', 'landing/', 'docs/website/'].reduce(
    (acc, path) => {
      return acc.concat(
        {
          filename: `${path}package.json`,
          type: 'json',
        },
        {
          filename: `${path}package-lock.json`,
          type: 'json',
        }
      )
    },
    []
  ),
}
