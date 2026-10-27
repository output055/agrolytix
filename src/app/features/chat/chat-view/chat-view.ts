import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatService } from '../../../core/services/chat.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { ImageUploadService } from '../../../core/services/image-upload.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  ChatMessage,
  ChatBusiness,
  CashDeclaration,
  ChatRoomMeta,
  StockIntakeItem,
} from '../../../core/models/chat.model';
import { Product, WholesaleProduct } from '../../../core/models/inventory.model';

@Component({
  selector: 'app-chat-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-view.html',
  styleUrls: ['./chat-view.css'],
})
export class ChatView implements OnInit, AfterViewChecked {
  chatService = inject(ChatService);
  inventoryService = inject(InventoryService);
  imageUpload = inject(ImageUploadService);
  toast = inject(ToastService);
  auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('modalFileInput') private modalFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('stockFileInput') private stockFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('stockCameraInput') private stockCameraInput?: ElementRef<HTMLInputElement>;

  loading = signal(true);
  connecting = signal(false);
  messages = signal<ChatMessage[]>([]);
  activeRoom = signal<string>('general');
  todayDeclarations = signal<CashDeclaration[]>([]);

  // Composer
  messageText = signal('');
  uploadingImage = signal(false);
  uploadProgress = signal(0);
  stagedImageUrl = signal<string | null>(null);
  replyingTo = signal<{ id: string; sender: string; body: string } | null>(null);

  // Cash declaration modal
  showDeclareModal = signal(false);
  declareAmount = signal<number | null>(null);
  declareDate = signal<string>(this.getTodayDateString());
  dateAlreadyDeclared = signal(false);
  checkingDateDeclared = signal(false);
  declareNote = signal('');
  declareImageUrl = signal<string | null>(null);
  submittingDeclaration = signal(false);
  maxDate = computed(() => this.getTodayDateString());

  // Lightbox
  lightboxUrl = signal<string | null>(null);

  // Message Edit state (allowed within 5 minutes)
  editingMessageId = signal<string | null>(null);
  editMessageText = signal('');
  savingEdit = signal(false);

  // Message Delete state (watermark tombstone)
  deletingMessageId = signal<string | null>(null);
  deletingDeclarationMsg = signal<ChatMessage | null>(null);
  deletingInProgress = signal(false);

  // Stock Arrival (Batch Intake) state
  showStockIntakeModal = signal(false);
  stockSupplierName = signal('');
  stockWaybillNumber = signal('');
  stockNote = signal('');
  stockImageUrl = signal<string | null>(null);
  stockItems = signal<StockIntakeItem[]>([]);
  submittingStockIntake = signal(false);

  // Loaded catalog products for quick selection
  retailProducts = signal<Product[]>([]);
  wholesaleProducts = signal<WholesaleProduct[]>([]);
  loadingProducts = signal(false);

  // Admin Stock Approval / Review state
  showApproveStockModal = signal(false);
  reviewingStockMsg = signal<ChatMessage | null>(null);
  adminReviewItems = signal<StockIntakeItem[]>([]);
  approvingStock = signal(false);

  // Admin Stock Rejection state
  showRejectModal = signal(false);
  rejectingStockMsg = signal<ChatMessage | null>(null);
  rejectionReason = signal('');
  rejectingStock = signal(false);

  // WhatsApp-style scroll-to-bottom state
  isScrolledUp = signal(false);
  newMessagesCount = signal(0);
  private shouldScrollBottom = false;

  // Mobile sidebar visibility toggle
  showMobileSidebar = signal(false);

  // Touch devices: which message has its action menu revealed (tap-to-show)
  activeActionsMsgId = signal<string | null>(null);

  toggleMsgActions(msgId: string, event: Event) {
    const target = event.target as HTMLElement;
    // Ignore taps on interactive children (buttons, images, inputs, quoted replies)
    if (target.closest('button, img, textarea, input, [title]')) return;
    this.activeActionsMsgId.set(this.activeActionsMsgId() === msgId ? null : msgId);
  }

  userProfile = computed(() => this.chatService.profile());
  businesses = computed(() => this.chatService.businesses());
  currentBranchName = computed(() => {
    return this.auth.currentUser()?.business?.name || this.userProfile()?.businessName || 'Connected';
  });
  isHqAdmin = computed(() => {
    const user = this.auth.currentUser();
    // A branch account has parent_id set and is never HQ Admin
    if (user?.business?.parent_id) return false;
    return this.chatService.isHqAdmin();
  });
  isAdmin = computed(() => {
    const user = this.auth.currentUser();
    const prof = this.userProfile();
    return user?.role === 'Admin' || prof?.role === 'Admin' || this.isHqAdmin();
  });

  // Room list
  rooms = computed<ChatRoomMeta[]>(() => {
    const list: ChatRoomMeta[] = [];
    const prof = this.userProfile();
    const unreads = this.chatService.unreadCounts();
    const decls = this.todayDeclarations();
    const myBizId = this.auth.currentUser()?.business?.id || prof?.businessId;
    const myBizName = (this.auth.currentUser()?.business?.name || prof?.businessName || '').trim().toLowerCase();

    // 1. General room
    list.push({
      id: 'general',
      title: 'All Branches Group',
      subtitle: 'Public organization-wide chat',
      type: 'general',
      unreadCount: unreads['general'] || 0,
    });

    // 2. Recon rooms
    if (this.isHqAdmin()) {
      // HQ Admin sees recon channels for all child branches
      const branches = this.businesses().filter((b) => !b.is_hq);
      for (const b of branches) {
        const roomKey = `recon:${b.business_id}`;
        const decl = decls.find((d) => d.business_id === b.business_id);
        list.push({
          id: roomKey,
          title: b.name,
          subtitle: 'Cash Reconciliation',
          type: 'recon',
          business_id: b.business_id,
          unreadCount: unreads[roomKey] || 0,
          status: decl ? decl.status : 'pending',
        });
      }
    } else if (prof || myBizId) {
      // Branch user sees only their branch recon channel
      const reconBizId = myBizId || prof?.businessId;
      const reconBizName = this.auth.currentUser()?.business?.name || prof?.businessName || 'Branch';
      if (reconBizId) {
        const roomKey = `recon:${reconBizId}`;
        const decl = decls.find((d) => d.business_id === reconBizId);
        list.push({
          id: roomKey,
          title: 'Cash Reconciliation',
          subtitle: reconBizName,
          type: 'recon',
          business_id: reconBizId,
          unreadCount: unreads[roomKey] || 0,
          status: decl ? decl.status : 'pending',
        });
      }
    }

    // 3. DMs (Direct messages with other branches)
    if (prof || myBizId) {
      const otherBranches = this.businesses().filter((b) => {
        if (myBizId && b.business_id === myBizId) return false;
        if (myBizName && b.name.trim().toLowerCase() === myBizName) return false;
        return true;
      });
      for (const b of otherBranches) {
        const roomKey = this.chatService.getDmRoomKey(b.business_id);
        list.push({
          id: roomKey,
          title: b.name,
          subtitle: b.is_hq ? 'Headquarters' : 'Branch DM',
          type: 'dm',
          business_id: b.business_id,
          unreadCount: unreads[roomKey] || 0,
        });
      }
    }


    return list;
  });

  activeRoomMeta = computed(() => {
    return this.rooms().find((r) => r.id === this.activeRoom()) || {
      id: this.activeRoom(),
      title: 'Chat',
      type: 'general' as const,
    };
  });

  async ngOnInit() {
    try {
      this.connecting.set(true);
      await this.chatService.getClient();
      await this.chatService.loadBusinesses();
      await this.refreshDeclarations();
      await this.chatService.refreshUnreadCounts();

      // Listen to incoming messages across the whole application
      this.chatService.message$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((newMsg) => {
          if (!newMsg || !newMsg.id) return;
          // If message belongs to active room, append or update in place!
          if (newMsg.room === this.activeRoom()) {
            const wasScrolledUp = this.isScrolledUp();
            const isMyOwn = this.isOwn(newMsg);

            this.messages.update((prev) => {
              const idx = prev.findIndex((m) => m.id === newMsg.id);
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = newMsg;
                return next;
              }
              return [...prev, newMsg];
            });

            if (wasScrolledUp && !isMyOwn) {
              // User has scrolled up to read history: show WhatsApp down-button with badge
              this.newMessagesCount.update((c) => c + 1);
            } else {
              // User is near bottom or sent it themselves: scroll smoothly
              setTimeout(() => this.scrollToBottom(true), 40);
            }

            this.cdr.markForCheck();
            this.chatService.markRoomAsRead(this.activeRoom());

            if (newMsg.kind === 'recon_result' || newMsg.kind === 'cash_declaration') {
              this.refreshDeclarations();
            }
          }
        });

      await this.selectRoom('general');
    } catch (e: any) {
      this.toast.error(e.message || 'Failed to connect to chat system');
    } finally {
      this.connecting.set(false);
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScrollBottom) {
      this.scrollToBottom();
      this.shouldScrollBottom = false;
    }
  }

  onScroll(event: Event) {
    const el = event.target as HTMLElement;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const scrolledUp = distanceToBottom > 100;
    this.isScrolledUp.set(scrolledUp);

    if (!scrolledUp) {
      this.newMessagesCount.set(0);
    }
  }

  async selectRoom(roomId: string) {
    this.activeRoom.set(roomId);
    this.messages.set([]);
    this.newMessagesCount.set(0);
    this.isScrolledUp.set(false);
    this.showMobileSidebar.set(false); // close mobile drawer on room select
    this.cdr.markForCheck();

    try {
      const msgs = await this.chatService.getMessages(roomId);
      this.messages.set(msgs);
      this.cdr.markForCheck();

      // Ensure user starts at the bottom immediately and after DOM paint
      setTimeout(() => this.scrollToBottom(false), 20);
      setTimeout(() => this.scrollToBottom(false), 80);
      setTimeout(() => this.scrollToBottom(false), 200);

      // Mark read
      await this.chatService.markRoomAsRead(roomId);
    } catch (e: any) {
      this.toast.error('Failed to load room messages');
    }
  }

  async refreshDeclarations() {
    const decls = await this.chatService.getTodayDeclarations();
    this.todayDeclarations.set(decls);
  }

  scrollToBottom(smooth = false): void {
    try {
      if (this.scrollContainer) {
        const el = this.scrollContainer.nativeElement;
        if (smooth) {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        } else {
          el.scrollTop = el.scrollHeight;
        }
      }
      this.newMessagesCount.set(0);
      this.isScrolledUp.set(false);
    } catch {}
  }

  // ─── Sending Messages ───────────────────────────────────────────────────────
  async sendMessage() {
    const text = this.messageText().trim();
    const img = this.stagedImageUrl();
    const reply = this.replyingTo();
    if (!text && !img) return;

    this.messageText.set('');
    this.stagedImageUrl.set(null);
    this.replyingTo.set(null);

    try {
      const sent = await this.chatService.sendMessage(this.activeRoom(), text, img || undefined, reply || undefined);
      if (sent) {
        this.messages.update((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev;
          return [...prev, sent];
        });
        this.cdr.markForCheck();
      }
      this.shouldScrollBottom = true;
    } catch (e: any) {
      this.toast.error(e.message || 'Could not send message');
      // Restore draft
      this.messageText.set(text);
      if (reply) this.replyingTo.set(reply);
    }
  }

  startReply(msg: ChatMessage) {
    if (!msg || msg.is_deleted) return;
    const bodyPreview = msg.body
      ? msg.body
      : msg.kind === 'image'
      ? 'Photo attachment'
      : msg.kind === 'cash_declaration'
      ? `Cash Declaration: ${this.formatCurrency(msg.meta?.declared)}`
      : msg.kind === 'stock_intake'
      ? `Delivery Intake: ${msg.meta?.items?.length || 0} items (${msg.meta?.supplier_name || 'Stock'})`
      : 'Message';

    this.replyingTo.set({
      id: msg.id,
      sender: msg.sender_name || 'User',
      body: bodyPreview.slice(0, 150),
    });

    this.cancelEdit();

    // Auto-focus input
    setTimeout(() => {
      const el = document.getElementById('chat-message-input');
      if (el) el.focus();
    }, 50);
  }

  cancelReply() {
    this.replyingTo.set(null);
  }

  scrollToMessage(messageId?: string) {
    if (!messageId) return;
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('reply-highlight');
      setTimeout(() => {
        el.classList.remove('reply-highlight');
      }, 1500);
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  triggerFileInput() {
    this.fileInput?.nativeElement.click();
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    input.value = '';

    await this.uploadImageFile(file, (url) => {
      this.stagedImageUrl.set(url);
    });
  }

  triggerModalFileInput() {
    this.modalFileInput?.nativeElement.click();
  }

  async onModalFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    input.value = '';

    await this.uploadImageFile(file, (url) => {
      this.declareImageUrl.set(url);
    });
  }

  private async uploadImageFile(file: File, onSuccess: (url: string) => void) {
    if (!file.type.startsWith('image/')) {
      this.toast.error('Please choose an image file (PNG, JPG, WEBP)');
      return;
    }

    try {
      this.uploadingImage.set(true);
      this.uploadProgress.set(10);

      const url = await this.imageUpload.uploadImage(file, (pct) => {
        this.uploadProgress.set(pct);
      });

      onSuccess(url);
      this.toast.success('Image ready');
    } catch (e: any) {
      this.toast.error(e.message || 'Failed to upload image');
    } finally {
      this.uploadingImage.set(false);
      this.uploadProgress.set(0);
    }
  }

  // ─── Cash Declaration ──────────────────────────────────────────────────────
  getTodayDateString(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Accra',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  async openDeclareModal() {
    this.declareAmount.set(null);
    const today = this.getTodayDateString();
    this.declareDate.set(today);
    this.declareNote.set('');
    this.declareImageUrl.set(null);
    this.showDeclareModal.set(true);
    await this.checkDateDeclared(today);
  }

  closeDeclareModal() {
    this.showDeclareModal.set(false);
  }

  async onDateChange(newDate: string) {
    this.declareDate.set(newDate);
    if (!newDate) {
      this.dateAlreadyDeclared.set(false);
      return;
    }
    await this.checkDateDeclared(newDate);
  }

  async checkDateDeclared(date: string) {
    this.checkingDateDeclared.set(true);
    try {
      const declared = await this.chatService.checkIsDateDeclared(date);
      this.dateAlreadyDeclared.set(declared);
    } catch {
      this.dateAlreadyDeclared.set(false);
    } finally {
      this.checkingDateDeclared.set(false);
      this.cdr.markForCheck();
    }
  }

  async submitCashDeclaration() {
    const amount = Number(this.declareAmount());
    if (isNaN(amount) || amount < 0) {
      this.toast.error('Please enter a valid cash amount');
      return;
    }

    const date = this.declareDate();
    if (!date) {
      this.toast.error('Please select a declaration date');
      return;
    }

    if (this.dateAlreadyDeclared()) {
      this.toast.error(`Cash for ${date} has already been declared. Only one declaration per date is allowed.`);
      return;
    }

    this.submittingDeclaration.set(true);
    try {
      const res = await this.chatService.declareCash({
        amount,
        business_date: date,
        note: this.declareNote().trim() || undefined,
        image_url: this.declareImageUrl() || undefined,
      });

      this.closeDeclareModal();
      this.toast.success('Cash declaration submitted!');

      // Automatically jump to the recon room so user sees the immediate bot review
      const myReconRoom = this.chatService.getReconRoomKey();
      await this.selectRoom(myReconRoom);
      await this.refreshDeclarations();
    } catch (e: any) {
      this.toast.error(e.error?.message || e.message || 'Failed to submit declaration');
    } finally {
      this.submittingDeclaration.set(false);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  isOwn(msg: ChatMessage): boolean {
    if (!msg || msg.sender_user_id == null) return false;
    const myId = this.userProfile()?.userId || this.auth.currentUser()?.id;
    if (myId == null) return false;
    return Number(msg.sender_user_id) === Number(myId);
  }

  formatTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * WhatsApp-style day separators: maps the id of the first message of each
   * calendar day to its label ("Today", "Yesterday", "Monday", "12 Oct 2026").
   */
  dayBreaks = computed(() => {
    const map = new Map<string, string>();
    let lastKey = '';
    for (const msg of this.messages()) {
      if (!msg.created_at) continue;
      const d = new Date(msg.created_at);
      const key = d.toDateString();
      if (key !== lastKey) {
        map.set(msg.id, this.dayLabel(d));
        lastKey = key;
      }
    }
    return map;
  });

  private dayLabel(d: Date): string {
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' });
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString([], sameYear
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatCurrency(val?: number | string | null): string {
    const n = Number(val) || 0;
    return 'GH₵' + n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  openLightbox(url: string) {
    this.lightboxUrl.set(url);
  }

  closeLightbox() {
    this.lightboxUrl.set(null);
  }

  // ─── Edit & Delete Message Actions ─────────────────────────────────────────

  /**
   * Users can only edit their own text messages within the first 5 minutes.
   */
  canEdit(msg: ChatMessage): boolean {
    if (!msg || msg.is_deleted) return false;
    if (msg.kind !== 'text' || !this.isOwn(msg)) return false;
    const sentTime = new Date(msg.created_at).getTime();
    if (isNaN(sentTime)) return false;
    const diffMs = Date.now() - sentTime;
    return diffMs <= 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Only the original sender can delete their own regular message.
   */
  canDelete(msg: ChatMessage): boolean {
    if (!msg || msg.is_deleted) return false;
    const isRegular = msg.kind === 'text' || msg.kind === 'image';
    if (!isRegular) return false;
    return this.isOwn(msg);
  }

  startEdit(msg: ChatMessage) {
    if (!this.canEdit(msg)) {
      this.toast.error('Messages can only be edited within the first 5 minutes of sending');
      return;
    }
    this.editingMessageId.set(msg.id);
    this.editMessageText.set(msg.body || '');
  }

  cancelEdit() {
    this.editingMessageId.set(null);
    this.editMessageText.set('');
  }

  async saveEdit() {
    const id = this.editingMessageId();
    const text = this.editMessageText().trim();
    if (!id) return;
    if (!text) {
      this.toast.error('Message text cannot be empty');
      return;
    }

    this.savingEdit.set(true);
    try {
      const updated = await this.chatService.editMessage(id, text);
      this.messages.update((prev) => {
        const idx = prev.findIndex((m) => m.id === id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return prev;
      });
      this.cancelEdit();
      this.toast.success('Message updated');
      this.cdr.markForCheck();
    } catch (e: any) {
      this.toast.error(e.message || 'Failed to edit message');
    } finally {
      this.savingEdit.set(false);
    }
  }

  confirmDelete(msg: ChatMessage) {
    if (!this.canDelete(msg)) return;
    this.deletingMessageId.set(msg.id);
  }

  cancelDelete() {
    this.deletingMessageId.set(null);
  }

  async executeDelete() {
    const id = this.deletingMessageId();
    if (!id) return;

    const target = this.messages().find((m) => m.id === id);
    if (!target || !this.canDelete(target)) {
      this.toast.error('You can only delete your own messages');
      this.cancelDelete();
      return;
    }

    this.deletingInProgress.set(true);
    try {
      const deleted = await this.chatService.deleteMessage(id);
      this.messages.update((prev) => {
        const idx = prev.findIndex((m) => m.id === id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = deleted;
          return next;
        }
        return prev;
      });
      this.cancelDelete();
      this.toast.success('Message deleted');
      this.cdr.markForCheck();
    } catch (e: any) {
      this.toast.error(e.message || 'Failed to delete message');
    } finally {
      this.deletingInProgress.set(false);
    }
  }

  // ─── Cash Declaration Deletion (Admin only) ─────────────────────────────────
  confirmDeleteDeclaration(msg: ChatMessage) {
    if (!this.isAdmin()) {
      this.toast.error('Only administrators can delete cash declarations');
      return;
    }
    this.deletingDeclarationMsg.set(msg);
  }

  cancelDeleteDeclaration() {
    this.deletingDeclarationMsg.set(null);
  }

  async executeDeleteDeclaration() {
    const msg = this.deletingDeclarationMsg();
    if (!msg) return;

    const declId = msg.meta?.declaration_id || msg.id;
    this.deletingInProgress.set(true);

    try {
      await this.chatService.deleteCashDeclaration(declId, msg.id);

      // Locally mark the cash_declaration and recon_result messages as deleted
      this.messages.update((prev) => {
        return prev.map((m) => {
          if (m.id === msg.id || (declId && m.meta?.declaration_id === declId)) {
            return {
              ...m,
              is_deleted: true,
              deleted_at: new Date().toISOString(),
              deleted_by_name: this.auth.currentUser()?.name || 'Admin',
            };
          }
          return m;
        });
      });

      this.cancelDeleteDeclaration();
      this.toast.success('Cash declaration deleted. The date is now available for new submission.');
      await this.refreshDeclarations();
      this.cdr.markForCheck();
    } catch (e: any) {
      this.toast.error(e.message || 'Failed to delete declaration');
    } finally {
      this.deletingInProgress.set(false);
    }
  }

  // ─── Stock Arrival / Delivery Intake Methods ───────────────────────────────

  loadProductsForIntake() {
    if (this.retailProducts().length > 0 || this.wholesaleProducts().length > 0) return;
    this.loadingProducts.set(true);

    this.inventoryService.getRetailProducts({ per_page: 500 }).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : res.data || [];
        this.retailProducts.set(list);
      },
      error: () => {},
    });

    this.inventoryService.getWholesaleProducts({ per_page: 500 }).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : res.data || [];
        this.wholesaleProducts.set(list);
      },
      error: () => {},
      complete: () => {
        this.loadingProducts.set(false);
      },
    });
  }

  openStockIntakeModal() {
    this.stockSupplierName.set('');
    this.stockWaybillNumber.set('');
    this.stockNote.set('');
    this.stockImageUrl.set(null);
    this.stockItems.set([
      {
        name: '',
        inventory_type: 'retail',
        is_new_product: false,
        quantity: 1,
        base_unit: 'pcs',
        category: 'General',
      },
    ]);
    this.loadProductsForIntake();
    this.showStockIntakeModal.set(true);
  }

  closeStockIntakeModal() {
    this.showStockIntakeModal.set(false);
    this.stockItems.set([]);
    this.stockImageUrl.set(null);
  }

  addStockItemRow() {
    this.stockItems.update((items) => [
      ...items,
      {
        name: '',
        inventory_type: 'retail',
        is_new_product: false,
        quantity: 1,
        base_unit: 'pcs',
        category: 'General',
      },
    ]);
  }

  removeStockItemRow(idx: number) {
    if (this.stockItems().length <= 1) return;
    this.stockItems.update((items) => items.filter((_, i) => i !== idx));
  }

  onItemTypeChange(idx: number, type: 'retail' | 'wholesale') {
    this.stockItems.update((items) => {
      const next = [...items];
      next[idx] = {
        ...next[idx],
        inventory_type: type,
        id: undefined,
        name: '',
        current_stock: undefined,
        cost_price: undefined,
        sell_price: undefined,
        previous_cost_price: undefined,
        previous_sell_price: undefined,
        search_query: '',
        dropdown_open: false,
        show_price_inputs: false,
      };
      return next;
    });
  }

  filterProducts(item: StockIntakeItem): (Product | WholesaleProduct)[] {
    const q = (item.search_query || '').trim().toLowerCase();
    const catalog = item.inventory_type === 'wholesale' ? this.wholesaleProducts() : this.retailProducts();
    if (!q) return catalog.slice(0, 30);
    return catalog
      .filter((p) => p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q)))
      .slice(0, 30);
  }

  onProductSearchFocus(idx: number) {
    this.stockItems.update((items) => {
      const next = [...items];
      next[idx] = { ...next[idx], dropdown_open: true };
      return next;
    });
  }

  onProductSearchBlur(idx: number) {
    setTimeout(() => {
      this.stockItems.update((items) => {
        if (!items[idx]) return items;
        const next = [...items];
        next[idx] = { ...next[idx], dropdown_open: false };
        return next;
      });
    }, 200);
  }

  selectProduct(idx: number, prod: Product | WholesaleProduct) {
    this.stockItems.update((items) => {
      const next = [...items];
      next[idx] = {
        ...next[idx],
        id: prod.id,
        name: prod.name,
        category: prod.category || 'General',
        base_unit: prod.base_unit || 'pcs',
        current_stock: prod.quantity,
        previous_cost_price: prod.cost_price,
        previous_sell_price: prod.sell_price,
        cost_price: prod.cost_price,
        sell_price: prod.sell_price,
        search_query: prod.name,
        dropdown_open: false,
        is_new_product: false,
        show_price_inputs: false,
      };
      return next;
    });
  }

  clearProductSelection(idx: number) {
    this.stockItems.update((items) => {
      const next = [...items];
      next[idx] = {
        ...next[idx],
        id: undefined,
        name: '',
        current_stock: undefined,
        cost_price: undefined,
        sell_price: undefined,
        previous_cost_price: undefined,
        previous_sell_price: undefined,
        search_query: '',
        dropdown_open: true,
      };
      return next;
    });
  }

  toggleItemPriceInputs(idx: number) {
    this.stockItems.update((items) => {
      const next = [...items];
      next[idx] = {
        ...next[idx],
        show_price_inputs: !next[idx].show_price_inputs,
      };
      return next;
    });
  }

  isPriceModified(item: StockIntakeItem): boolean {
    if (!item.id) return false;
    const costChanged =
      item.cost_price != null &&
      item.previous_cost_price != null &&
      Number(item.cost_price) !== Number(item.previous_cost_price);
    const sellChanged =
      item.sell_price != null &&
      item.previous_sell_price != null &&
      Number(item.sell_price) !== Number(item.previous_sell_price);
    return Boolean(costChanged || sellChanged);
  }

  toggleNewProduct(idx: number) {
    this.stockItems.update((items) => {
      const next = [...items];
      const current = next[idx];
      const isNew = !current.is_new_product;
      next[idx] = {
        ...current,
        is_new_product: isNew,
        id: isNew ? undefined : current.id,
        name: isNew ? '' : current.name,
        current_stock: isNew ? undefined : current.current_stock,
        search_query: isNew ? '' : current.search_query,
        dropdown_open: false,
        show_price_inputs: false,
      };
      return next;
    });
  }

  triggerStockFileInput() {
    this.stockFileInput?.nativeElement.click();
  }

  triggerStockCameraInput() {
    this.stockCameraInput?.nativeElement.click();
  }

  async onStockFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    input.value = '';

    await this.uploadImageFile(file, (url) => {
      this.stockImageUrl.set(url);
    });
  }

  async submitStockIntakeReport() {
    const items = this.stockItems();
    if (!items || items.length === 0) {
      this.toast.error('Please add at least one item');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.name || !it.name.trim()) {
        this.toast.error(`Item #${i + 1} has no product name or selection`);
        return;
      }
      if (!it.quantity || it.quantity <= 0) {
        this.toast.error(`Item #${i + 1} (${it.name}) must have a quantity greater than 0`);
        return;
      }
    }

    this.submittingStockIntake.set(true);
    try {
      await this.chatService.submitStockIntake(this.activeRoom(), {
        supplier_name: this.stockSupplierName(),
        waybill_number: this.stockWaybillNumber(),
        note: this.stockNote(),
        imageUrl: this.stockImageUrl(),
        items: items.map((it) => ({
          ...it,
          new_stock: it.current_stock != null ? it.current_stock + it.quantity : undefined,
        })),
      });

      this.toast.success('Stock intake submitted! Admin notified for inventory approval.');
      this.closeStockIntakeModal();
    } catch (e: any) {
      this.toast.error(e.message || 'Failed to submit delivery report');
    } finally {
      this.submittingStockIntake.set(false);
    }
  }

  // ─── Admin Stock Approval & Rejection Handlers ─────────────────────────────

  openApproveModal(msg: ChatMessage) {
    if (!this.isAdmin()) {
      this.toast.error('Only administrators can approve stock into inventory');
      return;
    }
    this.reviewingStockMsg.set(msg);
    const rawItems: StockIntakeItem[] = msg.meta?.items || [];
    this.adminReviewItems.set(JSON.parse(JSON.stringify(rawItems)));
    this.showApproveStockModal.set(true);
  }

  closeApproveModal() {
    this.showApproveStockModal.set(false);
    this.reviewingStockMsg.set(null);
    this.adminReviewItems.set([]);
  }

  async confirmApproveStock() {
    const msg = this.reviewingStockMsg();
    const items = this.adminReviewItems();
    if (!msg || !items || items.length === 0) return;

    this.approvingStock.set(true);

    try {
      const updatedItems: StockIntakeItem[] = [];

      for (const item of items) {
        if (item.is_new_product) {
          const payload: any = {
            name: item.name.trim(),
            category: item.category || 'General',
            cost_price: Number(item.cost_price || 0),
            sell_price: Number(item.sell_price || 0),
            quantity: Number(item.quantity || 0),
            base_unit: item.base_unit || 'pcs',
            description: `Stock intake from ${msg.meta?.supplier_name || 'delivery'} (${msg.meta?.waybill_number || ''})`,
          };

          const created: any =
            item.inventory_type === 'wholesale'
              ? await firstValueFrom(this.inventoryService.createWholesaleProduct(payload))
              : await firstValueFrom(this.inventoryService.createRetailProduct(payload));

          updatedItems.push({
            ...item,
            id: created.id,
            is_new_product: false,
            current_stock: 0,
            new_stock: created.quantity || item.quantity,
          });
        } else if (item.id) {
          // Check if prices were updated on delivery
          const priceChanged =
            (item.cost_price != null && Number(item.cost_price) !== Number(item.previous_cost_price)) ||
            (item.sell_price != null && Number(item.sell_price) !== Number(item.previous_sell_price));

          if (priceChanged) {
            const pricePayload: any = {};
            if (item.cost_price != null) pricePayload.cost_price = Number(item.cost_price);
            if (item.sell_price != null) pricePayload.sell_price = Number(item.sell_price);

            if (item.inventory_type === 'wholesale') {
              await firstValueFrom(this.inventoryService.updateWholesaleProduct(item.id, pricePayload));
            } else {
              await firstValueFrom(this.inventoryService.updateRetailProduct(item.id, pricePayload));
            }
          }

          const restocked: any =
            item.inventory_type === 'wholesale'
              ? await firstValueFrom(this.inventoryService.restockWholesaleProduct(item.id, Number(item.quantity)))
              : await firstValueFrom(this.inventoryService.restockRetailProduct(item.id, Number(item.quantity)));

          updatedItems.push({
            ...item,
            new_stock: restocked?.quantity ?? ((item.current_stock || 0) + Number(item.quantity)),
          });
        }
      }

      const adminName = this.auth.currentUser()?.name || this.userProfile()?.name || 'Admin';
      const updatedMsg = await this.chatService.updateStockIntakeStatus(msg.id, 'approved', {
        approved_by_name: adminName,
        approved_at: new Date().toISOString(),
        items: updatedItems,
      });

      this.messages.update((prev) =>
        prev.map((m) => (m.id === msg.id ? updatedMsg : m))
      );

      this.toast.success('Stock successfully added to inventory!');
      this.closeApproveModal();
      this.cdr.markForCheck();
    } catch (e: any) {
      this.toast.error(e.error?.message || e.message || 'Failed to approve and restock items');
    } finally {
      this.approvingStock.set(false);
    }
  }

  openRejectModal(msg: ChatMessage) {
    if (!this.isAdmin()) {
      this.toast.error('Only administrators can reject delivery reports');
      return;
    }
    this.rejectingStockMsg.set(msg);
    this.rejectionReason.set('');
    this.showRejectModal.set(true);
  }

  closeRejectModal() {
    this.showRejectModal.set(false);
    this.rejectingStockMsg.set(null);
    this.rejectionReason.set('');
  }

  async confirmRejectStock() {
    const msg = this.rejectingStockMsg();
    if (!msg) return;

    this.rejectingStock.set(true);
    try {
      const adminName = this.auth.currentUser()?.name || this.userProfile()?.name || 'Admin';
      const updatedMsg = await this.chatService.updateStockIntakeStatus(msg.id, 'rejected', {
        rejected_by_name: adminName,
        rejected_at: new Date().toISOString(),
        rejection_reason: this.rejectionReason().trim() || 'Delivery rejected by administrator',
      });

      this.messages.update((prev) =>
        prev.map((m) => (m.id === msg.id ? updatedMsg : m))
      );

      this.toast.info('Delivery report marked as rejected');
      this.closeRejectModal();
      this.cdr.markForCheck();
    } catch (e: any) {
      this.toast.error(e.message || 'Failed to reject stock delivery');
    } finally {
      this.rejectingStock.set(false);
    }
  }
}
