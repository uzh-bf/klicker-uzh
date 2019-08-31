module.exports = {
  test: data => data && !!data.activateNextBlock,
  print: ({ activateNextBlock: { blocks } }) => `
    activateNextBlock {
      blocks: ${blocks.map(
        ({ status, instances, timeLimit }) => `
        status: ${status}
        timeLimit: ${timeLimit}
        expiresAt: ${expect.any(String)}
        instances: ${instances.map(instance => instance.isOpen)}
      `
      )}
    }
  `,
}
