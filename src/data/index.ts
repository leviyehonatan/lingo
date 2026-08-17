import type { Level } from './types';
import { levelA1 } from './levelA1';
import { levelA2 } from './levelA2';
import { levelB1 } from './levelB1';

export const levels: Level[] = [levelA1, levelA2, levelB1];
export type { Level, Topic, Word, Progress } from './types';
