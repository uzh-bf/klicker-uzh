module.exports = {
  test: ({ updateSessionSettings }) => !!updateSessionSettings,
  print: ({ updateSessionSettings: { settings } }) => `
    updateSessionSettings {
      settings: ${JSON.stringify(settings)}
    }
  `,
}
