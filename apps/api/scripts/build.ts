import { execSync } from 'child_process'

// Get version from git tag at build time
function getVersion(): string {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim()
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
