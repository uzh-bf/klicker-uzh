module.exports = {
  test: ({ endSession, startSession, pauseSession }) => endSession || startSession || pauseSession,
  print: ({ endSession, startSession, pauseSession }) => {
    const status =
      (endSession && endSession.status) ||
      (startSession && startSession.status) ||
      (pauseSession && pauseSession.status)

    return `
    startSession / pauseSession / endSession {
      status: ${status}
    }
    `
  },
}
