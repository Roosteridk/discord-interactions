import { InteractionContext } from "./interaction.ts";

/**
 * Singleton class that stores interactions in a map
 * TODO: use web cache api instead
 */
export default class InteractionCache {
  private static instance: Map<string, InteractionContext>;

  public static getInstance() {
    if (!InteractionCache.instance) {
      InteractionCache.instance = new Map();
    }
    return InteractionCache.instance;
  }

  /**
   * Set an interaction in the cache
   * @param token The interaction token
   * @param value The interaction
   */
  public set(token: string, value: InteractionContext) {
    InteractionCache.instance.set(token, value);
    // Expire the interaction after 15 minutes
    setTimeout(() => {
      InteractionCache.instance.delete(token);
    }, 15 * 60 * 1000);
  }

  public get(token: string) {
    const interaction = InteractionCache.instance.get(token);
    // Fetch the interaciton from discord if it's not in the cache
    if (!interaction) {
      // ...
    }
  }
}
