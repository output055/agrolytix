import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatService } from './chat.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';
import { ChatMessage } from '../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatNotifierService {
  private chat = inject(ChatService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  private sub: Subscription | null = null;
  private isStarted = false;

  async start() {
    if (this.isStarted) return;
    const user = this.auth.currentUser();
    if (!user || user.role === 'SuperAdmin') return;

    try {
      await this.chat.getClient();
      await this.chat.loadBusinesses();
      await this.chat.refreshUnreadCounts();

      // Listen to the unified Realtime message stream from ChatService
      this.sub = this.chat.message$.subscribe((msg) => {
        this.handleIncomingMessage(msg);
      });

      this.isStarted = true;
    } catch (e) {
      console.warn('Could not start chat notifier:', e);
    }
  }

  stop() {
    if (this.sub) {
      this.sub.unsubscribe();
      this.sub = null;
    }
    this.isStarted = false;
  }

  private handleIncomingMessage(msg: ChatMessage) {
    if (!msg || !msg.room) return;

    const prof = this.chat.profile();
    if (!prof) return;

    // 1. Refresh unread badge
    this.chat.refreshUnreadCounts();

    // 2. Do NOT trigger a notification for own messages
    if (msg.sender_user_id != null && Number(msg.sender_user_id) === Number(prof.userId)) {
      return;
    }

    // 3. Do NOT trigger toast notifications for 'recon_status' (per user specification: in chat only)
    if (msg.kind === 'recon_status') return;

    // 4. Alert for 'recon_result' (only for submitter/branch members or HQ admins)
    if (msg.kind === 'recon_result') {
      const meta = msg.meta || {};
      const isTargetBranch = Number(meta.business_id) === Number(prof.businessId);
      const isHqAdmin = prof.isHqAdmin;

      if (isTargetBranch || isHqAdmin) {
        const branchName = meta.business_name || 'Branch';
        const status = meta.status;
        const diff = Math.abs(Number(meta.difference) || 0).toLocaleString('en-GH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

        if (status === 'balanced') {
          this.toast.success(`✅ Cash Balanced: ${branchName}'s daily cash matches electronic records.`);
        } else if (status === 'short') {
          this.toast.error(`🔴 Cash Alert: ${branchName} is short by GH₵${diff}. Discrepancy logged.`);
        } else if (status === 'over') {
          this.toast.warning(`🟠 Cash Alert: ${branchName} reported a surplus of GH₵${diff}.`);
        }
      }
      return;
    }

    // 5. For DMs, notify the recipient if relevant
    if (typeof msg.room === 'string' && msg.room.startsWith('dm:')) {
      const parts = msg.room.split(':');
      const b1 = Number(parts[1]);
      const b2 = Number(parts[2]);
      const myBizId = Number(prof.businessId);
      if (myBizId === b1 || myBizId === b2) {
        const sender = msg.sender_business_name || msg.sender_name;
        this.toast.info(`💬 Message from ${sender}: "${(msg.body || 'sent an attachment').slice(0, 45)}"`);
      }
    }
  }
}
