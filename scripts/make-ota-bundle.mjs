// Packages the built web app (dist/) into an OTA bundle zip + manifest for the
// Android app's silent live-update flow (Capgo, self-hosted).
//
// Usage:
//   npm run build           # produce dist/
//   npm run ota:zip         # produce release/ota/billbyte-<version>.zip + latest.json
//
// Then upload BOTH files to wherever VITE_OTA_MANIFEST_URL points (e.g. the
// /ota/ path on app.billbyte.co.in, or a GitHub Release). On next launch every
// installed app downloads the new bundle and applies it on the following start.
//
// IMPORTANT: bump "version" in package.json before each OTA release, otherwise
// apps already on that version will skip the update.

import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const version = pkg.version

const distDir = resolve(root, 'dist')
if (!existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first.')
  process.exit(1)
}

const outDir = resolve(root, 'release', 'ota')
mkdirSync(outDir, { recursive: true })

const zipName = `billbyte-${version}.zip`
const zipPath = resolve(outDir, zipName)
if (existsSync(zipPath)) rmSync(zipPath)

// Zip the CONTENTS of dist/ so index.html sits at the zip root (what Capgo expects).
const psCmd = `Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force`
execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'inherit' })

const baseUrl = (process.env.OTA_BASE_URL || 'https://app.billbyte.co.in/ota').replace(/\/$/, '')
const manifest = { version, url: `${baseUrl}/${zipName}` }
writeFileSync(resolve(outDir, 'latest.json'), JSON.stringify(manifest, null, 2))

console.log('\nOTA bundle ready:')
console.log('  zip:      ', zipPath)
console.log('  manifest: ', resolve(outDir, 'latest.json'))
console.log('  manifest contents:', JSON.stringify(manifest))
console.log('\nUpload both files so', `${baseUrl}/latest.json`, 'and the zip are publicly reachable.')
