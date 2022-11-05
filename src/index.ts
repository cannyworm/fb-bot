import dotenv from "dotenv";

dotenv.config();
import fs from "node:fs/promises";
import cron from "node-cron";

import { Client, EmbedBuilder, WebhookClient } from "discord.js";
import db from "./db";

import { Facebook, SimplePost } from "facebook-scraper";

interface ConfigFile {
  interval: string;
  pages: string[];
  webhook: string;
}

async function main() {
  const config_file = await fs.readFile("./config.json");
  const config: ConfigFile = JSON.parse(config_file.toString());

  // await fs.writeFile("./posts.json" , JSON.stringify( posts ))

  // const posts : SimplePost[] = JSON.parse( (await fs.readFile("./posts.json")).toString() )

  const webhook = new WebhookClient({
    url: config.webhook,
  });

  const craft_post_embeds = (post: SimplePost) => {
    const out: EmbedBuilder[] = [];

    const main = new EmbedBuilder();
    out.push(main);

    main.setAuthor({ name: post.author.name, iconURL: post.author.pfp });
    main.setURL(post.url);
    main.setTitle("[ post ]");
    main.setFooter({ text: "@cannyworm/facebook-scraper" });

    if (post.text) main.setDescription(post.text);

    main.setTimestamp(post.timestamp);

    if (post.images.length != 0) {
      main.setImage(post.images[0]);
      if (post.images.length > 1) {
        for (let i = 1; i < 4; i++) {
          out.push(
            new EmbedBuilder({ image: { url: post.images[i] }, url: post.url })
          );
        }
      }
    }

    if (post.share) {
      main.setTitle(
        "[ :small_red_triangle_down: share :small_red_triangle_down:  ]"
      );
      out.push(...craft_post_embeds(post.share));
    }

    return out;
  };

  const job = async () => {
    console.log('[job] start check for new post')
    const posts: SimplePost[] = [];

    await Promise.all(
      config.pages.map(async (page) => {
        const fb = new Facebook();
        let ps = await fb.get_page_lastes_post(page);
        posts.push(...ps);
      })
    );

    if (!(await db.exists("/posts"))) await db.push("/posts", ["0"]);

    const posted = await db.getObject<string[]>("/posts");

    const new_post = posts.filter((p) => !posted.includes(p.id));

    await Promise.all(
      new_post.map((p) => webhook.send({ embeds: craft_post_embeds(p) }))
    );

    await db.push(
      "/posts",
      posts.map((np) => np.id)
    );
    console.log('[job] done')
  };

  cron.schedule( config.interval , job )


}

main();
