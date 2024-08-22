import {
  ApplicationCommandData,
  ApplicationCommandInit,
  ApplicationCommandOption,
  Interaction,
  InteractionType,
  MessageComponentData,
} from "./types.ts";
import DiscordApp from "https://raw.githubusercontent.com/Roosteridk/not-a-discord-bot/master/mod.ts";
import { InteractionContext } from "./interaction.ts";
import { murmurHash3 } from "https://deno.land/x/murmur_hash_3@1.0.0/mod.ts";

type Middleware = (
  ctx: InteractionContext<InteractionType>,
) =>
  | AsyncGenerator<
    InteractionContext<InteractionType>,
    void,
    InteractionContext<InteractionType>
  >
  | Generator<
    InteractionContext<InteractionType>,
    void,
    InteractionContext<InteractionType>
  >;

type Options = { applicationId: string; publicKey: string; botToken: string };

export class App extends DiscordApp {
  middleware: Array<Middleware> = [];
  handlers: Record<string, (ctx: InteractionContext<number>) => void> = {};

  constructor({ applicationId, publicKey, botToken }: Options) {
    super(applicationId, publicKey);
    super.createBot(botToken);
    // Load all the handlers
    for (const file of Deno.readDirSync("./commands")) {
      import(`./commands/${file.name}`).then((module) => {
        const command = module.default as Command;
        // Find component handlers which have the name `$custom_id` or `_any` for auto generated ids
        for (const [name, handler] of module) {
          if (name.startsWith("$")) {
            const id = name.slice(1);
            this.handlers[id] = handler;
          } else if (name.startsWith("_")) {
            const id = murmurHash3(handler.toString());
            this.handlers[id] = handler;
          }
        }
        // Set the handler for the command
        this.handlers[command.name] = command.handler;
      });
    }
  }

  async interactionHandler(i: Interaction) {
    const ctx = new InteractionContext(i);
    // Run the middleware
    for await (const next of this.middleware) {
      next(ctx);
    }
    // Route the interaction to the correct handler
    switch (i.type) {
      case InteractionType.APPLICATION_COMMAND:
        this.handlers[(i.data as ApplicationCommandData).name](ctx);
        break;
      case InteractionType.MESSAGE_COMPONENT:
        this.handlers[(i.data as MessageComponentData).custom_id](ctx);
        break;
    }

    return ctx.interactionResponse;
  }

  use(...middleware: Middleware[]) {
    this.middleware.push(...middleware);
  }
}

export class Command implements ApplicationCommandInit {
  name: string;
  description: string;
  options?: ApplicationCommandOption[];
  default_permission?: boolean;

  constructor(
    { name, description, options, default_permission }: ApplicationCommandInit,
    public handler: (
      ctx: InteractionContext<InteractionType.APPLICATION_COMMAND>,
    ) => void,
  ) {
    this.name = name;
    this.description = description;
    this.options = options;
    this.default_permission = default_permission;
  }
}
