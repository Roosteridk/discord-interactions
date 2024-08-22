import {
  Interaction,
  InteractionResponse,
  InteractionResponseData,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from "./types.ts";
import DiscordApp from "./mod.ts";
//import Cache from "./interaction_cache.ts";

// some typescript wizardry here idrk how this works tbh
export interface InteractionContext<T = InteractionType>
  extends Interaction<T> {}
export class InteractionContext<T = InteractionType> {
  // Additional properties to aid with handling interactions
  #promise: Promise<InteractionResponse>;
  #promiseResolver?: (response: InteractionResponse) => void;

  readonly timestamp = Date.now();
  // An object to store additional data in
  store: Record<string, unknown> = {};

  constructor(interaction: Interaction) {
    Object.setPrototypeOf(this, interaction);

    // Create a promise and store its resolve function in resolver
    this.#promise = new Promise((resolve) => {
      this.#promiseResolver = resolve;
    });

    // Cache the interaction
    // Cache.getInstance().set(this.token, this);
  }

  // Getter that returns the promise which will resolve with the interaction response
  get interactionResponse() {
    return this.#promise;
  }

  /**
   * Respond to the interaction with an interaction response
   * @param response The response to send to the interaction
   */
  respond(response: InteractionResponse) {
    if (!this.#promiseResolver) throw new Error("Interaction already handled");
    // Resolve the promise with the response
    this.#promiseResolver(response);
  }

  /**
   * Reply to the interaction with a message
   * @param msg The message to send
   * @param ephemeral Whether the message should be ephemeral or not - Defaults to true.
   */
  reply(msg: InteractionResponseData | string, ephemeral = true) {
    const data = typeof msg === "string" ? { content: msg } : msg;
    // Add the ephemeral flag to the message if ephemeral is true
    if (ephemeral) {
      data.flags
        ? data.flags |= MessageFlags.EPHEMERAL
        : data.flags = MessageFlags.EPHEMERAL;
    }
    this.respond({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data,
    });
  }

  /**
   * Acknowledge the interaction to edit it later. This will send a "thinking" message to the user.
   */
  defer() {
    this.respond({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    });
  }

  /**
   * Easily retrieve all components of the message in a nice array
   * @returns The components attached to the message, if any
   */
  getComponents() {
    if (!this.message?.components) return [];
    // We need the *meat* of the components, not the action rows
    return this.message.components.map((row) => row.components).flat();
  }

  edit(msg: InteractionResponseData | string) {
    const data = typeof msg === "string" ? { content: msg } : msg;
    return new DiscordApp.WrappedInteraction(this).editOriginal(data);
  }
  //followup()
}
