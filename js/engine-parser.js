/**
 * Derive structured engine attributes from the existing engine string.
 * Returns null for fields that do not apply (e.g. EVs, rotary cylinders).
 * @returns {{ powertrain: string|null, configuration: string|null, cylinders: number|null, aspiration: string|null }}
 */
export function parseEngineDetails(engineStr) {
  const empty = {
    powertrain: null,
    configuration: null,
    cylinders: null,
    aspiration: null,
  };

  if (!engineStr || typeof engineStr !== 'string') return empty;

  const engine = engineStr.trim();

  if (/\bEV\b/i.test(engine)) {
    return {
      powertrain: 'EV',
      configuration: null,
      cylinders: null,
      aspiration: null,
    };
  }

  let powertrain = 'ICE';
  if (/\bPlug-In Hybrid\b/i.test(engine)) {
    powertrain = 'PHEV';
  } else if (
    /\bMild Hybrid\b/i.test(engine) ||
    /\bHybrid\b/i.test(engine) ||
    /\bRange Extender\b/i.test(engine)
  ) {
    powertrain = 'Hybrid';
  } else if (/\bFCEV\b/i.test(engine) || /\bFuel Cell\b/i.test(engine)) {
    powertrain = 'FCEV';
  }

  let configuration = null;
  let cylinders = null;

  if (/\bTwin-Rotor\b/i.test(engine)) {
    configuration = 'Rotary';
  } else {
    const configMatch = engine.match(/\b(?:Flat-(\d+)|(I|V|H|W)(\d+))\b/i);
    if (configMatch) {
      if (configMatch[1]) {
        configuration = 'Flat/Boxer';
        cylinders = Number(configMatch[1]);
      } else {
        const letter = configMatch[2].toUpperCase();
        cylinders = Number(configMatch[3]);
        if (letter === 'I') configuration = 'Inline';
        else if (letter === 'H') configuration = 'Flat/Boxer';
        else configuration = letter;
      }
    }
  }

  let aspiration = null;
  if (/\bQuad-Turbo\b/i.test(engine)) {
    aspiration = 'Quad-Turbo';
  } else if (/\bTwin-Turbo\b/i.test(engine)) {
    aspiration = 'Twin-Turbo';
  } else if (/\bSupercharged\b/i.test(engine)) {
    aspiration = 'Supercharged';
  } else if (/\bTurbo\b/i.test(engine)) {
    aspiration = 'Turbocharged';
  } else if (configuration || cylinders) {
    aspiration = 'Naturally Aspirated';
  }

  return { powertrain, configuration, cylinders, aspiration };
}
