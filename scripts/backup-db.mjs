#!/usr/bin/env node
// Backup av Dugnadshub-databasen til lokale JSON-filer (gratisplanen i Supabase har ingen backup).
//
//   node scripts/backup-db.mjs                 → ~/Backups/dugnadshub/<tidsstempel>/
//   BACKUP_DIR=/annen/mappe node scripts/backup-db.mjs
//
// - KUN LESING mot databasen. Leser SUPABASE_SERVICE_ROLE_KEY fra .env.local (skrives aldri ut).
// - Finner alle tabeller i public-skjemaet selv (via PostgREST sin OpenAPI-beskrivelse),
//   så nye tabeller kommer med uten at skriptet må endres.
// - Tar også med innloggingskontoene (id + e-post) — uten dem kan ikke profiler kobles
//   til riktig bruker ved gjenoppretting.
// - Beholder de 30 nyeste kopiene. Mappa inneholder persondata (navn, e-post, telefon):
//   ikke legg den i en delt mappe.
//
// Gjenoppretting: hver fil er en ren JSON-liste med rader og kan settes inn igjen med
// upsert per tabell (foreldretabeller først: profiles, events, zones, badges …).
// Skjemaet ligger i scripts/*.sql. Dette er ikke en full pg_dump.

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY i .env.local'); process.exit(1) }

const KEEP = 30
const PAGE = 1000
const baseDir = process.env.BACKUP_DIR || path.join(os.homedir(), 'Backups', 'dugnadshub')
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = path.join(baseDir, stamp)
const sb = createClient(URL_, KEY, { auth: { persistSession: false } })

// 1) Finn tabellene
const spec = await fetch(`${URL_}/rest/v1/`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }).then(r => r.json())
const tables = Object.keys(spec.paths ?? {})
  .map(p => p.slice(1))
  .filter(p => p && !p.startsWith('rpc/'))
  // Engangskoder for innlogging er verdiløse ved gjenoppretting og bør ikke ligge i en kopi
  .filter(p => p !== 'otp_codes')
  .sort()
if (tables.length === 0) { console.error('Fant ingen tabeller — avbryter uten å skrive noe'); process.exit(1) }

fs.mkdirSync(outDir, { recursive: true, mode: 0o700 })
const manifest = { created_at: new Date().toISOString(), project: URL_, tables: {}, errors: [] }

// 2) Eksporter hver tabell, 1000 rader om gangen
for (const t of tables) {
  const rows = []
  let failed = null
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(t).select('*').range(from, from + PAGE - 1)
    if (error) { failed = error.message; break }
    rows.push(...data)
    if (data.length < PAGE) break
  }
  if (failed) { manifest.errors.push(`${t}: ${failed}`); continue }
  fs.writeFileSync(path.join(outDir, `${t}.json`), JSON.stringify(rows, null, 1), { mode: 0o600 })
  manifest.tables[t] = rows.length
}

// 3) Innloggingskontoer (kun det som trengs for å koble profiler til brukere)
try {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: PAGE })
    if (error) throw error
    users.push(...data.users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at })))
    if (data.users.length < PAGE) break
  }
  fs.writeFileSync(path.join(outDir, '_auth_users.json'), JSON.stringify(users, null, 1), { mode: 0o600 })
  manifest.tables._auth_users = users.length
} catch (e) {
  manifest.errors.push(`_auth_users: ${e.message}`)
}

fs.writeFileSync(path.join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 })

// 4) Rydd: behold de KEEP nyeste
const old = fs.readdirSync(baseDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(d.name))
  .map(d => d.name).sort().reverse().slice(KEEP)
for (const d of old) fs.rmSync(path.join(baseDir, d), { recursive: true, force: true })

const total = Object.values(manifest.tables).reduce((a, b) => a + b, 0)
console.log(`${new Date().toISOString()} backup OK: ${Object.keys(manifest.tables).length} tabeller, ${total} rader → ${outDir}` +
  (manifest.errors.length ? ` | FEIL: ${manifest.errors.join('; ')}` : '') + (old.length ? ` | slettet ${old.length} gamle` : ''))
if (manifest.errors.length) process.exit(2)
