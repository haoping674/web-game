import { readFile } from 'node:fs/promises'
import { loadEnv } from 'vite'
import { neon } from '@neondatabase/serverless'

const connection = process.env.DATABASE_URL || loadEnv('development', process.cwd(), '').DATABASE_URL
if (!connection) {
  console.error('請在 .env.local 或伺服器環境設定 DATABASE_URL，再執行 npm run db:migrate。')
  process.exitCode = 1
} else {
  try {
    const sql = neon(connection)
    const migration = await readFile(new URL('../database/001_leaderboards.sql', import.meta.url), 'utf8')
    await sql.transaction(migration.split('-- statement-breakpoint').map(statement => sql.query(statement)))
    console.log('Neon 排行榜資料表與登錄函式已就緒。')
  } catch {
    console.error('資料庫初始化失敗，請檢查 Neon 連線、網路與資料庫權限。未顯示連線密碼。')
    process.exitCode = 1
  }
}
