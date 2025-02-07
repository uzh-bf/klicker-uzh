import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import fs from 'fs/promises'
import devCerts from 'office-addin-dev-certs'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'
import livereload from 'rollup-plugin-livereload'
import postcss from 'rollup-plugin-postcss'
import serve from 'rollup-plugin-serve-proxy'

// Custom plugin to handle manifest.xml like vite-plugin-office-addin
function officeAddinPlugin({
  devUrl = 'https://localhost:3020',
  prodUrl = 'https://www.klicker.uzh.ch/office-addin',
  manifestPaths = ['src/manifest-content.xml', 'src/manifest-taskpane.xml'],
} = {}) {
  return {
    name: 'office-addin',
    async generateBundle() {
      // Process each manifest file
      for (const manifestPath of manifestPaths) {
        // Read and process manifest.xml
        const manifestContent = await fs.readFile(manifestPath, 'utf-8')
        const processedManifest = manifestContent.replaceAll(
          devUrl,
          process.env.BUILD === 'production' ? prodUrl : devUrl
        )

        // Get the output filename based on the input path
        const fileName = manifestPath.split('/').pop()

        this.emitFile({
          type: 'asset',
          fileName,
          source: processedManifest,
        })
      }

      // Copy and process HTML files
      const taskpaneHtml = await fs.readFile(
        'src/taskpane/taskpane.html',
        'utf-8'
      )
      const contentHtml = await fs.readFile('src/content/content.html', 'utf-8')

      this.emitFile({
        type: 'asset',
        fileName: 'taskpane.html',
        source: taskpaneHtml,
      })

      this.emitFile({
        type: 'asset',
        fileName: 'content.html',
        source: contentHtml,
      })
    },
  }
}

async function getHttpsOptions() {
  const httpsOptions = await devCerts.getHttpsServerOptions()
  return {
    ca: httpsOptions.ca,
    key: httpsOptions.key,
    cert: httpsOptions.cert,
  }
}

export default defineConfig(async ({}) => {
  const isProd = process.env.BUILD === 'production'
  console.log('Build mode:', process.env.BUILD || 'development')

  // Only get HTTPS options in dev mode
  const httpsOptions = !isProd ? await getHttpsOptions() : {}

  return {
    input: {
      taskpane: 'src/taskpane/index.tsx',
      content: 'src/content/index.tsx',
    },
    output: {
      dir: 'dist',
      format: 'es',
      sourcemap: !isProd,
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/[name]-[hash].js',
      assetFileNames: 'assets/[name][extname]',
    },
    watch: {
      include: ['src/**'],
      exclude: ['node_modules/**'],
      clearScreen: false,
    },
    plugins: [
      // Clean dist directory before build
      // del({ targets: 'dist/*', verbose: true }),
      resolve({
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.html'],
        browser: true,
        mainFields: ['module', 'browser', 'main'],
      }),
      commonjs({
        include: /node_modules/,
        requireReturnsDefault: 'auto',
      }),
      postcss({
        extract: 'styles.css',
        modules: false,
        inject: false,
        minimize: isProd,
        config: './postcss.config.cjs',
      }),
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: !isProd,
        inlineSources: !isProd,
        noEmit: false,
        compilerOptions: {
          emitDeclarationOnly: false,
          declaration: true,
          declarationDir: './dist/types',
        },
      }),
      replace({
        preventAssignment: true,
        values: {
          'process.env.NODE_ENV': JSON.stringify(
            process.env.BUILD || 'development'
          ),
          'process.env': '({})',
          global: 'window',
          'globalThis.process.env.NODE_ENV': JSON.stringify(
            process.env.BUILD || 'development'
          ),
        },
      }),
      officeAddinPlugin({
        devUrl: 'https://localhost:3020',
        prodUrl: 'https://www.klicker.uzh.ch/office-addin',
        manifestPaths: [
          'src/manifest-content.xml',
          'src/manifest-taskpane.xml',
        ],
      }),
      copy({
        targets: [
          {
            src: 'assets/*',
            dest: 'dist/assets',
          },
        ],
      }),
      !isProd &&
        serve({
          contentBase: ['dist'],
          host: 'localhost',
          port: 3020,
          https: httpsOptions,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          historyApiFallback: true,
          open: false,
          verbose: true,
          // watch: {
          //   dir: ['src'],
          //   include: ['**/*.html', '**/*.tsx', '**/*.ts', '**/*.css'],
          //   skipWrite: true,
          // },
        }),
      !isProd &&
        livereload({
          watch: ['dist'],
          verbose: true,
          delay: 200,
          exts: ['html', 'js', 'css'],
          port: 35729,
          https: httpsOptions,
        }),
      isProd && terser(),
    ].filter(Boolean),
  }
})
