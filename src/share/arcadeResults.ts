import { getGameDefinition } from '../app/gameRegistry'
import { ENGLISH_GAMES, localizedPath, localeFromPath } from '../app/locale'
import { readAppPathname } from '../app/router'
import { SITE_ORIGIN } from '../app/seo'
import { translate } from '../app/translate'
import type { TimingResult } from '../games/second-sense/model'
import type { LengthResult } from '../games/length-sense/model'
import type { ColorLinksState } from '../games/color-links/types'
import type { SlideState } from '../games/slide-ten/model'
import type { GameState } from '../game/types'
import type { ArcadeGameId, ArcadeShareResult } from './types'

function resultBase(gameId: ArcadeGameId, newBest: boolean) {
  const locale = localeFromPath(readAppPathname())
  const game = getGameDefinition(gameId)
  return {
    kind: 'arcade' as const, gameId, locale, newBest,
    gameName: locale === 'en' ? ENGLISH_GAMES[gameId].name : game.name,
    playedAt: new Date(),
    pageUrl: SITE_ORIGIN + localizedPath(game.route, locale),
  }
}

function text(zh: string, en: string): string {
  return localeFromPath(readAppPathname()) === 'en' ? en : zh
}

export function timingShareResult(result: TimingResult, random: boolean, newBest: boolean): ArcadeShareResult {
  return {
    ...resultBase('secondSense', newBest),
    headline: translate(result.label), metricLabel: text('距離完美，只差', 'Away from perfect'),
    value: (result.error / 1000).toFixed(3), unit: text('秒', 's'), score: result.score,
    stats: [
      { label: text('目標秒數', 'Target'), value: `${result.target.toFixed(1)} s` },
      { label: text('實際秒數', 'Your time'), value: `${(result.elapsed / 1000).toFixed(3)} s` },
      { label: text('精準分', 'Accuracy'), value: `${result.score} / 1000` },
      { label: text('挑戰模式', 'Challenge'), value: random ? text('隨機目標', 'Random target') : text('固定目標', 'Fixed target') },
    ],
    comparison: { target: result.target, actual: result.elapsed / 1000 },
  }
}

export function lengthShareResult(result: LengthResult, newBest: boolean): ArcadeShareResult {
  return {
    ...resultBase('lengthSense', newBest),
    headline: translate(result.label), metricLabel: text('眼力誤差', 'Estimation error'),
    value: (result.errorBp / 100).toFixed(2), unit: '%', score: result.score,
    stats: [
      { label: text('目標長度', 'Target length'), value: `${result.target.toFixed(2)} cm` },
      { label: text('你的長度', 'Your estimate'), value: `${result.guess.toFixed(2)} cm` },
      { label: text('相差長度', 'Difference'), value: `${Math.abs(result.delta).toFixed(2)} cm` },
      { label: text('精準分', 'Accuracy'), value: `${result.score} / 1000` },
    ],
    comparison: { target: result.target, actual: result.guess },
  }
}

export function fruitShareResult(game: GameState, newBest: boolean): ArcadeShareResult {
  return {
    ...resultBase('fruitSum', newBest),
    headline: text('這一籃，是你的實力。', 'A harvest worth sharing.'),
    metricLabel: text('本局收穫', 'Your harvest'), value: String(game.score), unit: text('分', 'pts'), score: game.score,
    stats: [
      { label: text('消除水果', 'Fruit cleared'), value: String(game.clearedFruitCount) },
      { label: text('最高 Combo', 'Best Combo'), value: String(game.bestCombo) },
      { label: text('成功操作', 'Successful moves'), value: String(game.successfulMoves) },
      { label: text('無效操作', 'Invalid moves'), value: String(game.invalidMoves) },
    ],
  }
}

export function colorShareResult(game: ColorLinksState, newBest: boolean): ArcadeShareResult {
  const cleared = game.outcome === 'cleared'
  return {
    ...resultBase('colorLinks', newBest),
    headline: cleared ? text('所有訊號，都連上了。', 'Every signal connected.') : text('每一次連結，都有收穫。', 'Every connection counts.'),
    metricLabel: cleared ? text('全盤清空用時', 'Board cleared in') : text('本局消除', 'Tiles cleared'),
    value: String(cleared ? game.elapsedSeconds : game.removedTiles),
    unit: cleared ? text('秒', 's') : text('格', 'tiles'), score: game.removedTiles,
    stats: [
      { label: text('消除色塊', 'Tiles removed'), value: String(game.removedTiles) },
      { label: text('有效連結', 'Successful links'), value: String(game.successfulMoves) },
      { label: text('無效點擊', 'Invalid clicks'), value: String(game.invalidMoves) },
      { label: text('本局結果', 'Round result'), value: cleared ? text('全部清空', 'All clear') : text('時間到', 'Time limit') },
    ],
  }
}

export function slideShareResult(game: SlideState, newBest: boolean): ArcadeShareResult {
  const seconds = Math.floor(game.elapsedMs / 1000)
  return {
    ...resultBase('slideTen', newBest),
    headline: text('替果園，多留一點空間。', 'Made room for a little more.'),
    metricLabel: text('本局收穫', 'Your harvest'), value: String(game.score), unit: text('分', 'pts'), score: game.score,
    stats: [
      { label: text('消除水果', 'Fruit cleared'), value: String(game.removedFruits) },
      { label: text('消除次數', 'Matches'), value: String(game.pairs) },
      { label: text('守住果園', 'Time survived'), value: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` },
      { label: text('每批水果', 'Wave size'), value: String(game.waveCount) },
    ],
  }
}
