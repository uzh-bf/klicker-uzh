import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import fs from 'fs'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'
import livereload from 'rollup-plugin-livereload'
import serve from 'rollup-plugin-serve'
import { visualizer } from 'rollup-plugin-visualizer'

// Environment variables and constants
const isDev = process.env.NODE_ENV === 'development'
const urlDev = 'https://localhost:3020/'
const urlProd = 'https://www.klicker.uzh.ch/'

// Helper function to get HTTPS options for development
async function getHttpsOptions() {
  try {
    // Use office-addin-dev-certs to get HTTPS certificates
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

// Custom Office Add-in plugin for HTML and manifest processing
function officeAddinPlugin() {
  return {
    name: 'office-addin',
    generateBundle: {
      order: 'post',
      handler() {
        // Process content.html template
        const htmlTemplate = fs.readFileSync(
          'src/content/content.html',
          'utf-8'
        )

        // Replace script references with Rollup output
        let processedHtml = htmlTemplate
          // Remove the existing content.js script tag
          .replace(/<script[^>]*src="content\.js"[^>]*><\/script>/g, '')
          // Add polyfills script first, then content script
          .replace(
            '</head>',
            `    <!-- Polyfills bundle -->\n    <script type="text/javascript" src="polyfills.js"></script>\n    <!-- Main content bundle -->\n    <script type="text/javascript" src="content.js"></script>\n  </head>`
          )

        // Add processed HTML to bundle
        this.emitFile({
          type: 'asset',
          fileName: 'content.html',
          source: processedHtml,
        })

        // Process manifest.xml with URL replacement
        const manifestTemplate = fs.readFileSync('manifest.xml', 'utf-8')
        const processedManifest = isDev
          ? manifestTemplate
          : manifestTemplate.replace(new RegExp(urlDev, 'g'), urlProd)

        this.emitFile({
          type: 'asset',
          fileName: 'manifest.xml',
          source: processedManifest,
        })
      },
    },
  }
}

// Create configuration function to handle async operations
async function createConfig() {
  const httpsOptions = isDev ? await getHttpsOptions() : undefined

  return defineConfig([
    // Polyfills bundle
    {
      input: 'src/polyfills.ts',
      output: {
        file: 'dist/polyfills.js',
        format: 'iife',
        sourcemap: true,
      },
      plugins: [
        replace({
          'process.env.NODE_ENV': JSON.stringify(
            process.env.NODE_ENV || 'production'
          ),
          preventAssignment: true,
        }),
        nodeResolve({
          browser: true,
          preferBuiltins: false,
        }),
        commonjs(),
        typescript({
          tsconfig: './tsconfig.json',
          rootDir: 'src',
        }),
        !isDev && terser(),
      ].filter(Boolean),
    },
    // Main content bundle
    {
      input: 'src/content/content.ts',
      output: {
        file: 'dist/content.js',
        format: 'iife',
        sourcemap: true,
      },
      plugins: [
        // Replace environment variables
        replace({
          'process.env.NODE_ENV': JSON.stringify(
            process.env.NODE_ENV || 'production'
          ),
          preventAssignment: true,
        }),

        // Resolve Node modules
        nodeResolve({
          browser: true,
          preferBuiltins: false,
        }),

        // Handle CommonJS modules
        commonjs(),

        // TypeScript compilation
        typescript({
          tsconfig: './tsconfig.json',
          rootDir: 'src',
        }),

        // Copy assets (only in main bundle to avoid duplication)
        copy({
          targets: [{ src: 'assets/*', dest: 'dist/assets' }],
        }),

        // Custom Office add-in processing (only in main bundle)
        officeAddinPlugin(),

        // Minification for production
        !isDev &&
          terser({
            compress: {
              drop_console: false, // Keep console logs for debugging Office add-ins
            },
          }),

        // Development server (only in main bundle)
        isDev &&
          serve({
            contentBase: 'dist',
            host: 'localhost',
            port: 3020,
            https: httpsOptions,
            headers: {
              'Access-Control-Allow-Origin': '*',
            },
          }),

        // Live reload for development (only in main bundle)
        isDev && livereload('dist'),

        // Bundle analysis for production (only in main bundle)
        !isDev &&
          visualizer({
            filename: 'dist/bundle-analysis.html',
            open: false,
            gzipSize: true,
          }),
      ].filter(Boolean), // Remove falsy plugins

      // External dependencies (keep Office.js external)
      external: [],

      // Watch options for development
      watch: {
        clearScreen: false,
      },
    },
  ])
}

export default createConfig()
