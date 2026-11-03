# Game Night

A cosy game-night hub for one room full of friends: add your crew, shuffle into teams, and pick something to play. Includes fifteen games: team battles that climb from Easy to Hard and crown a champion, group icebreakers, secret roles, and phone games you play from your own phone over the laptop's Wi-Fi.

## Open the website

Double-click **index.html** to open it in your browser. Everything runs locally, with no accounts or installation needed.

You can also use **Node.js 18 or newer** to serve it locally:

```sh
npm start
```

Then visit **http://localhost:3000**. No `npm install` is required.

## Set up your night

1. Choose **2–40 players** and enter their names. Blank names become “Player 1”, “Player 2”, and so on.
2. Choose **2–8 teams**, up to the number of players.
3. Shuffle to create random, balanced teams. When the numbers do not divide evenly, team sizes differ by at most one person.
4. Pick a game, follow its rules, and play together.

| Game | Players | How it works |
| --- | --- | --- |
| Charades | 4+ | Act out the prompt without speaking. Categories: capital cities, countries, animals, artists & musicians, everyday actions. |
| Taboo | 4+ | Explain the word without using the forbidden words. |
| Trivia | 2+ | A game-show night: each team takes the hot seat for 10 questions per level. Categories: Uganda, Africa, capital cities, countries, animals, sports, science & space, world history, arts & entertainment, general knowledge. |
| Quick Draw | 4+ | Draw the prompt using your own pen and paper. Categories: animals, places, objects, food. |
| Five-Second Challenge | 2+ | Name three things that fit before the five-second buzzer. Categories: animals, geography, entertainment, everyday. |
| Who Am I? | 4+ | Hold the screen to your forehead while your team describes it. Categories: animals, artists, fictional characters, jobs. |
| Guess the Imposter | 3–12 | Everyone sees a secret word except one bluffer. Give clues, then vote in private. |
| Categories | 2+ | Go around the group naming things that fit. |
| Would You Rather | 2+ | Pick a side and explain your choice. Ten dilemmas per game. |
| Emoji Decode | 2+ | Crack the film, saying, or place hidden in a row of emojis. Only the holder peeks at the answer. |
| Most Likely To | 3+ | Everyone points on three. Tap who got the most fingers to give them the title. |
| Pass the Bomb | 3+ | Name something that fits, then pass the screen before the hidden fuse runs out. |
| Matatu 📱 | 2–6 | Uganda's favourite card game on your phones. Follow suit, drop 2s, skip with 8s and Jacks, change suit with Aces, or cut the game with the cutter. |
| Rock Paper Scissors 📱 | 2 | A best-of-five duel. Both players throw in secret on their phones. |
| Four in a Row 📱 | 2 | Drop discs from your phones. Line up four to win. |

## Matches and levels

Charades, Taboo, Quick Draw, Five-Second Challenge, Who Am I?, and Emoji Decode play as a match. Every team gets one turn at **Easy** (1 point per answer), then one at **Medium** (2 points), then one at **Hard** (3 points). Level standings appear between levels, and a champion is crowned at the end, so the game always finishes. Pick a category, or choose "Mixed" to play them all. You can also play a single level. House words have no levels: every team gets one turn at 1 point per word.

## Phone games

Matatu, Rock Paper Scissors, and Four in a Row are played on everyone's own phone.

1. On the laptop, run `npm start`. It prints a Wi-Fi address such as `http://192.168.1.23:3000`.
2. Open a phone game on the laptop. The big screen shows a QR code and a four-letter table code.
3. Players scan the code with their phone camera, or open the address and enter the code. Phones must be on the same Wi-Fi as the laptop.
4. When everyone is seated, tap **Deal everyone in**. Each phone shows only its owner's cards or buttons. The big screen shows the table, whose turn it is, and the host's running commentary.

**Matatu** follows the Ugandan rules. Everyone gets seven cards, and a **cutting card** is turned face up; the **7 of its suit is the cutter**. Follow the top card's suit or rank. If you can't play, or don't want to, tap **Pick** to take one card, and your turn ends.

| Card | What it does |
| --- | --- |
| 2 | The next player picks 2, unless they answer with a 2. Then the following player picks 4, and so on. |
| 8 or J | Skips the next player. With two players, you play again. |
| A | Goes on anything. You choose the new suit. |
| The cutter (7 of the cutting suit) | Ends the game at once. Everyone counts the points in their hand, and the lowest total wins. |

Points: A = 15, 2 = 20, J = 11, Q = 12, K = 13, and every other card is worth its number. Playing your last card wins outright. When the picking deck runs out, the top played card stays and the rest are shuffled back in. Phones show a badge on every power card, your hand's points, and a "What each card does" guide.

### Party games on phones

**Guess the Imposter**, **Pass the Bomb**, **Most Likely To**, and **Would You Rather** can be played either way. Choose **📱 Play on phones**, or **Pass one screen** when there's no Wi-Fi.

- **Guess the Imposter:** everyone scans the code and types their name. Each phone privately shows the secret word, or "You are the imposter". The laptop never shows the word. The host starts the clue timer, everyone votes on their phone, and the laptop ticks off who has voted. Tap **Reveal the imposter** when you're ready. A caught imposter types their last guess on their own phone.
- **Pass the Bomb:** the phone holding the bomb turns **green** and shows its own question, and every pass brings a new one. Answer out loud, then tap **Pass**. The fuse is hidden on the laptop server and speeds up as it burns. Whoever holds it at the boom takes a bomb. After five rounds, the fewest bombs wins.
- **Most Likely To / Would You Rather:** everyone votes in secret on their phone. The laptop shows who has voted, then reveals the result when you tap.

The first time you run the server, Windows may ask whether Node.js can use the network. Allow it on **private networks** so phones can connect.

## Trivia Night

Trivia plays like a TV quiz show. Each level, every team gets its own round of **10 questions**, one team after another. Easy answers are worth 1 point, Medium 2, and Hard 3. Choose "All three" to climb from Easy to Hard, or play a single level.

- **The hot seat.** Before each round, pick the player who answers. Teammates can cheer, but no hints. A different player starts each level.
- **Halftime huddle.** After question 5, the team gets a **2-minute** huddle to swap in a teammate or keep the same player. When the clock runs out, or you lock someone in, that player finishes the round.
- **The show.** Pick an answer for a short drum roll, then the reveal. Standings appear after each level, and a champion is crowned at the end. Points reach the scoreboard as soon as they're won, so closing early keeps them.
- **Host keys.** **A–D** answer, **S** passes, **P** pauses, and **N** or **→** moves on.

No question repeats during a show. Each category has at least 10 questions per level; when one runs short, it borrows from the same level.

## Guess the Imposter

Pass the device around so each player can privately check their role. Everyone except the imposter sees the secret word. Take turns giving clues, discuss, then pass the device around again for private votes. A caught imposter gets one last guess at the word and steals the win with the right answer. Imposter is a group game, so it does not change team scores.

## Extras

- **Automatic host banter.** Right answers, misses, passes, time-outs, streaks, card plays, and explosions get a one-line comment using the player's name, plus matching emojis that float up the screen.
- **Faces and names.** Every player gets an emoji face. Tap a face on the guest list to change it. If players are still nameless, each game's setup screen lets you name them, and those names show up in the spotlight.
- **On stage.** Every game plays on a game-show stage. Team games open with a spotlight on the team, so you can pick who acts, draws, gives clues, or guesses before the clock starts.
- **Moods.** The performer's face reacts as the round plays out: 🤩 after a point, 😅 after a skip, 😰 and 😱 as time runs out, 😎 and 🔥 on a streak, and 😴 while paused.
- **Reactions.** Tap 👏 😂 😱 🔥 🤯 😍 to send emojis floating up the screen. In Guess the Imposter, reactions only appear on shared screens, never while someone is checking a secret.
- **House words.** Open **✎ House words** under "Who's playing?" and type your own words, one per line: inside jokes, friends' names, local spots. They show up as a "House words" category in Charades, Who Am I?, and Guess the Imposter. House words have no levels.
- **Hot streaks.** Three correct answers in a row shows 🔥 ON FIRE, with a special sound at 3, 5, and 10 in a row. The round summary shows your best streak.
- **Confetti.** Bursts for level-ups, big rounds, hot streaks, a caught imposter, and the champions. It turns off when your device asks for reduced motion.
- **Crown the champions.** On the scoreboard, this shows a podium with a fanfare. Tied teams share a place.
- **Host keys.** On a laptop, use **G** or **→** for got it, **S** or **←** to skip, and **P** to pause. Trivia uses **A–D** to answer and **N** for next. Five-Second Challenge uses **G** to start or stop the clock, then **Y** or **N** to judge.

## Sounds

Short sound effects play for starting, correct answers, skips, the final-seconds countdown, level-ups, and the end of a round. Trivia adds a spotlight sting, a lock-in drum roll, a time's-up buzzer, and a halftime whistle. Use **Sound on/off** in the header or game window, plus the volume slider while playing. Sounds are generated in the browser, so nothing is downloaded, and nothing plays until you tap something.

Use one shared screen. For hidden prompts, pass the device to the performer so the guessing team cannot see the answer. Team games add points to the scoreboard; you can also adjust scores manually. Guess the Imposter, Categories, and Would You Rather are unscored group games.

Charades, Taboo, Quick Draw, and Who Am I? need at least two people on every team. If a team is too small, the game will ask you to reduce the team count or add players.

## Saving your night

The website saves your setup and scores in your current browser. It does not use accounts or internet multiplayer: phone games only work between devices on the same Wi-Fi as the laptop, and an open table disappears when the server stops. Opening the file directly and visiting `localhost:3000` may use separate saves; clearing browser data removes saved progress. Local-file storage availability depends on your browser.

## Development checks

```sh
npm install
npm test
npm run check
```

Development tests use Node.js 22 or newer, jsdom, and jsQR (to check that the generated QR codes scan). They cover the phone-game rules, the local server, QR codes, team balancing, player validation, randomization, saved progress, round timers, scoring, categories and level-ups, Trivia Night rounds and the halftime huddle, Five-Second Challenge, Guess the Imposter, and sound settings. The check command validates JavaScript syntax. The website itself has no runtime dependencies.
