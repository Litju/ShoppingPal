"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import {
  extractShortlist,
  type ChatMessageMetadata,
  type ShoppingPalMessage,
} from "@/components/chat/types";

export interface ChatController {
  chat: ReturnType<typeof useChat<ShoppingPalMessage>>;
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

const GUEST_HISTORY_KEY = "sp_guest_chat_v1";

function loadGuestHistory(): ShoppingPalMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(GUEST_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ShoppingPalMessage[]) : [];
  } catch {
    return [];
  }
}

function saveGuestHistory(messages: ShoppingPalMessage[]) {
  try {
    window.sessionStorage.setItem(
      GUEST_HISTORY_KEY,
      JSON.stringify(messages.slice(-30)),
    );
  } catch {
    /* ignore */
  }
}

function newConversationId(): string {
  return crypto.randomUUID();
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = React.useState(false);
  const pageContextRef = React.useRef<ChatMessageMetadata["pageContext"]>(undefined);
  const conversationIdRef = React.useRef(newConversationId());

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ conversationId: conversationIdRef.current }),
      }),
    [],
  );

  const chat = useChat<ShoppingPalMessage>({
    transport,
    messages: loadGuestHistory(),
  });

  // Persist guest history (session-scoped).
  React.useEffect(() => {
    if (chat.status === "ready" && chat.messages.length > 0) {
      saveGuestHistory(chat.messages);
    }
  }, [chat.messages, chat.status]);

  const shortlist = React.useMemo(
    () => extractShortlist(chat.messages),
    [chat.messages],
  );

  const send = React.useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chat.status === "submitted" || chat.status === "streaming") {
        return;
      }
      void chat.sendMessage({
        text: trimmed,
        metadata: {
          pageContext: pageContextRef.current,
          shortlist,
        },
      });
      setOpen(true);
    },
    [chat, shortlist],
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
      toggle: () => setOpen((v) => !v),
      send,
      setPageContext,
    }),
    [chat, isOpen, send, setPageContext],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
