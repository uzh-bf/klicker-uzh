module.exports = {
  test: (data) => data && (!!data.endSession || !!data.startSession || !!data.pauseSession || !!data.cancelSession),
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
