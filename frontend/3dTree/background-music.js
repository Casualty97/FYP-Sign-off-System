// Background music for the 3D ESG Tree: a gentle piece that plays together with the river, wind and bird
// sounds (ambience.js) whenever the page's sound is on and the admin's "Background music" is ticked
// (tree3dParameters.musicEnabled, at musicVolume). It is original music composed here, live, by the browser
// (Web Audio), so it is never the same twice and there is no recording or anyone else's music in it, nothing
// to license: soft kalimba notes over a warm pad and a low bass, slow, in a hall's echo. Each bar has its
// chord (CHORDS); the tune is chosen as it plays, moving by small steps through the chord's notes and the
// key's pentatonic scale, with rests, so it breathes like the river. Turning it off fades it out.

const midiHz = note => 440 * 2 ** ((note - 69) / 12);

const BPM = 62;
// One chord per bar (MIDI notes; 60 = middle C): its bass and the notes of its pad. C, A minor, F, G, with
// colour notes, round and round.
const CHORDS = [
  { bass: 36, pad: [55, 59, 62, 64] }, // Cmaj9
  { bass: 33, pad: [55, 60, 64, 67] }, // Am7
  { bass: 29, pad: [57, 60, 64, 65] }, // Fmaj7
  { bass: 31, pad: [55, 59, 62, 67] }, // G
];
const SCALE = [72, 74, 76, 79, 81, 84, 86]; // C major pentatonic, up high, for the kalimba
const BUSY = 0.32;                          // the share of eighth notes that sound
const LEVELS = { pad: 0.034, bass: 0.12, kalimba: 0.16 };

function envelope(context, output, start, attack, peak, hold, release) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.setValueAtTime(peak, start + attack + hold);
  gain.gain.setTargetAtTime(0, start + attack + hold, release / 4);
  gain.connect(output);
  return gain;
}

function tone(context, type, frequency, detune = 0) {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.detune.value = detune;
  return oscillator;
}

// A warm, slow pad: two soft saws a little apart, through a low filter.
function pad(context, output, note, start, length) {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.4;
  const attack = Math.min(2.4, length * 0.35);
  filter.connect(envelope(context, output, start, attack, LEVELS.pad, length - attack, 3));
  for (const detune of [-7, 7]) {
    const oscillator = tone(context, 'sawtooth', midiHz(note), detune);
    oscillator.connect(filter);
    oscillator.start(start);
    oscillator.stop(start + length + 3.5);
  }
}

// A kalimba: a round tine with a short bright click.
function kalimba(context, output, note, start, level) {
  const body = envelope(context, output, start, 0.004, level, 0, 1.6);
  const click = envelope(context, output, start, 0.002, level * 0.22, 0, 0.12);
  const fundamental = tone(context, 'sine', midiHz(note));
  const overtone = tone(context, 'sine', midiHz(note) * 5.4);
  fundamental.connect(body);
  overtone.connect(click);
  for (const oscillator of [fundamental, overtone]) { oscillator.start(start); oscillator.stop(start + 2.2); }
}

// A low, soft bass under each chord.
function bass(context, output, note, start, length) {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  filter.connect(envelope(context, output, start, 0.25, LEVELS.bass, length - 0.25, 1.4));
  const oscillator = tone(context, 'triangle', midiHz(note));
  oscillator.connect(filter);
  oscillator.start(start);
  oscillator.stop(start + length + 2);
}

// A hall's echo, made once: two channels of fading noise.
function hallReverb(context, seconds = 3.4) {
  const length = Math.floor(context.sampleRate * seconds);
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      smooth += 0.35 * ((Math.random() * 2 - 1) - smooth); // a little darker than white noise
      data[i] = smooth * (1 - i / length) ** 2.4;
    }
  }
  const reverb = context.createConvolver();
  reverb.buffer = impulse;
  return reverb;
}

// The music player: setActive(true) plays the piece (bars are scheduled a moment ahead on the audio clock),
// setActive(false) fades it out.
export function createMusic(context, output) {
  const reverb = hallReverb(context);
  reverb.connect(output);
  const beat = 60 / BPM;
  const barLength = beat * 4;
  let playing = null;

  function start() {
    const bus = context.createGain();
    bus.gain.value = 0;
    const dry = context.createGain();
    dry.gain.value = 0.72;
    const wet = context.createGain();
    wet.gain.value = 0.6;
    bus.connect(dry).connect(output);
    bus.connect(wet).connect(reverb);
    let bar = 0;
    let nextBar = context.currentTime + 0.15;
    let lastNote = SCALE[3];

    function scheduleBar(at) {
      const chord = CHORDS[bar % CHORDS.length];
      bass(context, bus, chord.bass, at, barLength);
      for (const note of chord.pad) pad(context, bus, note, at, barLength + 0.4);
      // The tune: on each eighth note, a note now and then, by small steps, often a note of the chord.
      const chordNotes = new Set(chord.pad.map(note => note % 12));
      for (let step = 0; step < 8; step++) {
        const strong = step % 2 === 0;
        if (Math.random() > BUSY * (strong ? 1.3 : 0.7)) continue;
        const near = SCALE.filter(note => Math.abs(note - lastNote) <= 5 && note !== lastNote);
        const choices = near.length ? near : SCALE;
        const fitting = choices.filter(note => chordNotes.has(note % 12));
        const pool = strong && fitting.length ? fitting : choices;
        lastNote = pool[Math.floor(Math.random() * pool.length)];
        const swing = (Math.random() - 0.5) * 0.03; // played by hand, not by a machine
        kalimba(context, bus, lastNote, at + step * beat / 2 + swing, LEVELS.kalimba * (0.75 + Math.random() * 0.35));
      }
      bar += 1;
    }

    const timer = window.setInterval(() => {
      while (nextBar < context.currentTime + 1.6) {
        scheduleBar(nextBar);
        nextBar += barLength;
      }
    }, 300);
    bus.gain.setTargetAtTime(1, context.currentTime, 0.8);
    return {
      stop() {
        window.clearInterval(timer);
        bus.gain.setTargetAtTime(0, context.currentTime, 0.6);
        window.setTimeout(() => { bus.disconnect(); dry.disconnect(); wet.disconnect(); }, 6000); // after the last notes ring out
      },
    };
  }

  return {
    setActive(on) {
      if (on && !playing) playing = start();
      else if (!on && playing) { playing.stop(); playing = null; }
    },
    get active() { return Boolean(playing); },
  };
}
