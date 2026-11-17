import type { Action } from '../state';
export const reservedBindings = new Set(['KeyC', 'KeyG', 'KeyM', 'KeyP']);
export const isBindingCode = (code: string) =>
  !reservedBindings.has(code) &&
  /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right))$/.test(
    code,
  );
const aliases: Partial<Record<Action, string>> = {
  forward: 'ArrowUp',
  reverse: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};
export function bindingDown(
  action: Action,
  keys: ReadonlySet<string>,
  bindings: Record<Action, string>,
) {
  const alias = aliases[action];
  return (
    keys.has(bindings[action]) ||
    !!(alias && keys.has(alias) && !Object.values(bindings).includes(alias))
  );
}
export function touchBinding(code: string, bindings: Record<Action, string>) {
  const actions: Record<string, Action> = {
    KeyW: 'forward',
    KeyS: 'reverse',
    KeyA: 'left',
    KeyD: 'right',
  };
  return actions[code] ? bindings[actions[code]] : code;
}
