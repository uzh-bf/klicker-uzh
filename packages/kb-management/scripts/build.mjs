import { rollup } from 'rollup'
import config from '../rollup.config.js'

const configs = Array.isArray(config) ? config : [config]

for (const configItem of configs) {
  const { output, ...inputOptions } = configItem
  const bundle = await rollup(inputOptions)
  const outputs = Array.isArray(output) ? output : [output]

  for (const outputOptions of outputs) {
    await bundle.write(outputOptions)
  }

  await bundle.close()
}

process.exit(0)
