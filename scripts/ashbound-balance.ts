import { mkdir, writeFile } from 'node:fs/promises'
import { simulate, type Strategy } from './lib/ashbound-simulation'
import type { Job } from '../src/games/ashbound/model'

const label = process.argv[2] ?? 'candidate'
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a lowercase report label')
const seeds = Number(process.argv[3] ?? 100)
if (!Number.isInteger(seeds) || seeds < 1 || seeds > 1000) throw new Error('Use 1–1000 seeds')
const rows = []
for (const strategy of ['tactical', 'aggressive'] as Strategy[]) {
  for (const legacy of [0, 5]) {
    for (const job of ['warden', 'witch', 'reaper'] as Job[]) {
      const runs = Array.from({ length: seeds }, (_, index) => simulate(job, index + 1, legacy, strategy))
      const floors = runs.map(run => run.floor).sort((a, b) => a - b)
      rows.push({ strategy, legacy, job, seeds,
        medianFloor: floors[Math.floor(seeds / 2)], maxFloor: floors.at(-1),
        cleared10: runs.filter(run => run.floor > 10).length,
        cleared20: runs.filter(run => run.floor > 20).length,
        cleared30: runs.filter(run => run.floor > 30).length,
        cleared50: runs.filter(run => run.floor > 50).length,
        cleared100: runs.filter(run => run.floor > 100).length,
        dead: runs.filter(run => run.dead).length, stalled: runs.filter(run => run.stalled).length,
      })
    }
  }
}
await mkdir('reports/ashbound', { recursive: true })
await writeFile(`reports/ashbound/${label}.json`, JSON.stringify({ label, seeds, maxFloor: 100, rows }, null, 2) + '\n')
console.table(rows)
