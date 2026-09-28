// Helpers for tests: load the JSON data files.
import { readFileSync } from 'node:fs';

export function load(path) {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

export const skillsData = load('data/skills.json');
export const learningConfig = load('data/config/learning.json');
export const bank = load('data/questions/science.json').questions;
