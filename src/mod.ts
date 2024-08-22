import { crypto_check } from "https://deno.land/x/monocypher@v3.1.2-4/mod.ts";

import * as Discord from "./types.ts";

export default abstract class DiscordApplication {
    static readonly BASE_URL = "https://discord.com/api/v10";
    private botInstance?: typeof DiscordApplication.Bot.prototype;

    constructor(private id: string, private publicKey: string) {
        this.id = id;
        this.publicKey = publicKey;
    }

    /**
     * @param req The request from the Discord
     * @returns The response to send back to Discord
     */
    async requestHandler(req: Request): Promise<Response> {
        // Verify that the request is from Discord
        const sig = req.headers.get("X-Signature-Ed25519");
        const timestamp = req.headers.get("X-Signature-Timestamp");
        const message = await req.text();

        if (sig === null || timestamp === null) {
            return new Response("Forbidden", { status: 403 });
        }

        const enc = new TextEncoder();
        const isVerified = crypto_check(
            enc.encode(sig),
            enc.encode(this.publicKey),
            enc.encode(timestamp + message),
        );
        if (!isVerified) {
            return new Response("Invalid request signature", { status: 401 });
        }

        const data = JSON.parse(message); // as interaction

        // Handle PING which is used by Discord to verify the endpoint
        if (data.type === Discord.InteractionType.PING) {
            return new Response(
                JSON.stringify({ type: Discord.InteractionResponseType.PONG }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            );
        }

        // Handle the interaction
        try {
            const res = await this.interactionHandler(data);
            return new Response(JSON.stringify(res), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        } catch (e) {
            console.error(e);
            return new Response("Internal server error", { status: 500 });
        }
    }

    /**
     * @param interaction The interaction from Discord
     * @returns An interaction response to send back to Discord
     */
    abstract interactionHandler(
        interaction: Discord.Interaction,
    ): Discord.InteractionResponse | Promise<Discord.InteractionResponse>;

    createBot(token: string) {
        this.botInstance = new DiscordApplication.Bot(token);
        return this.botInstance;
    }

    get bot() {
        if (!this.botInstance) {
            throw new Error("Use createBot() to set a bot token first");
        }
        return this.botInstance;
    }

    // REST API
    // TODO: Split different apis into different files

    private async commandFetch(endpoint: string, options?: RequestInit) {
        const res = await fetch(
            `${DiscordApplication.BASE_URL}/applications/${this.id}/commands/${endpoint}/`,
            options,
        );
        if (!res.ok) throw new Error(res.statusText);
        return res;
    }

    async getCommands() {
        const res = await this.commandFetch("");
        return await res.json() as Discord.ApplicationCommand[];
    }

    async createGlobalCommand(command: Discord.ApplicationCommandInit) {
        const res = await this.commandFetch("", {
            method: "POST",
            body: JSON.stringify(command),
        });
        return await res.json() as Discord.ApplicationCommand;
    }

    async getGlobalCommand(commandId: string) {
        const res = await this.commandFetch(`${commandId}`);
        return await res.json() as Discord.ApplicationCommand;
    }

    async editGlobalCommand(
        commandId: string,
        command: Discord.ApplicationCommandInit,
    ) {
        const res = await this.commandFetch(`${commandId}`, {
            method: "PATCH",
            body: JSON.stringify(command),
        });
        return await res.json() as Discord.ApplicationCommand;
    }

    async deleteGlobalCommand(commandId: string) {
        await this.commandFetch(`${commandId}`, {
            method: "DELETE",
        });
    }

    async bulkOverwriteGlobalCommands(
        commands: Discord.ApplicationCommandInit[],
    ) {
        const res = await this.commandFetch("", {
            method: "PUT",
            body: JSON.stringify(commands),
        });
        return await res.json() as Discord.ApplicationCommand[];
    }

    async getGuildCommands(guildId: string) {
        const res = await this.commandFetch(`guilds/${guildId}/commands`);
        return await res.json() as Discord.ApplicationCommand[];
    }

    async createGuildCommand(
        guildId: string,
        command: Discord.ApplicationCommandInit,
    ) {
        const res = await this.commandFetch(`guilds/${guildId}/commands`, {
            method: "POST",
            body: JSON.stringify(command),
        });
        return await res.json() as Discord.ApplicationCommand;
    }

    async getGuildCommand(guildId: string, commandId: string) {
        const res = await this.commandFetch(
            `guilds/${guildId}/commands/${commandId}`,
        );
        return await res.json() as Discord.ApplicationCommand;
    }

    async editGuildCommand(
        guildId: string,
        commandId: string,
        command: Discord.ApplicationCommandInit,
    ) {
        const res = await this.commandFetch(
            `guilds/${guildId}/commands/${commandId}`,
            {
                method: "PATCH",
                body: JSON.stringify(command),
            },
        );
        return await res.json() as Discord.ApplicationCommand;
    }

    async deleteGuildCommand(guildId: string, commandId: string) {
        await this.commandFetch(`guilds/${guildId}/commands/${commandId}`, {
            method: "DELETE",
        });
    }

    async bulkOverwriteGuildCommands(
        guildId: string,
        commands: Discord.ApplicationCommandInit[],
    ) {
        const res = await this.commandFetch(`guilds/${guildId}/commands`, {
            method: "PUT",
            body: JSON.stringify(commands),
        });
        return await res.json() as Discord.ApplicationCommand[];
    }

    async getGuildCommandPermissions(guildId: string) {
        const res = await this.commandFetch(
            `guilds/${guildId}/commands/permissions`,
        );
        return await res.json() as Discord.GuildApplicationCommandPermissions[];
    }

    // Interactions API

    static InteractionWrapper = class InteractionWrapper {
        constructor(
            public readonly interaction:
                | Discord.Interaction
                | Pick<Discord.Interaction, "token" | "application_id">,
        ) {
            this.interaction = interaction;
        }

        private async fetch(endpoint: string, options?: RequestInit) {
            const res = await fetch(
                `${DiscordApplication.BASE_URL}/webhooks/${this.interaction.application_id}/${this.interaction.token}/messages/${endpoint}/`,
                options,
            );
            if (!res.ok) throw new Error(res.statusText);
            return res;
        }

        async editOriginal(msg: Discord.InteractionResponseData) {
            const res = await this.fetch(
                `@original`,
                {
                    method: "PATCH",
                    body: JSON.stringify(msg),
                },
            );
            return await res.json() as Discord.Message;
        }

        async deleteOriginal() {
            await this.fetch(`@original`, {
                method: "DELETE",
            });
        }

        async getOriginal() {
            const res = await this.fetch(`@original`);
            return await res.json() as Discord.Message;
        }

        async createFollowup(msg: Discord.InteractionResponseData) {
            const res = await this.fetch("", {
                method: "POST",
                body: JSON.stringify(msg),
            });
            return await res.json() as Discord.Message;
        }

        async editFollowup(
            msgId: string,
            msg: Discord.InteractionResponseData,
        ) {
            const res = await this.fetch(`${msgId}`, {
                method: "PATCH",
                body: JSON.stringify(msg),
            });
            return await res.json() as Discord.Message;
        }

        async deleteFollowup(msgId: string) {
            await this.fetch(`${msgId}`, {
                method: "DELETE",
            });
        }

        async getFollowup(msgId: string) {
            const res = await this.fetch(`${msgId}`);
            return await res.json() as Discord.Message;
        }
    };

    // Bot API

    static Bot = class Bot {
        constructor(private token: string) {
            this.token = token;
        }

        private async fetch(endpoint: string, options?: RequestInit) {
            const res = await fetch(
                `${DiscordApplication.BASE_URL}/${endpoint}/`,
                {
                    ...options,
                    headers: {
                        "Authorization": "Bot " + this.token,
                        "Content-Type": "application/json",
                    },
                },
            );
            if (!res.ok) throw new Error(res.statusText);
            return res;
        }

        async sendMessage(
            channelId: string,
            msg: string | Discord.MessageInit,
        ) {
            const data = typeof msg === "string" ? { content: msg } : msg;
            const res = await this.fetch(`channels/${channelId}/messages/`, {
                method: "POST",
                body: JSON.stringify({ data }),
            });
            return await res.json() as Discord.Message;
        }

        async createDM(userId: string) {
            const res = await this.fetch(`users/${userId}/channels`, {
                method: "POST",
            });
            return await res.json() as Discord.Channel;
        }

        async addRole(userId: string, guildId: string, roleId: string) {
            const res = await this.fetch(
                `guilds/${guildId}/members/${userId}/roles/${roleId}`,
                {
                    method: "PUT",
                },
            );
            return await res.json() as Discord.Role;
        }

        async removeRole(userId: string, guildId: string, roleId: string) {
            await this.fetch(
                `guilds/${guildId}/members/${userId}/roles/${roleId}`,
                {
                    method: "DELETE",
                },
            );
        }

        async getGuildMember(guildId: string, userId: string) {
            const res = await this.fetch(`guilds/${guildId}/members/${userId}`);
            return await res.json() as Discord.GuildMember;
        }
    };
}
