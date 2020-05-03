module.exports = {
  test: (data) => data && (!!data.activateNextBlock || !!data.activateBlockById),
  print: ({ activateNextBlock, activateBlockById }) => `
    activateNextBlock {
      blocks: ${(activateNextBlock || activateBlockById).blocks.map(
        ({ status, instances, timeLimit }) => `
        status: ${status}
        timeLimit: ${timeLimit}
        expiresAt: ${expect.any(String)}
        instances: ${instances.map((instance) => instance.isOpen)}
      `
      )}
    }
  `,
}
