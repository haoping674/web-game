import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createBalanceReport, reportRowsToCsv } from '../src/game/balanceReport'
import { generateBalancedBoard } from '../src/game/boardGenerator'
import { calculateAccessibility } from '../src/game/boardDifficulty'
import { PLAYER_MODELS, simulatePlayerRound, summarizePlayerRounds } from '../src/game/playerSimulator'
import { maximumComboContributionRatio, simulateComboRules } from '../src/game/scoreSimulator'
import { createSeededRandom } from '../src/game/random'
import type { BalanceMode } from '../src/game/balanceTypes'

const sampleSize = integerArgument('--sample', 1_000)
const playerRounds = integerArgument('--players', 300)
const seed = integerArgument('--seed', 20_260_716)
const mode = stringArgument('--mode', 'classic') as BalanceMode
const random = createSeededRandom(seed)
const generated = Array.from({ length: sampleSize }, () => generateBalancedBoard({ random, mode }))
const report = createBalanceReport(generated.map(({ board }) => board), seed)
const simulatedRounds = Object.fromEntries(PLAYER_MODELS.map((model) => [model, Array.from({ length: playerRounds }, () => simulatePlayerRound(model, random, mode))])) as Record<(typeof PLAYER_MODELS)[number], ReturnType<typeof simulatePlayerRound>[]>
const players = Object.fromEntries(PLAYER_MODELS.map((model) => [model, summarizePlayerRounds(simulatedRounds[model])]))
const expertMoves = simulatedRounds.expert.flatMap((round) => round.moveHistory)
const comboRules = {
  totals: simulateComboRules(expertMoves),
  configuredContributionRatio: maximumComboContributionRatio(expertMoves),
}
const generator = {
  meanAttempts: mean(generated.map(({ metadata }) => metadata.attempts)),
  fallbackRate: generated.filter(({ metadata }) => metadata.usedFallback).length / generated.length,
  meanQualityScore: mean(generated.map(({ metadata }) => metadata.quality.score)),
  qualityStandardDeviation: standardDeviation(generated.map(({ metadata }) => metadata.quality.score)),
  meanLuckIndex: mean(generated.map(({ metadata }) => metadata.quality.luckIndex)),
  meanAccessibility: mean(generated.map(({ metadata }) => calculateAccessibility(metadata.analysis))),
  accessibilityStandardDeviation: standardDeviation(generated.map(({ metadata }) => calculateAccessibility(metadata.analysis))),
  difficulty: countBy(generated.map(({ metadata }) => metadata.quality.difficulty)),
}
const output = { aggregate: report.aggregate, generator, players, comboRules, caveat: 'Player models are deterministic balance references, not substitutes for human playtests.' }
const outputDirectory = resolve('reports', 'balance')
await mkdir(outputDirectory, { recursive: true })
await Promise.all([
  writeFile(resolve(outputDirectory, `balanced-${mode}.json`), `${JSON.stringify({ ...output, boards: report.boards }, null, 2)}\n`, 'utf8'),
  writeFile(resolve(outputDirectory, `balanced-${mode}.csv`), `${reportRowsToCsv(report.boards)}\n`, 'utf8'),
])
console.log(JSON.stringify(output, null, 2))

function integerArgument(name: string, fallback: number): number {
  const index = process.argv.indexOf(name)
  const value = index < 0 ? undefined : Number(process.argv[index + 1])
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : fallback
}

function stringArgument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index < 0 ? fallback : process.argv[index + 1] ?? fallback
}

function countBy(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {})
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: readonly number[]): number {
  const average = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)))
}
