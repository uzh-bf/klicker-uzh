module.exports = {
  test: ({ endSession, startSession, pauseSession, cancelSession }) =>
    endSession || startSession || pauseSession || cancelSession,
  print: ({ endSession, startSession, pauseSession, cancelSession }) => {
    const status =
      (endSession && endSession.status) ||
      (startSession && startSession.status) ||
      (pauseSession && pauseSession.status) ||
      (cancelSession && cancelSession.status)

    return `
    startSession / pauseSession / endSession / cancelSession {
      status: ${status}
    }
    `
  },
}
