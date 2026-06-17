#!/usr/bin/env node
/**
 * Aplica supabase/migrations/018_chat_memory.sql al proyecto remoto.
 * Requiere POSTGRES_URL o POSTGRES_URL_NON_POOLING en .env.local o .env.vercel.production.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

dotenv.config({ path: path.join(root, '.env.vercel.production') })
dotenv.config({ path: path.join(root, '.env.local') })

const url =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL

if (!url || url.length < 20) {
  console.error(
    'Falta POSTGRES_URL. Opciones:\n' +
      '  1) Supabase Dashboard → SQL → pegar supabase/migrations/018_chat_memory.sql\n' +
      '  2) npx supabase login && npx supabase link --project-ref TU-PROJECT-REF && npx supabase db push\n' +
      '  3) Añadir POSTGRES_URL_NON_POOLING a .env.local y ejecutar: npm run db:apply-018',
  )
  process.exit(1)
}

const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/018_chat_memory.sql'),
  'utf8',
)

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
})

try {
  await client.connect()
  await client.query(sql)
  console.log('Migración 018 aplicada correctamente.')
} catch (e) {
  console.error('Error aplicando migración:', e.message)
  process.exit(1)
} finally {
  await client.end()
}
