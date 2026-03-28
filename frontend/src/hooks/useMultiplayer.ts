/* ──────────────────────────────────────────────────────────────────────
 *  useMultiplayer — React hook for real-time multiplayer sync
 *  Wraps SessionChannels for position, sanity, chat, and task state sync
 * ────────────────────────────────────────────────────────────────────── */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { SessionChannels, type PositionPayload, type SanityPayload, type TaskStateChange, type PlayerEscapeChange } from '@/lib/supabase/channels';
import type { RemotePlayer, ChatMessage } from '@/types/game';

interface UseMultiplayerOptions {
  sessionId: string;
  wallet: string;
  covenId: number;
  enabled?: boolean;
}

export interface MultiplayerState {
  /** Map of remote players by wallet address */
  remotePlayers: Map<string, RemotePlayer>;
  /** Chat messages received */
  chatMessages: ChatMessage[];
  /** Number of currently online players */
  onlineCount: number;
  /** List of wallets that have escaped */
  escapedPlayers: Set<string>;
  /** Broadcast local player position — call from game loop at 10fps */
  broadcastPosition: (x: number, y: number, z: number, yaw: number, pitch: number, sanity: number) => void;
  /** Broadcast sanity changes */
  broadcastSanity: (sanity: number) => void;
  /** Send a chat message */
  sendChat: (text: string) => void;
  /** Whether the multiplayer connection is active */
  isConnected: boolean;
  /** Recent task state changes for co-op tasks */
  lastTaskChange: TaskStateChange | null;
}

export function useMultiplayer({
  sessionId,
  wallet,
  covenId,
  enabled = true,
}: UseMultiplayerOptions): MultiplayerState {
  const channelsRef = useRef<SessionChannels | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<Map<string, RemotePlayer>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [escapedPlayers, setEscapedPlayers] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [lastTaskChange, setLastTaskChange] = useState<TaskStateChange | null>(null);

  // Connect channels on mount
  useEffect(() => {
    if (!enabled || !sessionId || !wallet) return;

    const channels = new SessionChannels(sessionId, wallet, covenId, {
      onPositionUpdate: (data: PositionPayload) => {
        setRemotePlayers((prev) => {
          const next = new Map(prev);
          next.set(data.wallet, {
            walletAddress: data.wallet,
            covenId: data.covenId,
            position: { x: data.x, y: data.y },
            lastUpdate: Date.now(),
            isRival: data.covenId !== covenId,
            sanity: data.sanity,
          });
          return next;
        });
      },

      onSanityUpdate: (data: SanityPayload) => {
        setRemotePlayers((prev) => {
          const next = new Map(prev);
          const existing = next.get(data.wallet);
          if (existing) {
            next.set(data.wallet, { ...existing, sanity: data.sanity });
          }
          return next;
        });
      },

      onChatMessage: (msg: ChatMessage) => {
        setChatMessages((prev) => [...prev.slice(-49), msg]); // Keep last 50
      },

      onTaskStateChange: (data: TaskStateChange) => {
        setLastTaskChange(data);
      },

      onPlayerEscaped: (data: PlayerEscapeChange) => {
        if (data.escaped) {
          setEscapedPlayers((prev) => {
            const next = new Set(prev);
            next.add(data.walletAddress.toLowerCase());
            return next;
          });
        }
      },

      onPresenceSync: (wallets: string[]) => {
        setOnlineCount(wallets.length);
      },
    });

    channels.connect();
    channelsRef.current = channels;
    setIsConnected(true);

    return () => {
      channels.disconnect();
      channelsRef.current = null;
      setIsConnected(false);
    };
  }, [sessionId, wallet, covenId, enabled]);

  // Prune stale remote players (no update for > 5 seconds)
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setRemotePlayers((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [key, player] of next) {
          if (now - player.lastUpdate > 5000) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const broadcastPosition = useCallback(
    (x: number, y: number, z: number, yaw: number, pitch: number, sanity: number) => {
      channelsRef.current?.broadcastPosition(x, y, z, yaw, pitch, sanity);
    },
    [],
  );

  const broadcastSanity = useCallback((sanity: number) => {
    channelsRef.current?.broadcastSanity(sanity);
  }, []);

  const sendChat = useCallback((text: string) => {
    channelsRef.current?.sendChat(text);
  }, []);

  return {
    remotePlayers,
    chatMessages,
    onlineCount: Math.max(onlineCount, isConnected ? 1 : 0),
    escapedPlayers,
    broadcastPosition,
    broadcastSanity,
    sendChat,
    isConnected,
    lastTaskChange,
  };
}
