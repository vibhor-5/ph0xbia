/* ──────────────────────────────────────────────────────────────────────
 *  Supabase Realtime Channels — Session multiplayer sync
 *  Manages: Presence, Position Broadcast, Sanity Broadcast,
 *           Chat Broadcast, Postgres Changes (task_state, session_players)
 * ────────────────────────────────────────────────────────────────────── */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './client';
import type {
  RemotePlayer,
  ChatMessage,
  Position,
} from '@/types/game';

// ─── Broadcast Payload Types ─────────────────────────────────────────

export interface PositionPayload {
  wallet: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  covenId: number;
  sanity: number;
}

export interface SanityPayload {
  wallet: string;
  sanity: number;
  covenId: number;
}

export interface ChatPayload {
  sender: string; // truncated wallet address
  fullAddress: string;
  text: string;
  timestamp: number;
}

export interface TaskStateChange {
  sessionId: string;
  covenId: number;
  taskType: string;
  playerAddr: string;
  action: string;
  payload: Record<string, unknown>;
}

export interface PlayerEscapeChange {
  sessionId: string;
  walletAddress: string;
  escaped: boolean;
  escapedAt: string | null;
}

// ─── Callback Types ──────────────────────────────────────────────────

export interface ChannelCallbacks {
  /** Called when a remote player's position updates */
  onPositionUpdate?: (data: PositionPayload) => void;
  /** Called when a remote player's sanity changes */
  onSanityUpdate?: (data: SanityPayload) => void;
  /** Called when a chat message is received */
  onChatMessage?: (msg: ChatMessage) => void;
  /** Called when task_state changes (puzzle solved, co-op task triggered, etc) */
  onTaskStateChange?: (data: TaskStateChange) => void;
  /** Called when a player's escape status changes in session_players */
  onPlayerEscaped?: (data: PlayerEscapeChange) => void;
  /** Called when presence state syncs (online players count changes) */
  onPresenceSync?: (onlineWallets: string[]) => void;
}

// ─── Position Delta Tracker ──────────────────────────────────────────

const POSITION_THRESHOLD = 0.1; // minimum 3D distance before broadcasting
const BROADCAST_INTERVAL_MS = 100; // 10fps

// ─── Session Channels Class ──────────────────────────────────────────

export class SessionChannels {
  private sessionId: string;
  private wallet: string;
  private covenId: number;
  private callbacks: ChannelCallbacks;

  // Channels
  private presenceChannel: RealtimeChannel | null = null;
  private positionChannel: RealtimeChannel | null = null;
  private chatChannel: RealtimeChannel | null = null;
  private sanityChannel: RealtimeChannel | null = null;
  private taskStateChannel: RealtimeChannel | null = null;
  private playersChannel: RealtimeChannel | null = null;

  // Position delta tracking
  private lastBroadcastPos = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  private lastBroadcastTime = 0;

  constructor(
    sessionId: string,
    wallet: string,
    covenId: number,
    callbacks: ChannelCallbacks = {},
  ) {
    this.sessionId = sessionId;
    this.wallet = wallet.toLowerCase();
    this.covenId = covenId;
    this.callbacks = callbacks;
  }

  /** Connect all channels for this session */
  connect(): void {
    this.connectPresence();
    this.connectPositions();
    this.connectSanity();
    this.connectChat();
    this.connectTaskState();
    this.connectPlayerEscapes();
  }

  /** Disconnect and clean up all channels */
  disconnect(): void {
    [
      this.presenceChannel,
      this.positionChannel,
      this.chatChannel,
      this.sanityChannel,
      this.taskStateChannel,
      this.playersChannel,
    ].forEach((ch) => {
      if (ch) supabase.removeChannel(ch);
    });
    this.presenceChannel = null;
    this.positionChannel = null;
    this.chatChannel = null;
    this.sanityChannel = null;
    this.taskStateChannel = null;
    this.playersChannel = null;
  }

  // ─── Presence ────────────────────────────────────────────────────

  private connectPresence(): void {
    this.presenceChannel = supabase
      .channel(`session:${this.sessionId}`, {
        config: { presence: { key: this.wallet } },
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this.presenceChannel?.presenceState() ?? {};
        const wallets = Object.keys(state);
        this.callbacks.onPresenceSync?.(wallets);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.presenceChannel?.track({
            wallet: this.wallet,
            covenId: this.covenId,
            joinedAt: Date.now(),
          });
        }
      });
  }

  // ─── Position Broadcast ──────────────────────────────────────────

  private connectPositions(): void {
    this.positionChannel = supabase
      .channel(`positions:${this.sessionId}`)
      .on('broadcast', { event: 'position' }, ({ payload }) => {
        const data = payload as PositionPayload;
        // Ignore own broadcasts
        if (data.wallet === this.wallet) return;
        this.callbacks.onPositionUpdate?.(data);
      })
      .subscribe();
  }

  /** Broadcast local player position — respects 10fps rate limit and >0.1 delta */
  broadcastPosition(
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    sanity: number,
  ): void {
    const now = Date.now();
    if (now - this.lastBroadcastTime < BROADCAST_INTERVAL_MS) return;

    const dx = x - this.lastBroadcastPos.x;
    const dy = y - this.lastBroadcastPos.y;
    const dz = z - this.lastBroadcastPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const dYaw = Math.abs(yaw - this.lastBroadcastPos.yaw);

    if (dist < POSITION_THRESHOLD && dYaw < 0.05) return;

    this.lastBroadcastPos = { x, y, z, yaw, pitch };
    this.lastBroadcastTime = now;

    this.positionChannel?.send({
      type: 'broadcast',
      event: 'position',
      payload: {
        wallet: this.wallet,
        x,
        y,
        z,
        yaw,
        pitch,
        covenId: this.covenId,
        sanity,
      } satisfies PositionPayload,
    });
  }

  // ─── Sanity Broadcast ────────────────────────────────────────────

  private connectSanity(): void {
    this.sanityChannel = supabase
      .channel(`sanity:${this.sessionId}`)
      .on('broadcast', { event: 'sanity' }, ({ payload }) => {
        const data = payload as SanityPayload;
        if (data.wallet === this.wallet) return;
        this.callbacks.onSanityUpdate?.(data);
      })
      .subscribe();
  }

  /** Broadcast sanity change */
  broadcastSanity(sanity: number): void {
    this.sanityChannel?.send({
      type: 'broadcast',
      event: 'sanity',
      payload: {
        wallet: this.wallet,
        sanity,
        covenId: this.covenId,
      } satisfies SanityPayload,
    });
  }

  // ─── Chat Broadcast ──────────────────────────────────────────────

  private connectChat(): void {
    this.chatChannel = supabase
      .channel(`chat:${this.sessionId}`)
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        const data = payload as ChatPayload;
        this.callbacks.onChatMessage?.({
          sender: data.sender,
          text: data.text,
          timestamp: data.timestamp,
        });
      })
      .subscribe();
  }

  /** Send a chat message */
  sendChat(text: string): void {
    const truncated =
      this.wallet.slice(0, 6) + '...' + this.wallet.slice(-4);
    this.chatChannel?.send({
      type: 'broadcast',
      event: 'chat',
      payload: {
        sender: truncated,
        fullAddress: this.wallet,
        text,
        timestamp: Date.now(),
      } satisfies ChatPayload,
    });
  }

  // ─── Postgres Changes: task_state ────────────────────────────────

  private connectTaskState(): void {
    this.taskStateChannel = supabase
      .channel(`task_state:${this.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_state',
          filter: `session_id=eq.${this.sessionId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          this.callbacks.onTaskStateChange?.({
            sessionId: String(row.session_id),
            covenId: Number(row.coven_id),
            taskType: String(row.task_type ?? ''),
            playerAddr: String(row.player_addr),
            action: String(row.action),
            payload: (row.payload as Record<string, unknown>) ?? {},
          });
        },
      )
      .subscribe();
  }

  // ─── Postgres Changes: session_players ───────────────────────────

  private connectPlayerEscapes(): void {
    this.playersChannel = supabase
      .channel(`players:${this.sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'session_players',
          filter: `session_id=eq.${this.sessionId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.escaped) {
            this.callbacks.onPlayerEscaped?.({
              sessionId: String(row.session_id),
              walletAddress: String(row.wallet_address),
              escaped: Boolean(row.escaped),
              escapedAt: row.escaped_at ? String(row.escaped_at) : null,
            });
          }
        },
      )
      .subscribe();
  }

  // ─── Player Position Persistence (DB upsert for reconnect) ──────

  async savePosition(x: number, y: number): Promise<void> {
    await supabase.from('player_positions').upsert(
      {
        session_id: this.sessionId,
        wallet_address: this.wallet,
        x,
        y,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,wallet_address' },
    );
  }

  async loadPosition(): Promise<Position | null> {
    const { data } = await supabase
      .from('player_positions')
      .select('x, y')
      .eq('session_id', this.sessionId)
      .eq('wallet_address', this.wallet)
      .single();
    return data ? { x: data.x, y: data.y } : null;
  }
}
