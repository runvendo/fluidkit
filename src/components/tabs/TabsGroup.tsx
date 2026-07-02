/**
 * Shared tab state for a bar + its panels.
 *
 * Wrap a `<LiquidTabs>` and its `<LiquidTabs.Panel>`s in a `<LiquidTabs.Group>`
 * to link them: the group owns the selected value (controlled via `value` +
 * `onChange`, or uncontrolled via `defaultValue`) and a `namespace` used to
 * generate matching `id`s for aria-controls / aria-labelledby wiring.
 *
 * The bar also works standalone (no group); it then owns its own value. See
 * LiquidTabs.
 */

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";

export interface TabsContextValue {
  value: string;
  setValue: (id: string) => void;
  /** Stable id prefix for tab/panel element ids. */
  namespace: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function useTabsContext(): TabsContextValue | null {
  return useContext(TabsContext);
}

export interface TabsGroupProps {
  /** Controlled selected id. */
  value?: string;
  /** Uncontrolled initial selected id. */
  defaultValue?: string;
  onChange?: (id: string) => void;
  children: ReactNode;
}

export function TabsGroup({
  value,
  defaultValue,
  onChange,
  children,
}: TabsGroupProps) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const namespace = useId();

  const setValue = useCallback(
    (id: string) => {
      if (!isControlled) setInternal(id);
      onChange?.(id);
    },
    [isControlled, onChange]
  );

  return (
    <TabsContext.Provider value={{ value: current, setValue, namespace }}>
      {children}
    </TabsContext.Provider>
  );
}
