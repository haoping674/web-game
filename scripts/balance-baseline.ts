import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createBalanceReport, reportRowsToCsv } from '../src/game/balanceReport'
import { generateLegacyBoard, legacyReshuffleRemaining } from '../src/game/legacyBoardGenerator'
import { PLAYER_MODELS, simulatePlayerRound, summarizePlayerRounds } from '../src/game/playerSimulator'
import { createSeededRandom } from '../src/game/random'

const SAMPLE_SIZE = 1_000
const SEED = 2_026_071_6
const random = createSeededRandom(SEED)
const boards = Array.from({ length: SAMPLE_SIZE }, () => generateLegacyBoard(random))
const report = createBalanceReport(boards, SEED)
const playerRandom = createSeededRandom(SEED)
const players = Object.fromEntries(PLAYER_MODELS.map((model) => {
  const rounds = Array.from({ length: 300 }, () => simulatePlayerRound(model, playerRandom, 'classic', {
    initialBoard: generateLegacyBoard(playerRandom),
    reshuffle: legacyReshuffleRemaining,
    legacyScoring: true,
  }))
  return [model, summarizePlayerRounds(rounds)]
}))
const output = { ...report, players, caveat: 'Player models are deterministic balance references, not substitutes for human playtests.' }
const outputDirectory = resolve('reports', 'balance')

await mkdir(outputDirectory, { recursive: true })
await Promise.all([
  writeFile(resolve(outputDirectory, 'baseline-legacy.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8'),
  writeFile(resolve(outputDirectory, 'baseline-legacy.csv'), `${reportRowsToCsv(report.boards)}\n`, 'utf8'),
])
console.log(JSON.stringify({ aggregate: report.aggregate, players }, null, 2))
