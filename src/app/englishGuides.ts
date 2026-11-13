import type { GameGuide } from './gameGuides.ts'
import type { ENGLISH_GAME_IDS } from './locale.ts'

export const ENGLISH_GUIDES: Record<(typeof ENGLISH_GAME_IDS)[number], GameGuide> = {
  lengthSense: {
    goal: 'Estimate a target length by adjusting a line, then confirm to see how close you were.',
    controls: 'Choose 1, 3 or 5 cm, or a random target. Drag the handle below the line, or focus the slider and use the arrow keys to fine-tune it. Confirm when ready. Escape cancels the attempt.',
    rules: 'You can adjust repeatedly before confirming. The result compares your line with the target. Lengths use CSS centimeters, which can differ from physical centimeters on your screen. This game is not a physical ruler.',
    scoring: 'Accuracy depends on relative percentage error. An exact match scores 1000 points. Smaller errors score higher. Your best error and completed attempts are saved on this device.',
    tip: 'Judge the overall proportion first, then fine-tune the endpoint. Use each result to see whether you tend to estimate too long or too short.',
  },
  colorLinks: {
    goal: 'Clear the colored tiles by connecting matching signals through empty cells within 30 seconds.',
    controls: 'Click or tap an empty cell. It looks up, right, down and left for the nearest tile in each direction. You can also Tab to a cell and press Enter or Space. Escape pauses.',
    rules: 'A link clears tiles when the nearest tiles in at least two directions share a color. Closer tiles block farther ones. Invalid clicks cost two seconds. The board reshuffles when no moves remain, and stranded tiles are resolved automatically.',
    scoring: 'Clear the board within the time limit to record a completion time. Faster is better. If time runs out, the number of tiles cleared is recorded instead. Each result has its own leaderboard.',
    tip: 'Look for empty intersections with matching colors in multiple directions. New empty cells can create the next link. Each color also has a unique symbol.',
  },
  slideTen: {
    goal: 'Slide fruit into lines totaling 10 and keep enough space for incoming waves.',
    controls: 'Swipe a fruit, or select one and choose a direction using the buttons or arrow keys. Fruit moves in a straight line. Escape pauses the game.',
    rules: 'Add fruit in order along the movement direction. Gaps can be skipped, but numbered fruit cannot. Exactly 10 clears the whole group. If the total exceeds 10 or remains too small at the edge, the fruit stops before the first fruit it meets. The game ends when empty cells are less than or equal to the next wave size.',
    scoring: 'Each cleared fruit earns one point. Moving alone earns no points. Waves arrive every 4 seconds, starting at 4 fruit. Wave size grows by one every 45 seconds, up to 8. Your local best is saved on this device.',
    tip: 'Use the one-second preview of incoming fruit to plan. A line such as 5, 2, empty, 3 can clear together. Avoid blocking a whole lane with high numbers.',
  },
  secondSense: {
    goal: 'Test your sense of time. Stop a hidden timer as close as possible to the target.',
    controls: 'Choose 1, 3 or 5 seconds, or a random target. Click Start or press Space, then click or press Space again to stop. Escape cancels the round.',
    rules: 'The timer stays hidden until you stop. Results show the elapsed time and how early or late you were. Leaving the page or opening settings cancels the attempt.',
    scoring: 'Accuracy starts at 1000 points and loses one point per millisecond of absolute error, down to zero. Fixed and random targets have separate personal records.',
    tip: 'Start with a fixed target to find your rhythm. If you consistently stop early or late, adjust your timing on the next attempt.',
  },
  fruitSum: {
    goal: 'Find rectangles of numbered fruit that add up to exactly 10 before the countdown ends.',
    controls: 'Click and drag, or touch and drag, to select a rectangle. Release to confirm. Every fruit inside counts. With a keyboard, move with the arrow keys and press Enter to set each corner.',
    rules: 'Only a total of exactly 10 clears fruit. Invalid selections break your Combo. A hint appears after a period without a successful clear, and the board shuffles automatically if no moves remain.',
    scoring: 'Each cleared fruit earns one point. Combo tracks consecutive successful moves and does not multiply your score. Your records are saved on this device.',
    tip: 'Try adjacent pairs such as 4 and 6 or 3 and 7, then look for larger rectangles that also total 10. Inspired by Fruit Box and rebuilt with original code, visuals and interactions.',
  },
}

