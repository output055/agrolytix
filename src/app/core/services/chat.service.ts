import { Injectable, signal, computed, inject, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { firstValueFrom, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import {
  ChatMessage,
  ChatMessageMeta,
  StockIntakeItem,
  ChatBusiness,
  CashDeclaration,
  ChatTokenProfile,
  ChatTokenResponse,
  DeclareCashPayload,
} from '../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private supabaseUrl = environment.supabaseUrl;
  private supabaseAnonKey = environment.supabaseAnonKey;
  private functionsUrl = environment.supabaseFunctionsUrl || `${environment.supabaseUrl}/functions/v1`;

  private supabase: SupabaseClient | null = null;
  private currentSupabaseJwt: string | null = null;
  private jwtExpiresAt = 0;
  private realtimeChannel: RealtimeChannel | null = null;

  // Realtime message event stream (zone-wrapped for instantaneous UI updates)
  private messageSubject = new Subject<ChatMessage>();
  readonly message$ = this.messageSubject.asObservable();

  // Signals
  profile = signal<ChatTokenProfile | null>(null);
  businesses = signal<ChatBusiness[]>([]);
  unreadCounts = signal<Record<string, number>>({});
  unreadTotal = computed(() => {
    const counts = this.unreadCounts();
    return Object.values(counts).reduce((sum, n) => sum + (n || 0), 0);
  });

  isHq = computed(() => !!this.profile()?.isHq);
  isHqAdmin = computed(() => !!this.profile()?.isHqAdmin);

  private auth = inject(AuthService);
  private ngZone = inject(NgZone);
  private lastAuthToken = '';
  private lastBizId: number | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Resets the Supabase client and profile cache (e.g. on logout or branch switch)
   */
  reset() {
    if (this.realtimeChannel && this.supabase) {
      try {
        this.supabase.removeChannel(this.realtimeChannel);
      } catch {}
    }
    this.realtimeChannel = null;
    if (this.supabase) {
      try {
        this.supabase.removeAllChannels();
      } catch {}
    }
    this.supabase = null;
    this.currentSupabaseJwt = null;
    this.jwtExpiresAt = 0;
    this.profile.set(null);
    this.unreadCounts.set({});
    this.lastAuthToken = '';
    this.lastBizId = null;
  }

  /**
   * Retrieves a Supabase client configured with a short-lived minted JWT
   */
  async getClient(): Promise<SupabaseClient> {
    const now = Math.floor(Date.now() / 1000);
    const token = localStorage.getItem('auth_token') || '';
    if (!token) {
      this.reset();
      throw new Error('Not logged into Agrolytix');
    }

    const currentBiz = this.auth.currentUser()?.business;
    const currentBizId = currentBiz?.id ?? this.auth.currentUser()?.business_id ?? null;

    // Invalidate client if auth_token changed or active business changed
    if (this.lastAuthToken && (this.lastAuthToken !== token || this.lastBizId !== currentBizId)) {
      this.reset();
    }

    // If client exists and token has at least 5 minutes remaining, reuse
    if (this.supabase && this.currentSupabaseJwt && this.jwtExpiresAt > now + 300) {
      return this.supabase;
    }

    const res = await firstValueFrom(
      this.http.post<ChatTokenResponse>(
        `${this.functionsUrl}/agx-chat/token`,
        {
          active_business_id: currentBizId,
          active_business_name: currentBiz?.name,
          active_business_parent_id: currentBiz?.parent_id,
        },
        {
          headers: {
            'apikey': this.supabaseAnonKey,
            'Authorization': `Bearer ${this.supabaseAnonKey}`,
            'x-agx-token': token,
          },
        }
      )
    );

    this.currentSupabaseJwt = res.token;
    this.jwtExpiresAt = res.expires_at;
    this.profile.set(res.profile);
    this.lastAuthToken = token;
    this.lastBizId = currentBizId;

    this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${res.token}`,
        },
      },
      realtime: {
        params: {
          apikey: this.supabaseAnonKey,
        },
      },
    });

    // CRITICAL: Authenticate Realtime WebSocket connection with the minted JWT
    await this.supabase.realtime.setAuth(res.token);

    // Initialize unified Realtime stream
    this.initRealtimeStream();

    return this.supabase;
  }

  /**
   * Load directory of branches within the same organisation
   */
  async loadBusinesses(): Promise<ChatBusiness[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from('chat_businesses')
      .select('*')
      .order('is_hq', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to load chat businesses:', error);
      return [];
    }
    const list = data as ChatBusiness[];
    this.businesses.set(list);
    return list;
  }

  /**
   * Fetch unread counts via the RPC function
   */
  async refreshUnreadCounts(): Promise<Record<string, number>> {
    try {
      const client = await this.getClient();
      const { data, error } = await client.rpc('agx_unread_counts');
      if (error) {
        console.warn('Error reading unread counts:', error);
        return {};
      }
      const map: Record<string, number> = {};
      if (Array.isArray(data)) {
        for (const row of data) {
          if (row.room) {
            map[row.room] = Number(row.unread) || 0;
          }
        }
      }
      this.unreadCounts.set(map);
      return map;
    } catch {
      return {};
    }
  }

  /**
   * Mark a room as read
   */
  async markRoomAsRead(room: string): Promise<void> {
    try {
      const client = await this.getClient();
      const user = this.profile();
      if (!user) return;

      await client
        .from('chat_reads')
        .upsert(
          {
            user_id: user.userId,
            org_id: user.orgId,
            room,
            last_read_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,room' }
        );

      // Decrement unread map locally
      this.unreadCounts.update((current) => {
        const next = { ...current };
        delete next[room];
        return next;
      });
    } catch (e) {
      console.warn('Failed to mark room as read:', e);
    }
  }

  /**
   * Load messages for a given room
   */
  async getMessages(room: string, limit = 50, beforeDate?: string): Promise<ChatMessage[]> {
    const client = await this.getClient();
    let query = client
      .from('chat_messages')
      .select('*')
      .eq('room', room)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (beforeDate) {
      query = query.lt('created_at', beforeDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch messages for room', room, error);
      return [];
    }

    // Return in chronological order
    return ((data as ChatMessage[]) || []).reverse();
  }

  /**
   * Send a text message or image message, optionally replying to another message
   */
  async sendMessage(
    room: string,
    body?: string,
    imageUrl?: string,
    replyTo?: { id: string; sender: string; body: string }
  ): Promise<ChatMessage> {
    const client = await this.getClient();
    const prof = this.profile();
    if (!prof) throw new Error('Not connected');

    const kind = imageUrl ? 'image' : 'text';
    const payload: any = {
      room,
      kind,
      body: body?.trim() || null,
      image_url: imageUrl || null,
      // Sender identity is automatically stamped by DB trigger for security,
      // but providing sender_name helps the UI immediately.
      sender_name: prof.name,
    };

    if (replyTo) {
      payload.meta = {
        reply_to_id: replyTo.id,
        reply_to_sender: replyTo.sender,
        reply_to_body: replyTo.body.slice(0, 150),
      };
    }

    const { data, error } = await client
      .from('chat_messages')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to send message');
    }
    return data as ChatMessage;
  }

  /**
   * Submit a multi-item stock arrival / delivery report into the chat room.
   */
  async submitStockIntake(
    room: string,
    payload: {
      supplier_name?: string;
      waybill_number?: string;
      note?: string;
      imageUrl?: string | null;
      items: StockIntakeItem[];
    }
  ): Promise<ChatMessage> {
    const client = await this.getClient();
    const prof = this.profile();
    if (!prof) throw new Error('Not connected');
    if (!payload.items || payload.items.length === 0) {
      throw new Error('At least one item is required in the delivery report');
    }

    const totalQty = payload.items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    const summaryList = payload.items.slice(0, 3).map((it) => `${it.name} (+${it.quantity})`).join(', ');
    const moreCount = payload.items.length > 3 ? ` and ${payload.items.length - 3} more` : '';
    const body = `📦 Delivery Received: ${payload.items.length} item(s) (${summaryList}${moreCount})`;

    const meta: ChatMessageMeta = {
      status: 'pending',
      supplier_name: payload.supplier_name?.trim() || undefined,
      waybill_number: payload.waybill_number?.trim() || undefined,
      note: payload.note?.trim() || undefined,
      items: payload.items,
      total_items_count: payload.items.length,
      total_quantity: totalQty,
      business_id: prof.businessId,
      business_name: prof.businessName,
      submitted_by: prof.name,
      submitted_by_id: prof.userId,
    };

    const { data, error } = await client
      .from('chat_messages')
      .insert({
        room,
        kind: 'stock_intake',
        body,
        image_url: payload.imageUrl || null,
        meta,
        sender_name: prof.name,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to submit stock intake report');
    }
    return data as ChatMessage;
  }

  /**
   * Update the status of a stock intake card (e.g. approved or rejected by admin)
   */
  async updateStockIntakeStatus(
    messageId: string,
    status: 'approved' | 'rejected',
    extraMeta: Partial<ChatMessageMeta>
  ): Promise<ChatMessage> {
    const client = await this.getClient();
    const { data: existing, error: fetchErr } = await client
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchErr || !existing) throw new Error('Stock intake message not found');

    const mergedMeta: ChatMessageMeta = {
      ...(existing.meta || {}),
      ...extraMeta,
      status,
    };

    const { data, error } = await client
      .from('chat_messages')
      .update({ meta: mergedMeta })
      .eq('id', messageId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to update stock intake status');
    }
    return data as ChatMessage;
  }

  /**
   * Submit daily cash declaration to Edge Function (which performs automatic reconciliation)
   */
  async declareCash(payload: DeclareCashPayload): Promise<any> {
    const token = localStorage.getItem('auth_token') || '';
    if (!token) throw new Error('Not logged into Agrolytix');

    const currentBiz = this.auth.currentUser()?.business;
    const body = {
      ...payload,
      active_business_id: currentBiz?.id ?? this.auth.currentUser()?.business_id,
      active_business_name: currentBiz?.name,
      active_business_parent_id: currentBiz?.parent_id,
    };

    return firstValueFrom(
      this.http.post(
        `${this.functionsUrl}/agx-chat/declare-cash`,
        body,
        {
          headers: {
            'apikey': this.supabaseAnonKey,
            'Authorization': `Bearer ${this.supabaseAnonKey}`,
            'x-agx-token': token,
          },
        }
      )
    );
  }

  /**
   * Load cash declarations for today (for reconciliation list & HQ overview)
   */
  async getTodayDeclarations(): Promise<CashDeclaration[]> {
    try {
      const client = await this.getClient();
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Accra',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      const { data, error } = await client
        .from('cash_declarations')
        .select('*')
        .eq('business_date', today)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as CashDeclaration[];
      }

      // Fallback for workers: read active recon status from chat_messages (kind = 'recon_result')
      const { data: msgs } = await client
        .from('chat_messages')
        .select('sender_business_id, meta, created_at, is_deleted')
        .eq('kind', 'recon_result')
        .eq('is_deleted', false)
        .gte('created_at', `${today}T00:00:00Z`);

      if (msgs && msgs.length > 0) {
        return msgs.map((m: any) => ({
          id: m.meta?.declaration_id || '',
          org_id: 0,
          business_id: Number(m.meta?.business_id || m.sender_business_id),
          business_name: m.meta?.business_name,
          user_id: Number(m.meta?.submitted_by_id || 0),
          user_name: m.meta?.submitted_by,
          business_date: m.meta?.business_date || today,
          declared: Number(m.meta?.declared || 0),
          expected: 0,
          retail_revenue: 0,
          wholesale_collected: 0,
          expenses: 0,
          difference: Number(m.meta?.difference || 0),
          tolerance: Number(m.meta?.tolerance || 1),
          status: m.meta?.status || 'balanced',
          attempt: Number(m.meta?.attempt || 1),
          source: m.meta?.source || 'sales',
          note: null,
          image_url: null,
          created_at: m.created_at,
        })) as CashDeclaration[];
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Delete a cash declaration (Admin only).
   * Removes from cash_declarations table and marks associated chat_messages with a watermark.
   */
  async deleteCashDeclaration(declarationId: string, messageId: string): Promise<void> {
    const client = await this.getClient();
    const userName = this.auth.currentUser()?.name || this.profile()?.name || 'Admin';

    // 1. Try calling the database RPC
    const { error: rpcErr } = await client.rpc('agx_delete_cash_declaration', {
      p_declaration_id: declarationId,
    });

    if (rpcErr) {
      console.warn('RPC delete failed, performing direct delete:', rpcErr);
      // 2. Direct fallback
      await client
        .from('cash_declarations')
        .delete()
        .eq('id', declarationId);

      await client
        .from('chat_messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by_name: userName,
          body: `[Cash declaration deleted by ${userName}]`,
        })
        .or(`id.eq.${messageId},meta->>declaration_id.eq.${declarationId}`);
    }
  }

  /**
   * Check if cash has already been declared for a given date and business.
   */
  async checkIsDateDeclared(date: string, businessId?: number): Promise<boolean> {
    try {
      const client = await this.getClient();
      const user = this.auth.currentUser();
      const bId = Number(businessId || user?.business?.id || user?.business_id || this.profile()?.businessId);
      if (!bId) return false;

      // 1. Try checking via RPC function
      const { data: rpcResult, error: rpcErr } = await client.rpc('agx_is_cash_declared', {
        p_business_id: bId,
        p_date: date,
      });

      if (!rpcErr && typeof rpcResult === 'boolean') {
        return rpcResult;
      }

      // 2. Check directly in chat_messages for the recon room (accessible to all roles including workers)
      const room = this.getReconRoomKey(bId);
      const { data: msgs, error: msgErr } = await client
        .from('chat_messages')
        .select('id, meta, created_at')
        .eq('room', room)
        .eq('kind', 'cash_declaration')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!msgErr && Array.isArray(msgs) && msgs.length > 0) {
        const found = msgs.some((m) => {
          const mDate = m.meta?.business_date || (m.created_at ? m.created_at.split('T')[0] : '');
          return mDate === date;
        });
        if (found) return true;
      }

      // 3. Fallback to cash_declarations table
      const { data, error } = await client
        .from('cash_declarations')
        .select('id')
        .eq('business_id', bId)
        .eq('business_date', date)
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Edit an existing message (allowed within first 5 minutes)
   */
  async editMessage(messageId: string, newBody: string): Promise<ChatMessage> {
    const client = await this.getClient();
    const { data, error } = await client
      .from('chat_messages')
      .update({
        body: newBody.trim(),
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to edit message');
    }
    return data as ChatMessage;
  }

  /**
   * Soft-delete a message, leaving a watermark indicating who deleted it.
   * Enforces that only the original author can delete their message.
   */
  async deleteMessage(messageId: string): Promise<ChatMessage> {
    const client = await this.getClient();
    const prof = this.profile();
    const myId = prof?.userId || this.auth.currentUser()?.id;
    const userName = this.auth.currentUser()?.name || prof?.name || 'User';

    let query = client
      .from('chat_messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by_name: userName,
        body: '[This message was deleted]',
        image_url: null,
      })
      .eq('id', messageId);

    if (myId != null) {
      query = query.eq('sender_user_id', myId);
    }

    const { data, error } = await query
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to delete message: You can only delete your own messages');
    }
    return data as ChatMessage;
  }

  /**
   * Initializes the single persistent Supabase Realtime channel.
   * Dispatches messages through message$ inside Angular's NgZone so change detection
   * runs immediately without needing manual clicks/interaction.
   */
  private initRealtimeStream() {
    if (!this.supabase) return;

    if (this.realtimeChannel) {
      try {
        this.supabase.removeChannel(this.realtimeChannel);
      } catch {}
      this.realtimeChannel = null;
    }

    this.realtimeChannel = this.supabase
      .channel('agx-chat-stream')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const msg = (payload.new || payload.old) as ChatMessage;
          if (msg && msg.id) {
            this.ngZone.run(() => {
              this.messageSubject.next(msg);
            });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Agrolytix Chat] Realtime connected and listening for live messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Agrolytix Chat] Realtime channel error:', err);
        }
      });
  }

  /**
   * Subscribe to real-time messages for a room (thin wrapper over unified message$)
   */
  subscribeToRoom(room: string, onMessage: (msg: ChatMessage) => void): { unsubscribe: () => void } {
    const sub = this.message$.subscribe((msg) => {
      if (msg && msg.room === room) {
        onMessage(msg);
      }
    });

    return {
      unsubscribe: () => sub.unsubscribe(),
    };
  }

  /**
   * Helper to construct canonical DM room string: dm:<lower_id>:<higher_id>
   * Uses auth.currentUser branch ID so both users always compute the exact same room key.
   */
  getDmRoomKey(otherBusinessId: number): string {
    const user = this.auth.currentUser();
    const myId = user?.business?.id || user?.business_id || this.profile()?.businessId || 0;
    const numMyId = Number(myId);
    const numOther = Number(otherBusinessId);
    const a = Math.min(numMyId, numOther);
    const b = Math.max(numMyId, numOther);
    return `dm:${a}:${b}`;
  }

  /**
   * Helper to construct recon room for a branch
   */
  getReconRoomKey(businessId?: number): string {
    const user = this.auth.currentUser();
    const id = businessId || user?.business?.id || user?.business_id || this.profile()?.businessId || 0;
    return `recon:${id}`;
  }
}
