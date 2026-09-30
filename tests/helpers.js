// Helpers for tests: load the JSON data files.
import { readFileSync, existsSync } from 'node:fs';
import { loadData } from '../src/ui/data.js';

export function load(path) {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

export const skillsData = load('data/skills.json');
export const learningConfig = load('data/config/learning.json');
export const bank = load('data/questions/science.json').questions;

// All the data of the game, as the browser loads it.
let gameData = null;
export function loadGameData() {
  gameData ??= loadData(() => {}, async (path) => {
    const url = new URL(`../${path}`, import.meta.url);
    return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : null;
  });
  return gameData;
}
