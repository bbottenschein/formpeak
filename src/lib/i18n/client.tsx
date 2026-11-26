"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, messagesFor, type Messages, type Translate } from "./translate";

const MessagesContext = createContext<Messages>(messagesFor(null));

export function I18nProvider({ messages, children }: { messages: Messages; children: ReactNode }) {
  return <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>;
}

/** Übersetzer für Client Components. */
export function useT(): Translate {
  const messages = useContext(MessagesContext);
  return useMemo(() => createTranslator(messages), [messages]);
}
