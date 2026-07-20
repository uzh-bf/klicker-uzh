import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import fs from 'node:fs'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'
import serve from 'rollup-plugin-serve'
import { visualizer } from 'rollup-plugin-visualizer'

const isDev = process.env.NODE_ENV === 'development'
const shouldAnalyze = process.env.ANALYZE === 'true'
const urlDev = 'https://localhost:3020/'
const urlProd = 'https://www.klicker.uzh.ch/office-addin/'

async function getHttpsOptions() {
  try {
    const devCerts = await import('office-addin-dev-certs')
    const httpsOptions = await devCerts.default.getHttpsServerOptions()

    return {
      ca: httpsOptions.ca,
      key: httpsOptions.key,
      cert: httpsOptions.cert,
    }
  } catch (error) {
    console.warn('Could not load dev certificates:', error)
    return undefined
  }
}

function officeAddinPlugin() {
  return {
    name: 'office-addin',
    buildStart() {
      this.addWatchFile('manifest.xml')
      this.addWatchFile('src/content/content.html')
      this.addWatchFile('src/styles.css')

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
      typescript({
        tsconfig: './tsconfig.json',
        rootDir: 'src',
      }),
      copy({
        targets: [
          { src: 'assets/*', dest: 'dist/assets' },
          { src: 'src/styles.css', dest: 'dist' },
        ],
      }),
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
      shouldAnalyze &&
        visualizer({
          filename: 'dist/bundle-analysis.html',
          open: false,
          gzipSize: true,
        }),
    ].filter(Boolean),
    watch: { clearScreen: false },
  })
}

export default createConfig()
