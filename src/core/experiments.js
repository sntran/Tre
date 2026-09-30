// The experiments: the one place where the code reads the switches (docs/DESIGN.md, "Learning
// measurement"; data/config/experiments.json). The code asks for the value of a switch, never for
// a variant. At most one experiment is active in a release. A profile gets its variant of that
// experiment from its seed, so that a child stays in one variant; the parent can change it.
import { hashSeed } from './rng.js';

// config: data/config/experiments.json. seed: the seed of the profile. choice: the choice of the
// parent ({ experiment, variant }) or null.
export function createExperiments(config, { seed = 1, choice = null } = {}) {
  const all = config.experiments ?? {};
  const active = config.active && all[config.active] ? config.active : null;
  const switches = {};
  for (const exp of Object.values(all)) Object.assign(switches, exp.variants[exp.default] ?? {});
  let variant = null;
  if (active) {
    const names = Object.keys(all[active].variants);
    variant = choice?.experiment === active && names.includes(choice.variant) ? choice.variant : variantOf(seed, active, names);
    Object.assign(switches, all[active].variants[variant]);
  }
  return {
    active,
    variant,
    // The label of the variant on every event of the learning log.
    label: active ? `${active}:${variant}` : 'base',
    // The variants that the parent can choose.
    variants: active ? Object.keys(all[active].variants) : [],
    value: (key) => switches[key],
    switches: { ...switches },
  };
}

// The variant of an experiment for a seed: the same each time for the same seed.
export function variantOf(seed, experiment, names) {
  return names[hashSeed(`${seed}:experiment:${experiment}`) % names.length];
}
