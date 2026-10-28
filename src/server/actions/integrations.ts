"use server";

import { fail, ok, type ActionResult } from "../dal";
import { getActionUser } from "../session";

/** Registers the bot's commands (global, usable in servers and DMs as a user-installed app). */
export async function registerDiscordCommands(): Promise<ActionResult<{ count: number }>> {
  try {
    await getActionUser();
    const appId = process.env.DISCORD_APPLICATION_ID;
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!appId || !token) throw new Error("DISCORD_APPLICATION_ID et DISCORD_BOT_TOKEN sont requis.");
    const everywhere = { integration_types: [0, 1], contexts: [0, 1, 2] };
    const commands = [
      {
        name: "save",
        type: 1,
        description: "Enregistrer une note dans Cockpit",
        options: [{ type: 3, name: "texte", description: "Ce que tu veux garder", required: true }],
        ...everywhere,
      },
      { name: "Enregistrer dans Cockpit", type: 3, ...everywhere },
    ];
    const response = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
      method: "PUT",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    });
    if (!response.ok) throw new Error(`Discord a répondu ${response.status} : ${(await response.text()).slice(0, 200)}`);
    return ok({ count: commands.length });
  } catch (error) {
    return fail(error);
  }
}
