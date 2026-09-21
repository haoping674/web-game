import { leaderboardRequest } from '../server/leaderboard.ts'

// Vercel Node.js Web Handler; credentials only exist in the server runtime.
export default { fetch: leaderboardRequest }
