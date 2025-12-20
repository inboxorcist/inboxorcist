import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Get version from package.json
function getVersion(): string {
  try {
    const pkgPath = resolve(__dirname, '../package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version ? `v${pkg.version}` : 'dev'
  } catch {
    return 'dev'
  }
}

const version = getVersion()
console.log(`Building with version: ${version}`)

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
})

console.log('Build complete!')
