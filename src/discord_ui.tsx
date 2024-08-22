import type {
  ActionRow,
  Button,
  Emoji,
  Interaction,
  InteractionResponse,
  SelectMenu,
  SelectMenuOption,
} from "./types.ts";
import { murmurHash3 } from "https://deno.land/x/murmur_hash_3@1.0.0/mod.ts";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // deno-lint-ignore ban-types
      row: {};
      button: {
        fun: InteractionHandler;
        id?: string;
        style?: string;
        disabled?: boolean;
        emoji?: Emoji;
        url?: string;
      };
      select: {
        fun: InteractionHandler;
        id?: string;
        disabled?: boolean;
        emoji?: string;
        placeholder?: string;
      };
      opt: { val: string; desc: string; default?: boolean };
    }
  }
}

export function createElement(
  type: string,
  props: Record<string, any> | null,
  ...children: any[]
) {
  if (type === Fragment) return children;
  props ??= {};
  // Generate a unique id for the component if it doesn't have one
  const id = type !== "row" && type !== "opt" && !("id" in props)
    ? type + "-" + murmurHash3(props.fun.toString()).toString(16)
    : (props.id || null);
  switch (type) {
    case "row":
      return {
        type: 1,
        components: children.map((c: any) => c),
      } satisfies ActionRow;
    case "button":
      return {
        type: 2,
        style: props.style,
        custom_id: id,
        disabled: props.disabled,
        emoji: props.emoji,
        url: props.url,
        label: children[0],
        exec: props.fun,
      } satisfies Component<Button>;
    case "select":
      return {
        type: 3,
        custom_id: id,
        options: children.map((c: any) => c),
        exec: props.fun,
      } satisfies Component<SelectMenu>;
    case "opt":
      return {
        value: props.val,
        label: children[0],
        description: props.desc,
        default: props.default,
      } satisfies SelectMenuOption;
  }
}
export const Fragment = {};

export type InteractionHandler = (i: Interaction) => InteractionResponse;

const test = (
  <>
    <row>
      <button fun={(i) => ({ type: 4 })}>Click me!</button>
    </row>
    <row>
      <select id="test-menu" fun={() => ({ type: 5 })}>
        <opt val="test" desc="test">Test</opt>
        <opt val="test" desc="test">Test</opt>
      </select>
    </row>
  </>
);
console.log(JSON.stringify(test, null, 2));
