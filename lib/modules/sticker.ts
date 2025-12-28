import { imageToWebp, videoToWebp, type CommandProperty } from "..";

export default [
  {
    pattern: "sticker",
    category: "media",
    async exec(msg, _, args) {
      const author = args?.split(" ")?.[0];
      const packname = args?.split(" ")?.[1];

      let media: Buffer;

      if (msg?.quoted?.image || msg?.quoted?.video) {
        if (msg.quoted.image)
          media = await imageToWebp(await msg.quoted.download());

        if (msg.quoted.video)
          media = await videoToWebp(await msg.quoted.download());

        return await msg.send_sticker(media, { author, packname });
      }
      return await msg.reply("```Reply a video or image```");
    },
  },
  // {
  //   pattern: "take",
  //   category: "media",
  //   async exec(msg, _, args) {},
  // },
] satisfies CommandProperty[];
