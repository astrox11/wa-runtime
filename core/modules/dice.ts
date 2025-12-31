import { Message, type CommandProperty } from "..";

const activeGames = new Map<
  string,
  { player: string[]; rolled: number; score: number; chances: number }
>();
const diceEmojis = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

async function animateDice(msg: Message) {
  const m = await msg.reply("🎲 Rolling...");
  for (let i = 0; i < 3; i++) {
    await new Promise((res) => setTimeout(res, 500));
    const randomDice = diceEmojis[Math.floor(Math.random() * 6) + 1];
    await m.edit(`${randomDice} Rolling...`);
  }
  return m;
}

export default [
  {
    pattern: "dice",
    category: "games",
    async exec(msg) {
      if (activeGames.has(msg.chat))
        return await msg.reply("```A game is already running in this chat.```");

      const player = [msg.sender, msg.sender_alt];
      const result = rollDice();

      activeGames.set(msg.chat, {
        player,
        rolled: result.value,
        score: 0,
        chances: 3,
      });

      const m = await animateDice(msg);
      return await m.edit(
        "```Dice Game Started\nType a number between 1 and 6 to guess rolled dice.```",
      );
    },
  },
  {
    event: true,
    category: "games",
    dontAddToCommandList: true,
    async exec(msg) {
      if (
        !activeGames.has(msg.chat) ||
        !activeGames.get(msg.chat).player.includes(msg.sender) ||
        !msg.text
      )
        return;

      const game = activeGames.get(msg.chat);
      const match = extractDiceNumber(msg.text);
      if (!match) return;

      if (match === game.rolled) {
        game.score += 5;
        game.chances = 3;
        game.rolled = rollDice().value;

        await msg.reply(`\`\`\`Correct!\nYour score is ${game.score}\`\`\``);
        const m = await animateDice(msg);
        await m.edit("```Now, pick another number again```");
      } else if (match !== game.rolled && game.chances > 1) {
        game.chances -= 1;
        return await msg.reply(
          "```Try again you have " + game.chances + " chances left.```",
        );
      } else {
        const finalDice = game.rolled;
        const finalScore = game.score;
        activeGames.delete(msg.chat);

        return await msg.reply(
          "```Game over\nThe rolled dice was " +
            diceEmojis[finalDice] +
            " (" +
            finalDice +
            ").\nYou scored " +
            finalScore +
            " points.```",
        );
      }
    },
  },
] satisfies CommandProperty[];

function rollDice(exclude?: number) {
  const pool = [1, 2, 3, 4, 5, 6].filter((v) => v !== exclude);
  if (!pool.length) throw new Error("No valid dice values left");

  const value = pool[(Math.random() * pool.length) | 0];
  return { value, emoji: diceEmojis[value] };
}

function extractDiceNumber(input: unknown) {
  return typeof input === "string"
    ? Number(input.match(/\b[1-6]\b/)?.[0] ?? NaN) || null
    : null;
}
