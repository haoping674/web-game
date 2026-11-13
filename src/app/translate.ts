import { englishMessages } from './englishMessages'
import { readAppPathname } from './router'
import { localeFromPath } from './locale'

export function isEnglish(): boolean {
  return typeof window !== 'undefined' && localeFromPath(readAppPathname()) === 'en'
}

const messagePattern = new RegExp(Object.keys(englishMessages)
  .sort((left, right) => right.length - left.length)
  .map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')

// Shared UI follows the URL so bookmarked pages and browser history agree.
export function translate(value: string): string
export function translate<T>(value: T): T
export function translate(value: unknown): unknown {
  if (typeof value !== 'string' || !isEnglish()) return value
  return englishMessages[value] ?? value.replace(messagePattern, match => englishMessages[match]!)
}
