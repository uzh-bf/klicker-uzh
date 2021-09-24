module.exports = {
  test: (data) => data && !!data.updateSessionSettings,
  print: ({ updateSessionSettings: { settings } }) => `
    updateSessionSettings {
      settings: ${JSON.stringify(settings)}
    }
  `,
}
