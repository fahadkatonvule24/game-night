(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GameNightBanter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // What the host would shout from the sofa. {name}, {card}, {suit} and {other} are filled in.
  const LINES = {
    right: ['{name} is cooking! 🔥', 'Big brain energy from {name}.', 'Somebody frame that answer.', '{name} said it with their whole chest, and it was RIGHT.', 'Easy money for {name}.', 'Is {name} secretly a professor?', 'Nailed it. No notes.', '{name} came here to win.'],
    streak: ['{name} is ON FIRE. Somebody get a bucket! 🧯', 'Three in a row? {name} is unstoppable.', 'The rest of you might as well go home.', '{name} has entered beast mode.'],
    wrong: ['Bold. Incorrect, but bold.', 'We’ll pretend we didn’t see that, {name}.', '{name} said that with confidence… and that’s all it had.', 'Close! Well, not really.', 'Even the clock is embarrassed.', 'Google is crying somewhere.', 'That answer was a choice, {name}.'],
    skip: ['{name} has chosen peace. ✌️', 'Strategic retreat!', 'Skipping is a lifestyle.', 'Nope, nope, next!', '{name} saw that and ran.'],
    timeout: ['The clock wins this one. ⏰', 'Tick tock… too late, {name}!', '{name} froze like Wi-Fi in a storm.', 'Time’s up! Thoughts and prayers.'],
    perfect: ['PERFECT ROUND! {name} should be studied by scientists.', 'Flawless. Absolutely flawless.'],
    'card-play': ['{name} slaps down the {card}!', '{name} plays the {card}. Smooth.', 'The {card} hits the table. Ooh.', '{name} drops the {card} like it’s nothing.'],
    'card-ace': ['{name} plays an Ace and calls {suit}! 😈', 'Plot twist: {name} switches to {suit}!', 'Ace on the table! Everybody adjust to {suit}.'],
    'card-two': ['{name} drops a 2! {other} picks {count} 😬', 'Here comes a 2! {other}, answer it or pick {count}.', '{name} says: pick {count}, {other}. Sorry not sorry.'],
    'card-skip': ['{name} skips {other}! Sit this one out 😂', 'Jumped! {other} misses a turn.', '{other} has been skipped. Cold-blooded, {name}.'],
    'card-penalty': ['{name} picks up {count}. Ouch! 😵', '{count} cards for {name}. That’s going to hurt.', '{name} eats {count} cards 🍽️'],
    'card-cut': ['✂️ {name} CUTS the game with the {card}! Count your points!', 'The cutter lands! {name} ends it. Show your hands! ✂️'],
    'card-pick': ['{name} goes fishing… 🎣', '{name} picks one up. Hmm 🤔', 'Nothing to play? {name} takes a card.'],
    'card-pass': ['{name} passes. Nothing to see here 🙈', '{name} shrugs and passes.'],
    'card-last': ['⚠️ {name} has ONE card left!', '{name} is one card from glory 😱', 'Somebody stop {name}, they’re on their last card!'],
    'card-reshuffle': ['The deck ran dry! The pile gets reshuffled 🔄', 'Fresh shuffle! Only the top card stays.'],
    'card-win': ['🏆 {name} empties their hand and wins!', '{name} wins! Bow down. 👑', 'And that’s game. {name} is the card shark 🦈'],
    'rps-round': ['{name} takes the round!', '{name} saw that coming a mile away.', 'Read like a book. Point to {name}!'],
    'rps-tie': ['Great minds think alike… a tie!', 'Same throw! Again, again!'],
    'rps-win': ['{name} wins the duel! 🏆', '{name} is the hand-game champion 👑'],
    'four-win': ['Four in a row! {name} wins! 🏆', '{name} connects four and takes it!'],
    'four-draw': ['The board is full. It’s a draw! 🤝'],
    boom: ['💥 BOOM! {name} was holding the bomb!', '{name} got blown up! Better luck next time 💥', 'Kaboom! {name} has some explaining to do.'],
    vote: ['The people have spoken: {name}! 😂', 'Unanimous-ish. It’s {name}!', '{name}… we all saw it coming.'],
    'imp-caught': ['Busted! {name} was the imposter all along 🕵️', 'Nice detective work! {name} is caught red-handed.', '{name} tried to blend in. It did not work.'],
    'imp-escaped': ['{name} fooled everyone. Oscar-worthy performance 😈', 'Trust no one. {name} got away with it!', 'The imposter walks free. Well played, {name}.'],
    'imp-stole': ['{name} got caught… then guessed the word. Unbelievable! 🤯', 'Caught but not beaten! {name} steals it.'],
    'wyr-split': ['The room is divided! ⚔️', 'Friendships have been tested tonight.', 'Half of you are wrong. Discuss.'],
    'wyr-same': ['Total agreement! Who even are you people? 🤝', 'One mind, one vote. Creepy.']
  };
  const EMOJIS = {
    right: ['👏', '🔥', '🎉', '🤩'], streak: ['🔥', '😎', '🚀'], wrong: ['😂', '🙈', '💀', '😬'], skip: ['🏃', '🙈', '✌️'],
    timeout: ['⏰', '😱', '💤'], perfect: ['🏆', '🤯', '🎉'], 'card-ace': ['😈', '🃏'], 'card-two': ['😬', '😂'], 'card-skip': ['⏭️', '😂'], 'card-penalty': ['😵', '🍽️'], 'card-cut': ['✂️', '😱', '🧮'], 'card-last': ['😱', '⚠️'],
    'card-win': ['🏆', '🎉', '👑'], 'card-pick': ['🎣'], 'card-reshuffle': ['🔄'], 'rps-round': ['👊', '🔥'], 'rps-tie': ['🤝'],
    'rps-win': ['🏆', '👑'], 'four-win': ['🏆', '🎉'], 'four-draw': ['🤝'], boom: ['💥', '😵', '🔥'], vote: ['😂', '👉', '🙈'],
    'imp-caught': ['🕵️', '🎉', '👏'], 'imp-escaped': ['😈', '🎭'], 'imp-stole': ['🤯', '😈'], 'wyr-split': ['⚔️', '😂'], 'wyr-same': ['🤝', '😍']
  };

  const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];
  function line(kind, vars = {}, rng = Math.random) {
    const pool = LINES[kind];
    if (!pool) return '';
    return pick(pool, rng).replace(/\{(\w+)\}/g, (match, key) => (vars[key] === undefined ? match : String(vars[key])));
  }
  function emojis(kind) { return (EMOJIS[kind] || []).slice(); }

  return Object.freeze({ line, emojis, kinds: Object.freeze(Object.keys(LINES)) });
});
