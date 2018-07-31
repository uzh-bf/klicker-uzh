module.exports = {
  test: ({ activateNextBlock }) => !!activateNextBlock,
  print: ({ activateNextBlock: { blocks } }) => `
    activateNextBlock {
      blocks: ${blocks.map(
        ({ status, instances }) => `
        status: ${status}
        instances: ${instances.map(instance => instance.isOpen)}
      `
      )}
    }
  `,
}
