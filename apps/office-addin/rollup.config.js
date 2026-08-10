import fs from 'node:fs'
import { createRequire } from 'node:module'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'
import serve from 'rollup-plugin-serve'

const withNonIncrementalTypescriptOptions = createRequire(import.meta.url)(
  '../../packages/util/rollup-typescript-options.cjs'
)

const isDev = process.env.NODE_ENV === 'development'
const urlDev = 'https://localhost:3020/'
const urlProd = 'https://www.klicker.uzh.ch/office-addin/'

async function getHttpsOptions() {
  const devCerts = await import('office-addin-dev-certs')
  const httpsOptions = await devCerts.default.getHttpsServerOptions()

  return {
    ca: httpsOptions.ca,
    key: httpsOptions.key,
    cert: httpsOptions.cert,
  }
}

function officeAddinPlugin() {
  return {
    name: 'office-addin',
    buildStart() {
      this.addWatchFile('manifest.xml')
      this.addWatchFile('src/content/content.html')
      this.addWatchFile('src/styles.css')
      this.addWatchFile('assets')

      for (const asset of fs.readdirSync('assets')) {
        this.addWatchFile(`assets/${asset}`)
      }
    },
    generateBundle: {
      order: 'post',
      handler() {
        this.emitFile({
          type: 'asset',
          fileName: 'content.html',
          source: fs.readFileSync('src/content/content.html', 'utf-8'),
        })

        const manifest = fs.readFileSync('manifest.xml', 'utf-8')
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.xml',
          source: isDev ? manifest : manifest.replaceAll(urlDev, urlProd),
        })

        this.emitFile({
          type: 'asset',
          fileName: 'styles.css',
          source: fs.readFileSync('src/styles.css'),
        })

        for (const asset of fs.readdirSync('assets')) {
          this.emitFile({
            type: 'asset',
            fileName: `assets/${asset}`,
            source: fs.readFileSync(`assets/${asset}`),
          })
        }
      },
    },
  }
}

async function createConfig() {
  fs.rmSync('dist', { recursive: true, force: true })

  const httpsOptions = isDev ? await getHttpsOptions() : undefined

  return defineConfig({
    input: 'src/content/content.ts',
    output: {
      file: 'dist/content.js',
      format: 'iife',
      sourcemap: true,
    },
    plugins: [
      typescript(
        withNonIncrementalTypescriptOptions({
          tsconfig: './tsconfig.json',
          rootDir: 'src',
        })
      ),
      officeAddinPlugin(),
      !isDev && terser(),
      isDev &&
        serve({
          contentBase: 'dist',
          host: 'localhost',
          port: 3020,
          https: httpsOptions,
          headers: { 'Access-Control-Allow-Origin': '*' },
        }),
    ].filter(Boolean),
    watch: { clearScreen: false },
  })
}

export default createConfig()
