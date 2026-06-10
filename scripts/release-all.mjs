// One-command release to every channel.
//
//   node scripts/release-all.mjs <new-version> [--no-electron] [--apk]
//   e.g.  node scripts/release-all.mjs 1.1.22
//
// What each channel gets:
//   Web (Vercel)        — push to main auto-deploys the new build
//   Android installed   — OTA bundle in public/ota/, picked up silently on next launch
//   Electron installed  — GitHub Release via electron-builder, auto-update (needs GH_TOKEN)
//   Android sideload    — pass --apk to also build + sign a fresh APK for new installs
//
// Must be run on a clean `main` checkout. The script bumps the version, builds once,
// publishes everything, then commits and pushes the version bump + OTA files.

import { execSync, execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, copyFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { homedir } from 'node:os'

const root = resolve(process.cwd())
const args = process.argv.slice(2)
const newVersion = args.find(a => !a.startsWith('--'))
const skipElectron = args.includes('--no-electron')
const buildApk = args.includes('--apk')

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', cwd: root, ...opts })
const out = (cmd) => execSync(cmd, { cwd: root }).toString().trim()
const fail = (msg) => { console.error(`\n✗ ${msg}`); process.exit(1) }

// ── Preflight ────────────────────────────────────────────────────────────────
if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  fail('Usage: node scripts/release-all.mjs <version>  e.g. 1.1.22')
}
if (out('git rev-parse --abbrev-ref HEAD') !== 'main') {
  fail('Releases must run on main (git checkout main).')
}
if (out('git status --porcelain') !== '') {
  fail('Working tree not clean — commit or stash your changes first.')
}
if (!skipElectron && !process.env.GH_TOKEN) {
  fail('GH_TOKEN not set (needed to publish the Electron release). Set it, or pass --no-electron to skip the desktop channel.')
}

// ── Version bump (single version drives every channel) ──────────────────────
run(`npm version ${newVersion} --no-git-tag-version`)

// ── Build once ───────────────────────────────────────────────────────────────
run('npm run build')

// ── Android OTA: bundle + stage in public/ota (served by Vercel at /ota/) ───
run('npm run ota:zip')
const otaSrc = resolve(root, 'release', 'ota')
const otaPub = resolve(root, 'public', 'ota')
mkdirSync(otaPub, { recursive: true })
for (const f of readdirSync(otaPub)) {
  if (f.endsWith('.zip')) rmSync(join(otaPub, f)) // keep only the current bundle
}
copyFileSync(join(otaSrc, `billbyte-${newVersion}.zip`), join(otaPub, `billbyte-${newVersion}.zip`))
copyFileSync(join(otaSrc, 'latest.json'), join(otaPub, 'latest.json'))

// ── Electron: build installer + publish to GitHub Releases (auto-update) ────
if (!skipElectron) {
  run('npx electron-builder --publish always')
}

// ── Optional: signed sideload APK for handing out to new users ───────────────
if (buildApk) {
  run('npx cap sync android')
  run('gradlew.bat assembleRelease', { cwd: resolve(root, 'android') })

  const sdkDir = readFileSync(resolve(root, 'android', 'local.properties'), 'utf8')
    .match(/^sdk\.dir=(.+)$/m)[1].trim()
  const buildTools = join(sdkDir, 'build-tools')
  const bt = join(buildTools, readdirSync(buildTools).sort().reverse()[0])
  const apkDir = resolve(root, 'android', 'app', 'build', 'outputs', 'apk', 'release')
  const signed = join(apkDir, `BillByte-POS-v${newVersion}.apk`)

  execFileSync(join(bt, 'zipalign.exe'), ['-f', '4', join(apkDir, 'app-release-unsigned.apk'), signed], { stdio: 'inherit' })
  execFileSync(join(bt, 'apksigner.bat'), [
    'sign',
    '--ks', join(homedir(), '.android', 'debug.keystore'),
    '--ks-pass', 'pass:android',
    '--ks-key-alias', 'androiddebugkey',
    signed,
  ], { stdio: 'inherit' })
  console.log(`\nSideload APK: ${signed}`)
}

// ── Commit + push: deploys web on Vercel and makes the OTA manifest live ─────
run('git add package.json package-lock.json public/ota')
run(`git commit -m "release: v${newVersion}"`)
run('git push origin main')

console.log(`
✓ v${newVersion} released:
  Web        — Vercel deploying from main (~1 min)
  Android    — OTA live at /ota/latest.json, installed apps update on next launch
  Electron   — ${skipElectron ? 'SKIPPED (--no-electron)' : 'GitHub Release published, desktop apps auto-update'}
  ${buildApk ? 'APK        — signed sideload build in android/app/build/outputs/apk/release/' : 'APK        — not built (pass --apk if you need one for new sideload installs)'}
`)
