// The browser's handle on the engine: same code as the server, bound to the world as last published
import { compose as composeSpec } from '../../engine/compose.ts'
import { perPerson as pricePerPerson, reduce as reduceWith, type Journey } from '../../engine/journey.ts'
import type { Intent } from '../../engine/intent.ts'
import { currentWorld } from '../data/tonight'

export { START, unitPrice, type Journey, type SceneId } from '../../engine/journey.ts'
export { parseIntent, type Intent, type TileId } from '../../engine/intent.ts'
export type { ExperienceSpec } from '../../engine/compose.ts'

export const reduce = (j: Journey, intent: Intent) => reduceWith(j, intent, currentWorld())
export const compose = (j: Journey) => composeSpec(j, currentWorld())
export const perPerson = (j: Journey) => pricePerPerson(j, currentWorld())
