"use client";

import * as React from "react";
import { useEveAgent } from "eve/react";

import type { ChatMessageMetadata, ShoppingPalMessage } from "@/components/chat/types";
import { extractShortlist } from "@/components/chat/types";

type ChatSession = {
  messages: readonly ShoppingPalMessage[];
  status: "error" | "ready" | "streaming" | "submitted";
  error?: Error;
  clearError: () => void;
  stop: () => Promise<void>;
  reset: () => void;
};

export interface ChatController {
  chat: ChatSession;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  send: (text: string) => void;
  setPageContext: (context: ChatMessageMetadata["pageContext"]) => void;
}

const ChatContext = React.createContext<ChatController | null>(null);

export function usePal(): ChatController {
  const ctx = React.useContext(ChatContext);
  if (!ctx) throw new Error("usePal must be used inside ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = React.useState(false);
  const [lastError, setLastError] = React.useState<Error>();
  const pageContextRef = React.useRef<ChatMessageMetadata["pageContext"]>(undefined);
  const eve = useEveAgent();
  const messages = eve.data.messages;
  const shortlist = React.useMemo(() => extractShortlist(messages), [messages]);

  React.useEffect(() => {
    if (eve.error) setLastError(eve.error);
  }, [eve.error]);

  const send = React.useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || eve.status === "submitted" || eve.status === "streaming") return;
      setLastError(undefined);
      void eve
        .send(trimmed, {
          clientContext: {
            pageContext: pageContextRef.current ?? null,
            shortlist,
          },
        })
        .catch(setLastError);
      setOpen(true);
    },
    [eve, shortlist],
  );

  const chat = React.useMemo<ChatSession>(
    () => ({
      messages,
      status: eve.status,
      error: lastError,
      clearError: () => setLastError(undefined),
      stop: async () => {
        await eve.cancel();
      },
      reset: () => {
        setLastError(undefined);
        eve.reset();
      },
    }),
    [eve, lastError, messages],
  );

  const setPageContext = React.useCallback(
    (context: ChatMessageMetadata["pageContext"]) => {
      pageContextRef.current = context;
    },
    [],
  );

  const value = React.useMemo<ChatController>(
    () => ({
      chat,
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((value) => !value),
      send,
      setPageContext,
    }),
    [chat, isOpen, send, setPageContext],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
