import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChatService } from './chat.service';
import { AuthService } from './auth.service';
import { InventoryService } from './inventory.service';
import { Product, WholesaleProduct, PaginatedResponse } from '../models/inventory.model';
import {
  StocktakeSession,
  StocktakeItem,
  InventoryType,
  StocktakeSummaryStats,
  DiscrepancyReason,
  OffsetStatus,
  UnitBreakdown,
} from '../models/stocktake.model';

@Injectable({
  providedIn: 'root',
})
export class StocktakeService {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private inventoryService = inject(InventoryService);

  /**
   * Fetch all sessions for current branch, optionally filtered by type.
   */
  async getSessions(type?: InventoryType): Promise<StocktakeSession[]> {
    const client = await this.chatService.getClient();
    let query = client
      .from('stocktake_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('inventory_type', type);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch stocktake sessions:', error);
      throw new Error(error.message || 'Failed to fetch stocktake history');
    }
    return (data as StocktakeSession[]) || [];
  }

  /**
   * Find an active in-progress draft session for the given inventory type.
   */
  async getActiveSession(type: InventoryType): Promise<{ session: StocktakeSession; items: StocktakeItem[] } | null> {
    const client = await this.chatService.getClient();
    const user = this.authService.currentUser();
    const bizId = Number(user?.business?.id || user?.business_id || this.chatService.profile()?.businessId);

    const { data: sessions, error } = await client
      .from('stocktake_sessions')
      .select('*')
      .eq('inventory_type', type)
      .eq('status', 'draft')
      .eq('business_id', bizId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Failed to get active draft session:', error);
      return null;
    }

    if (!sessions || sessions.length === 0) {
      return null;
    }

    const session = sessions[0] as StocktakeSession;
    const items = await this.getSessionItems(session.id);
    return { session, items };
  }

  /**
   * Load a session with all its items by ID.
   */
  async getSession(id: string): Promise<{ session: StocktakeSession; items: StocktakeItem[] }> {
    const client = await this.chatService.getClient();
    const { data, error } = await client
      .from('stocktake_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Stocktake session not found');
    }

    const session = data as StocktakeSession;
    const items = await this.getSessionItems(session.id);
    return { session, items };
  }

  /**
   * Load items for a session.
   */
  async getSessionItems(sessionId: string): Promise<StocktakeItem[]> {
    const client = await this.chatService.getClient();
    const { data, error } = await client
      .from('stocktake_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to get items for session', sessionId, error);
      return [];
    }
    return (data as StocktakeItem[]) || [];
  }

  /**
   * Start a new Stocktake Session by snapshotting all active products.
   */
  async createSession(type: InventoryType, customTitle?: string): Promise<{ session: StocktakeSession; items: StocktakeItem[] }> {
    const client = await this.chatService.getClient();
    const prof = this.chatService.profile();
    const user = this.authService.currentUser();

    const orgId = prof?.orgId || user?.business?.parent_id || user?.business?.id || 1;
    const businessId = prof?.businessId || user?.business?.id || user?.business_id;
    const businessName = prof?.businessName || user?.business?.name || 'Shop';
    const userName = prof?.name || user?.name || 'Admin';
    const userId = prof?.userId || user?.id;

    if (!businessId) {
      throw new Error('Unable to determine current business branch for stocktake.');
    }

    // 1. Fetch current live products snapshot
    let liveProducts: (Product | WholesaleProduct)[] = [];
    if (type === 'retail') {
      const res: any = await firstValueFrom(this.inventoryService.getRetailProducts({ paginate: 0, per_page: 9999 }));
      liveProducts = Array.isArray(res) ? res : (res?.data || []);
    } else {
      const res: any = await firstValueFrom(this.inventoryService.getWholesaleProducts({ paginate: 0, per_page: 9999 }));
      liveProducts = Array.isArray(res) ? res : (res?.data || []);
    }

    if (liveProducts.length === 0) {
      throw new Error(`No ${type} products found in inventory to audit.`);
    }

    const dateStr = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date());
    const title = customTitle?.trim() || `${dateStr} ${type === 'retail' ? 'Retail' : 'Wholesale'} Stocktake`;

    // 2. Insert master session
    const sessionPayload: Partial<StocktakeSession> = {
      org_id: orgId,
      business_id: businessId,
      business_name: businessName,
      inventory_type: type,
      status: 'draft',
      title,
      counted_by_id: userId,
      counted_by_name: userName,
      total_products: liveProducts.length,
      counted_products: 0,
      balanced_count: 0,
      shortage_count: 0,
      overage_count: 0,
      total_cost_variance: 0,
      total_sell_variance: 0,
      gross_shortage_value: 0,
      gross_overage_value: 0,
      offset_amount: 0,
      deduction_amount: 0,
      started_at: new Date().toISOString(),
    };

    const { data: newSession, error: sessErr } = await client
      .from('stocktake_sessions')
      .insert(sessionPayload)
      .select('*')
      .single();

    if (sessErr || !newSession) {
      throw new Error(sessErr?.message || 'Failed to initialize stocktake session');
    }

    const session = newSession as StocktakeSession;

    // 3. Batch insert snapshot items
    const itemsPayload = liveProducts.map((p) => ({
      session_id: session.id,
      product_id: p.id,
      product_name: p.name,
      category: p.category || 'General',
      base_unit: p.base_unit || 'unit',
      cost_price: Number(p.cost_price || 0),
      sell_price: Number(p.sell_price || 0),
      system_quantity: Number(p.quantity || 0),
      physical_quantity: null,
      variance: 0,
      cost_variance: 0,
      sell_variance: 0,
      status: 'uncounted',
      offset_status: 'none',
    }));

    const batchSize = 100;
    for (let i = 0; i < itemsPayload.length; i += batchSize) {
      const chunk = itemsPayload.slice(i, i + batchSize);
      const { error: itemsErr } = await client.from('stocktake_items').insert(chunk);
      if (itemsErr) {
        console.error('Error inserting snapshot chunk:', itemsErr);
        throw new Error('Failed to create snapshot items');
      }
    }

    const createdItems = await this.getSessionItems(session.id);
    return { session, items: createdItems };
  }

  /**
   * Save / update a physical item count in the session.
   */
  async updateItemCount(
    item: StocktakeItem,
    physicalQty: number | null | undefined,
    reason?: DiscrepancyReason | null,
    notes?: string | null,
    unitBreakdown?: UnitBreakdown | null,
    offsetStatus: OffsetStatus = 'none',
    offsetNotes?: string | null
  ): Promise<StocktakeItem> {
    const client = await this.chatService.getClient();

    let status: StocktakeItem['status'] = 'uncounted';
    let variance = 0;
    let costVariance = 0;
    let sellVariance = 0;

    if (physicalQty !== null && physicalQty !== undefined && !isNaN(physicalQty)) {
      variance = Number(physicalQty) - Number(item.system_quantity);
      costVariance = variance * Number(item.cost_price || 0);
      sellVariance = variance * Number(item.sell_price || 0);

      if (variance === 0) {
        status = 'balanced';
      } else if (variance < 0) {
        status = 'shortage';
      } else {
        status = 'overage';
      }
    }

    const payload: Partial<StocktakeItem> = {
      physical_quantity: physicalQty ?? null,
      variance,
      cost_variance: costVariance,
      sell_variance: sellVariance,
      status,
      discrepancy_reason: variance === 0 ? null : (reason ?? item.discrepancy_reason ?? null),
      offset_status: offsetStatus,
      offset_notes: offsetNotes ?? item.offset_notes ?? null,
      notes: notes ?? item.notes ?? null,
      unit_breakdown: unitBreakdown ?? item.unit_breakdown ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('stocktake_items')
      .update(payload)
      .eq('id', item.id)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to update item count');
    }

    return data as StocktakeItem;
  }

  /**
   * Re-aggregate and persist totals on the master session record.
   */
  async syncSessionTotals(sessionId: string, items: StocktakeItem[], overrides?: Partial<StocktakeSession>): Promise<StocktakeSession> {
    const client = await this.chatService.getClient();
    const stats = this.computeStats(items);

    const updatePayload: Partial<StocktakeSession> = {
      total_products: items.length,
      counted_products: stats.countedItems,
      balanced_count: stats.balancedItems,
      shortage_count: stats.shortageItems,
      overage_count: stats.overageItems,
      total_cost_variance: stats.netCostVariance,
      total_sell_variance: stats.netSellVariance,
      gross_shortage_value: stats.grossShortageCost,
      gross_overage_value: stats.grossOverageCost,
      offset_amount: overrides?.offset_amount !== undefined ? overrides.offset_amount : stats.offsetAmount,
      deduction_amount: overrides?.deduction_amount !== undefined ? overrides.deduction_amount : stats.netDeduction,
      ...overrides,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('stocktake_sessions')
      .update(updatePayload)
      .eq('id', sessionId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to update session totals');
    }

    return data as StocktakeSession;
  }

  /**
   * Calculate live statistics on an array of items.
   */
  computeStats(items: StocktakeItem[]): StocktakeSummaryStats {
    let countedItems = 0;
    let uncountedItems = 0;
    let balancedItems = 0;
    let shortageItems = 0;
    let overageItems = 0;
    let grossShortageCost = 0;
    let grossShortageSell = 0;
    let grossOverageCost = 0;
    let grossOverageSell = 0;
    let offsetAmount = 0;

    for (const item of items) {
      if (item.status === 'uncounted' || item.physical_quantity === null || item.physical_quantity === undefined) {
        uncountedItems++;
        continue;
      }

      countedItems++;
      if (item.variance === 0) {
        balancedItems++;
      } else if (item.variance < 0) {
        shortageItems++;
        const shortageCost = Math.abs(item.cost_variance);
        grossShortageCost += shortageCost;
        grossShortageSell += Math.abs(item.sell_variance);

        if (item.offset_status === 'offset_with_overage' || item.offset_status === 'waived') {
          offsetAmount += shortageCost;
        }
      } else {
        overageItems++;
        grossOverageCost += item.cost_variance;
        grossOverageSell += item.sell_variance;
      }
    }

    const netCostVariance = grossOverageCost - grossShortageCost;
    const netSellVariance = grossOverageSell - grossShortageSell;
    // Salary deduction is gross shortage minus approved offsets/waived items
    const netDeduction = Math.max(0, grossShortageCost - offsetAmount);

    return {
      totalItems: items.length,
      countedItems,
      uncountedItems,
      balancedItems,
      shortageItems,
      overageItems,
      grossShortageCost: Math.round(grossShortageCost * 100) / 100,
      grossShortageSell: Math.round(grossShortageSell * 100) / 100,
      grossOverageCost: Math.round(grossOverageCost * 100) / 100,
      grossOverageSell: Math.round(grossOverageSell * 100) / 100,
      netCostVariance: Math.round(netCostVariance * 100) / 100,
      netSellVariance: Math.round(netSellVariance * 100) / 100,
      offsetAmount: Math.round(offsetAmount * 100) / 100,
      netDeduction: Math.round(netDeduction * 100) / 100,
    };
  }

  /**
   * Apply reconciliation:
   * 1. Updates live inventory stock quantities in the system via InventoryService.
   * 2. Marks the session as 'completed' with final financial deduction details.
   */
  async applyReconciliation(
    session: StocktakeSession,
    items: StocktakeItem[],
    deductionData: {
      deduction_amount: number;
      offset_amount: number;
      deduction_responsible?: string;
      deduction_notes?: string;
      notes?: string;
    }
  ): Promise<StocktakeSession> {
    const client = await this.chatService.getClient();

    // 1. Reconcile items that have variance and were counted
    const itemsToAdjust = items.filter(
      (it) => it.status !== 'uncounted' && it.physical_quantity !== null && it.physical_quantity !== undefined && it.variance !== 0
    );

    // Apply adjustments product by product
    for (const item of itemsToAdjust) {
      const targetQty = Number(item.physical_quantity);
      try {
        if (session.inventory_type === 'retail') {
          // Fetch existing full product to safely preserve metadata
          const currentProd = await firstValueFrom(this.inventoryService.getRetailProduct(item.product_id));
          await firstValueFrom(
            this.inventoryService.updateRetailProduct(item.product_id, {
              ...currentProd,
              quantity: targetQty,
            })
          );
        } else {
          const currentProd = await firstValueFrom(this.inventoryService.getWholesaleProduct(item.product_id));
          await firstValueFrom(
            this.inventoryService.updateWholesaleProduct(item.product_id, {
              ...currentProd,
              quantity: targetQty,
            })
          );
        }
      } catch (err) {
        console.warn(`Failed to sync product ${item.product_name} (#${item.product_id}) during reconciliation:`, err);
        // Continue with rest to ensure maximum inventory alignment
      }
    }

    // 2. Mark master session as completed
    const stats = this.computeStats(items);
    const completedAt = new Date().toISOString();

    const { data, error } = await client
      .from('stocktake_sessions')
      .update({
        status: 'completed',
        completed_at: completedAt,
        total_products: items.length,
        counted_products: stats.countedItems,
        balanced_count: stats.balancedItems,
        shortage_count: stats.shortageItems,
        overage_count: stats.overageItems,
        total_cost_variance: stats.netCostVariance,
        total_sell_variance: stats.netSellVariance,
        gross_shortage_value: stats.grossShortageCost,
        gross_overage_value: stats.grossOverageCost,
        offset_amount: deductionData.offset_amount,
        deduction_amount: deductionData.deduction_amount,
        deduction_responsible: deductionData.deduction_responsible || null,
        deduction_notes: deductionData.deduction_notes || null,
        notes: deductionData.notes || null,
        updated_at: completedAt,
      })
      .eq('id', session.id)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to complete stocktake session');
    }

    return data as StocktakeSession;
  }

  /**
   * Cancel an in-progress session without applying changes.
   */
  async cancelSession(sessionId: string): Promise<void> {
    const client = await this.chatService.getClient();
    const { error } = await client
      .from('stocktake_sessions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) {
      throw new Error(error.message || 'Failed to cancel session');
    }
  }

  /**
   * Permanently delete a session.
   */
  async deleteSession(sessionId: string): Promise<void> {
    const client = await this.chatService.getClient();
    const { error } = await client
      .from('stocktake_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      throw new Error(error.message || 'Failed to delete session');
    }
  }
}
