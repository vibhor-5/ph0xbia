/**
 * PH0xBIA — Supabase Realtime Channels
 *
 * Manages all realtime communication:
 * - Presence: online/offline tracking per session
 * - Positions: player position broadcast (10fps, >4px delta compression)
 * - Chat: séance chat for co-op mode
 * - Sanity: sanity change broadcast for teammate display
 * - Task State: postgres changes listener for co-op task resolution
 */

import { createClient, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Address, RemotePhantom, ChatMessage } from "../../types/game";

// ────── Client Setup ──────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// ────── Position Delta Compression ──────

const POSITION_DELTA_THRESHOLD = 4; // px — only broadcast if moved > 4px

export interface PositionTracker {
  update: (x: number, y: number) => void;
  destroy: () => void;
}

export function createPositionTracker(
  broadcastFn: (pos: { x: number; y: number }) => void
): PositionTracker {
  let lastX: number | null = null;
  let lastY: number | null = null;

  function update(x: number, y: number) {
    if (lastX === null || lastY === null) {
      lastX = x;
      lastY = y;
      return; // first position — don't broadcast, just store
    }

    const dx = x - lastX;
    const dy = y - lastY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > POSITION_DELTA_THRESHOLD) {
      lastX = x;
      lastY = y;
      broadcastFn({ x, y });
    }
  }

  return { update, destroy: () => {} };
}

// ────── Channel Manager ──────

export class ChannelManager {
  private sessionId: number;
  private walletAddress: Address;
  private presenceChannel: RealtimeChannel | null = null;
  private positionChannel: RealtimeChannel | null = null;
  private chatChannel: RealtimeChannel | null = null;
  private sanityChannel: RealtimeChannel | null = null;
  private taskStateChannel: RealtimeChannel | null = null;
  private playerChannel: RealtimeChannel | null = null;
  private positionTracker: PositionTracker | null = null;
  private positionInterval: NodeJS.Timeout | null = null;

  constructor(sessionId: number, walletAddress: Address) {
    this.sessionId = sessionId;
    this.walletAddress = walletAddress;
  }

  // ── Presence ──

  subscribePresence(
    onSync: (players: { address: string; online_at: string }[]) => void
  ): void {
    this.presenceChannel = supabase.channel(`session:${this.sessionId}`);
    this.presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = this.presenceChannel!.presenceState();
        const players = Object.values(state).flat().map((p: any) => ({
          address: p.address,
          online_at: p.online_at,
        }));
        onSync(players);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this.presenceChannel!.track({
            address: this.walletAddress,
            online_at: new Date().toISOString(),
          });
        }
      });
  }

  // ── Positions ──

  subscribePositions(
    onPosition: (phantom: RemotePhantom) => void
  ): void {
    this.positionChannel = supabase.channel(`positions:${this.sessionId}`);
    this.positionChannel
      .on("broadcast", { event: "position" }, ({ payload }) => {
        if (payload.address !== this.walletAddress) {
          onPosition(payload as RemotePhantom);
        }
      })
      .subscribe();

    // Set up delta-compressed position tracker
    this.positionTracker = createPositionTracker((pos) => {
      this.positionChannel?.send({
        type: "broadcast",
        event: "position",
        payload: {
          address: this.walletAddress,
          x: pos.x,
          y: pos.y,
          lastUpdate: Date.now(),
        },
      });
    });
  }

  /** Call this at 10fps with the player's current position */
  updatePosition(x: number, y: number): void {
    this.positionTracker?.update(x, y);
  }

  // ── Chat (Co-op Séance) ──

  subscribeChat(onMessage: (msg: ChatMessage) => void): void {
    this.chatChannel = supabase.channel(`chat:${this.sessionId}`);
    this.chatChannel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        onMessage(payload as ChatMessage);
      })
      .subscribe();
  }

  async sendChatMessage(text: string, senderName?: string): Promise<void> {
    await this.chatChannel?.send({
      type: "broadcast",
      event: "message",
      payload: {
        id: crypto.randomUUID(),
        sender: this.walletAddress,
        senderName: senderName || `${this.walletAddress.slice(0, 6)}...${this.walletAddress.slice(-4)}`,
        text,
        timestamp: Date.now(),
        isSystem: false,
      } satisfies ChatMessage,
    });
  }

  // ── Sanity ──

  subscribeSanity(
    onSanityChange: (data: { address: Address; sanity: number; eventType: string }) => void
  ): void {
    this.sanityChannel = supabase.channel(`sanity:${this.sessionId}`);
    this.sanityChannel
      .on("broadcast", { event: "sanity_change" }, ({ payload }) => {
        if (payload.address !== this.walletAddress) {
          onSanityChange(payload);
        }
      })
      .subscribe();
  }

  async broadcastSanity(sanity: number, eventType: string): Promise<void> {
    await this.sanityChannel?.send({
      type: "broadcast",
      event: "sanity_change",
      payload: {
        address: this.walletAddress,
        sanity,
        eventType,
      },
    });
  }

  // ── Task State (Postgres Changes) ──

  subscribeTaskState(
    onTaskInsert: (record: any) => void
  ): void {
    this.taskStateChannel = supabase.channel(`task:${this.sessionId}`);
    this.taskStateChannel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_state",
          filter: `session_id=eq.${this.sessionId}`,
        },
        (payload) => onTaskInsert(payload.new)
      )
      .subscribe();
  }

  // ── Session Players (Postgres Changes — escape progress) ──

  subscribePlayerEscapes(
    onEscape: (record: any) => void
  ): void {
    this.playerChannel = supabase.channel(`players:${this.sessionId}`);
    this.playerChannel
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "session_players",
          filter: `session_id=eq.${this.sessionId}`,
        },
        (payload) => {
          if (payload.new.escaped) {
            onEscape(payload.new);
          }
        }
      )
      .subscribe();
  }

  // ── Cleanup ──

  async destroy(): Promise<void> {
    if (this.positionInterval) clearInterval(this.positionInterval);
    this.positionTracker?.destroy();
    await Promise.all([
      this.presenceChannel?.unsubscribe(),
      this.positionChannel?.unsubscribe(),
      this.chatChannel?.unsubscribe(),
      this.sanityChannel?.unsubscribe(),
      this.taskStateChannel?.unsubscribe(),
      this.playerChannel?.unsubscribe(),
    ]);
  }
}

// ────── DB Helpers ──────

export async function upsertPosition(
  sessionId: number,
  walletAddress: string,
  x: number,
  y: number
): Promise<void> {
  await supabase.from("player_positions").upsert(
    { session_id: sessionId, wallet_address: walletAddress, x, y, updated_at: new Date().toISOString() },
    { onConflict: "session_id,wallet_address" }
  );
}

export async function loadLastPosition(
  sessionId: number,
  walletAddress: string
): Promise<{ x: number; y: number }> {
  const { data } = await supabase
    .from("player_positions")
    .select("x, y")
    .eq("session_id", sessionId)
    .eq("wallet_address", walletAddress)
    .single();

  return data ? { x: data.x, y: data.y } : { x: 400, y: 300 };
}

export async function writeTaskAction(
  sessionId: number,
  covenId: number,
  taskType: string,
  action: string,
  payload?: Record<string, unknown>
): Promise<void> {
  const walletAddress = ""; // should be passed in — simplified for now
  await supabase.from("task_state").insert({
    session_id: sessionId,
    coven_id: covenId,
    task_type: taskType,
    player_addr: walletAddress,
    action,
    payload,
  });
}

export async function logSanityEvent(
  sessionId: number,
  walletAddress: string,
  eventType: string,
  sanityDelta: number,
  sanityAfter: number
): Promise<void> {
  await supabase.from("sanity_events").insert({
    session_id: sessionId,
    wallet_address: walletAddress,
    event_type: eventType,
    sanity_delta: sanityDelta,
    sanity_after: sanityAfter,
  });
}
