import { Component, OnInit, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ChatService } from '../../../core/services/chat.service';
import { WorkerService, Worker } from '../../../core/services/worker.service';
import { ClientService } from '../../../core/services/client.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { Client } from '../../../core/models/client.model';
import { CommunicationRecord, ChatSmsSettings, CommunicationRule } from '../../../core/models/chat.model';

@Component({
  selector: 'app-communications-view',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './communications-view.html',
})
export class CommunicationsView implements OnInit {
  private chatService = inject(ChatService);
  private workerService = inject(WorkerService);
  private clientService = inject(ClientService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  activeTab = signal<'log' | 'compose' | 'automation'>('log');
  loading = signal(true);
  Math = Math;

  // Communications Table
  records = signal<CommunicationRecord[]>([]);
  searchQuery = signal('');
  filterAudience = signal<'all' | 'worker' | 'client' | 'admin'>('all');
  filterMode = signal<'all' | 'automated' | 'manual'>('all');

  filteredRecords = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const aud = this.filterAudience();
    const mode = this.filterMode();
    return this.records().filter((r) => {
      if (aud !== 'all' && r.audience !== aud) return false;
      if (mode !== 'all' && r.mode !== mode) return false;
      if (q) {
        const hay = `${r.message} ${r.event_type} ${(r.recipient_names || []).join(' ')} ${(r.recipients || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  // Recipients for Compose SMS
  workers = signal<Worker[]>([]);
  clients = signal<Client[]>([]);
  composeAudience = signal<'worker' | 'client' | 'debtors'>('client');
  recipientSearch = signal('');
  selectedIds = signal<Set<number>>(new Set());
  composeMessage = '';
  sendingSms = signal(false);

  private isValidPhone(val: string | null | undefined): string | null {
    if (!val) return null;
    const cleaned = val.trim().replace(/[\s\-\(\)]/g, '');
    return /^\+?\d{9,15}$/.test(cleaned) ? val.trim() : null;
  }

  availableRecipients = computed(() => {
    const aud = this.composeAudience();
    const q = this.recipientSearch().trim().toLowerCase();
    let list: { id: number; name: string; subtitle: string; phone: string | null }[] = [];

    if (aud === 'worker') {
      list = this.workers().map((w) => ({
        id: w.id,
        name: w.name,
        subtitle: `${w.role}${w.business?.name ? ' • ' + w.business.name : ''}`,
        phone: this.isValidPhone(w.contact),
      }));
    } else if (aud === 'client') {
      list = this.clients().map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: c.total_debt > 0 ? `Owes GH₵${Number(c.total_debt).toFixed(2)}` : 'No debt',
        phone: this.isValidPhone(c.contact),
      }));
    } else {
      list = this.clients()
        .filter((c) => Number(c.total_debt) > 0)
        .map((c) => ({
          id: c.id,
          name: c.name,
          subtitle: `Owes GH₵${Number(c.total_debt).toFixed(2)}`,
          phone: this.isValidPhone(c.contact),
        }));
    }

    if (!q) return list;
    return list.filter((r) =>
      `${r.name} ${r.phone || ''} ${r.subtitle}`.toLowerCase().includes(q)
    );
  });

  // Automated SMS Settings
  smsForm: Partial<ChatSmsSettings> = {
    enabled: true,
    arkesel_api_key: '',
    sender_id: 'Agrolytix',
    alert_worker_cash_balanced_profit: true,
    alert_cash_balanced: true,
    alert_cash_imbalance: true,
    alert_missing_cash: true,
    alert_stock_intake: true,
    alert_price_change: true,
    alert_daily_summary: true,
    alert_low_balance: true,
    alert_client_sale_receipt: false,
    alert_client_debt_reminder: false,
    alert_client_debt_payment: true,
  };
  savingSettings = signal(false);
  smsBalance = signal<any>(null);
  checkingBalance = signal(false);

  // Custom Automated SMS Rules
  readonly presetTriggers = [
    'cash_balanced',
    'cash_imbalance',
    'wholesale_sale',
    'debt_payment',
    'daily_schedule',
    'weekly_schedule',
  ];
  readonly messagePresets = [
    { label: 'Profit Summary', text: 'Hello {name}, {branch} cash is balanced for {date}. Daily Profit: GH₵{profit}. Great job!' },
    { label: 'Cash Reminder', text: 'Hello {name}, please remember to submit your cash declaration for {branch} today ({date}).' },
    { label: 'Debt Follow-up', text: 'Dear {name}, kindly clear your outstanding balance of GH₵{amount} with {branch}. Thank you!' },
    { label: 'Staff Notice', text: 'Hello {name}, important notice from {branch}: ' },
  ];

  rules = signal<CommunicationRule[]>([]);
  showRuleModal = signal(false);
  savingRule = signal(false);
  runningRuleId = signal<string | null>(null);
  ruleAudienceSignal = signal<'worker' | 'client' | 'debtors' | 'admin' | 'custom'>('worker');
  ruleTargetSearch = signal('');
  ruleSelectedIds = signal<Set<number>>(new Set());
  ruleTriggerType = 'cash_balanced';
  customTriggerName = '';
  ruleMessages: string[] = [''];
  activeMessageIndex = 0;

  ruleTargetCandidates = computed(() => {
    const aud = this.ruleAudienceSignal();
    const q = this.ruleTargetSearch().trim().toLowerCase();
    let list: { id: number; name: string; subtitle: string; phone: string | null }[] = [];

    const mapWorker = (w: Worker) => ({
      id: w.id,
      name: w.name,
      subtitle: `${w.role}${w.business?.name ? ' • ' + w.business.name : ''}`,
      phone: this.isValidPhone(w.contact),
    });
    const mapClient = (c: Client) => ({
      id: c.id,
      name: c.name,
      subtitle: Number(c.total_debt) > 0 ? `Client • Owes GH₵${Number(c.total_debt).toFixed(2)}` : 'Client',
      phone: this.isValidPhone(c.contact),
    });

    if (aud === 'worker') {
      list = this.workers().filter((w) => w.role === 'Worker').map(mapWorker);
    } else if (aud === 'admin') {
      list = this.workers().filter((w) => w.role === 'Admin').map(mapWorker);
    } else if (aud === 'client') {
      list = this.clients().map(mapClient);
    } else if (aud === 'debtors') {
      list = this.clients().filter((c) => Number(c.total_debt) > 0).map(mapClient);
    } else {
      list = [
        ...this.workers().map(mapWorker),
        ...this.clients().map(mapClient),
      ];
    }

    if (!q) return list;
    return list.filter((r) => `${r.name} ${r.phone || ''} ${r.subtitle}`.toLowerCase().includes(q));
  });

  ruleForm: Partial<CommunicationRule> = {
    name: '',
    audience: 'worker',
    trigger_event: 'cash_balanced',
    schedule_time: '18:00',
    message_template: '',
    message_templates: [''],
    target_ids: [],
    target_names: [],
    enabled: true,
  };

  get isHqAdmin(): boolean {
    const u = this.auth.currentUser();
    return u?.role === 'Admin' && !u?.business?.parent_id;
  }

  async ngOnInit() {
    await this.loadAll();
  }

  async loadAll() {
    this.loading.set(true);
    try {
      await this.chatService.getClient();
      const [comms, settings, rulesList, workersList, clientsList] = await Promise.all([
        this.chatService.getCommunications().catch(() => []),
        this.chatService.getSmsSettings().catch(() => null),
        this.chatService.getCommunicationRules().catch(() => []),
        firstValueFrom(this.workerService.getWorkers()).catch(() => []),
        firstValueFrom(this.clientService.getClients()).catch(() => []),
      ]);

      this.records.set(comms);
      this.rules.set(rulesList);
      this.workers.set(Array.isArray(workersList) ? workersList : []);
      this.clients.set(Array.isArray(clientsList) ? clientsList : []);

      if (settings) {
        this.smsForm = {
          ...this.smsForm,
          ...settings,
        };
      }
    } finally {
      this.loading.set(false);
      this.cdr.detectChanges();
    }
  }

  setComposeAudience(aud: 'worker' | 'client' | 'debtors') {
    this.composeAudience.set(aud);
    this.selectedIds.set(new Set());
  }

  toggleRecipient(id: number, hasPhone: boolean) {
    if (!hasPhone) return;
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIds.set(next);
  }

  selectAllWithPhone() {
    const next = new Set<number>();
    this.availableRecipients().forEach((r) => {
      if (r.phone) next.add(r.id);
    });
    this.selectedIds.set(next);
  }

  clearSelection() {
    this.selectedIds.set(new Set());
  }

  applyTemplate(template: string) {
    this.composeMessage = template;
  }

  async sendManualSms() {
    const selected = this.availableRecipients().filter((r) => this.selectedIds().has(r.id) && r.phone);
    if (selected.length === 0) {
      this.toast.warning('Select at least one recipient with a valid phone number.');
      return;
    }
    if (!this.composeMessage.trim()) {
      this.toast.warning('Please enter a message to send.');
      return;
    }

    this.sendingSms.set(true);
    try {
      const audience = this.composeAudience() === 'worker' ? 'worker' : 'client';
      const eventType = this.composeAudience() === 'debtors' ? 'client_debt_reminder' : 'custom_sms';

      const res = await this.chatService.sendCommunication({
        audience,
        mode: 'manual',
        event_type: eventType,
        recipient_ids: selected.map((s) => s.id),
        recipient_names: selected.map((s) => s.name),
        phones: selected.map((s) => s.phone!),
        message: this.composeMessage.trim(),
      });

      if (res?.success) {
        this.toast.success(`SMS sent to ${res.count || selected.length} recipient(s)!`);
        this.composeMessage = '';
        this.clearSelection();
        const updated = await this.chatService.getCommunications();
        this.records.set(updated);
        this.activeTab.set('log');
      } else {
        this.toast.error(res?.error || 'Failed to send SMS. Check Arkesel settings.');
      }
    } catch (err: any) {
      this.toast.error(err?.error?.message || err?.message || 'Failed to send SMS');
    } finally {
      this.sendingSms.set(false);
      this.cdr.detectChanges();
    }
  }

  async saveAutomationSettings() {
    this.savingSettings.set(true);
    try {
      await this.chatService.saveSmsSettings(this.smsForm);
      this.toast.success('Automated SMS controls saved!');
    } catch (err: any) {
      this.toast.error(err?.message || 'Failed to save SMS settings');
    } finally {
      this.savingSettings.set(false);
      this.cdr.detectChanges();
    }
  }

  async checkBalance() {
    this.checkingBalance.set(true);
    try {
      const res = await this.chatService.getArkeselBalance();
      this.smsBalance.set(res?.data || res);
    } catch {
      this.toast.error('Could not fetch Arkesel SMS balance');
    } finally {
      this.checkingBalance.set(false);
      this.cdr.detectChanges();
    }
  }

  formatEventLabel(event: string): string {
    return (event || 'custom_sms')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ─── Custom Automated SMS Rules ─────────────────────────────────────────────

  openRuleModal(rule?: CommunicationRule) {
    if (rule) {
      this.ruleForm = { ...rule };
      this.ruleAudienceSignal.set(rule.audience || 'worker');
      this.ruleSelectedIds.set(new Set(rule.target_ids || []));
      if (this.presetTriggers.includes(rule.trigger_event)) {
        this.ruleTriggerType = rule.trigger_event;
        this.customTriggerName = '';
      } else {
        this.ruleTriggerType = 'custom';
        this.customTriggerName = rule.trigger_event || '';
      }
      const msgs = (rule.message_templates && rule.message_templates.length > 0)
        ? [...rule.message_templates]
        : (rule.message_template ? [rule.message_template] : ['']);
      this.ruleMessages = msgs;
    } else {
      this.ruleForm = {
        name: '',
        audience: 'worker',
        trigger_event: 'cash_balanced',
        schedule_time: '18:00',
        message_template: '',
        message_templates: [''],
        target_ids: [],
        target_names: [],
        enabled: true,
      };
      this.ruleAudienceSignal.set('worker');
      this.ruleSelectedIds.set(new Set());
      this.ruleTriggerType = 'cash_balanced';
      this.customTriggerName = '';
      this.ruleMessages = [''];
    }
    this.activeMessageIndex = 0;
    this.ruleTargetSearch.set('');
    this.showRuleModal.set(true);
  }

  closeRuleModal() {
    this.showRuleModal.set(false);
  }

  onRuleAudienceChange(aud: 'worker' | 'client' | 'debtors' | 'admin' | 'custom') {
    this.ruleForm.audience = aud;
    this.ruleAudienceSignal.set(aud);
    this.ruleSelectedIds.set(new Set());
  }

  toggleRuleTarget(id: number) {
    const next = new Set(this.ruleSelectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.ruleSelectedIds.set(next);
  }

  selectAllRuleTargets() {
    const next = new Set(this.ruleSelectedIds());
    for (const c of this.ruleTargetCandidates()) {
      if (c.phone) next.add(c.id);
    }
    this.ruleSelectedIds.set(next);
  }

  clearRuleTargets() {
    this.ruleSelectedIds.set(new Set());
  }

  addRuleMessage(text = '') {
    this.ruleMessages = [...this.ruleMessages, text];
    this.activeMessageIndex = this.ruleMessages.length - 1;
  }

  removeRuleMessage(index: number) {
    if (this.ruleMessages.length <= 1) return;
    this.ruleMessages = this.ruleMessages.filter((_, i) => i !== index);
    this.activeMessageIndex = Math.min(this.activeMessageIndex, this.ruleMessages.length - 1);
  }

  isPresetSelected(text: string): boolean {
    return this.ruleMessages.some((m) => m.trim() === text.trim());
  }

  togglePresetMessage(text: string) {
    const idx = this.ruleMessages.findIndex((m) => m.trim() === text.trim());
    if (idx >= 0) {
      if (this.ruleMessages.length === 1) {
        this.ruleMessages = [''];
      } else {
        this.removeRuleMessage(idx);
      }
      return;
    }
    const emptyIdx = this.ruleMessages.findIndex((m) => !m.trim());
    if (emptyIdx >= 0) {
      const next = [...this.ruleMessages];
      next[emptyIdx] = text;
      this.ruleMessages = next;
      this.activeMessageIndex = emptyIdx;
    } else {
      this.addRuleMessage(text);
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  insertVariable(variable: string) {
    const idx = Math.min(this.activeMessageIndex, Math.max(0, this.ruleMessages.length - 1));
    const next = [...this.ruleMessages];
    next[idx] = (next[idx] || '') + variable;
    this.ruleMessages = next;
  }

  async saveRule() {
    if (!this.ruleForm.name?.trim()) {
      this.toast.warning('Please enter a rule name');
      return;
    }

    const triggerEvent = this.ruleTriggerType === 'custom'
      ? this.customTriggerName.trim()
      : this.ruleTriggerType;

    if (!triggerEvent) {
      this.toast.warning('Please enter a custom trigger event name');
      return;
    }

    const cleanMessages = this.ruleMessages.map((m) => m.trim()).filter(Boolean);
    if (cleanMessages.length === 0) {
      this.toast.warning('Please enter at least one message template');
      return;
    }

    const targetIds = Array.from(this.ruleSelectedIds());
    if (this.ruleForm.audience === 'custom' && targetIds.length === 0) {
      this.toast.warning('Please select at least one individual recipient');
      return;
    }

    const allKnown = [
      ...this.workers().map((w) => ({ id: w.id, name: w.name })),
      ...this.clients().map((c) => ({ id: c.id, name: c.name })),
    ];
    const targetNames = targetIds
      .map((id) => allKnown.find((u) => u.id === id)?.name)
      .filter((n): n is string => !!n);

    this.savingRule.set(true);
    try {
      await this.chatService.saveCommunicationRule({
        ...this.ruleForm,
        trigger_event: triggerEvent,
        target_ids: targetIds,
        target_names: targetNames,
        message_template: cleanMessages[0],
        message_templates: cleanMessages,
      });
      this.toast.success(this.ruleForm.id ? 'Automated SMS rule updated!' : 'Automated SMS rule created!');
      this.closeRuleModal();
      const rulesList = await this.chatService.getCommunicationRules();
      this.rules.set(rulesList);
    } catch (err: any) {
      this.toast.error(err?.message || 'Failed to save rule');
    } finally {
      this.savingRule.set(false);
      this.cdr.detectChanges();
    }
  }

  async toggleRule(rule: CommunicationRule) {
    if (!rule.id) return;
    try {
      const updated = await this.chatService.saveCommunicationRule({
        ...rule,
        enabled: !rule.enabled,
      });
      this.rules.update((list) => list.map((r) => (r.id === rule.id ? updated : r)));
      this.toast.info(`Rule "${rule.name}" ${updated.enabled ? 'enabled' : 'paused'}`);
    } catch (err: any) {
      this.toast.error(err?.message || 'Failed to update rule');
    }
  }

  async deleteRule(rule: CommunicationRule) {
    if (!rule.id) return;
    try {
      await this.chatService.deleteCommunicationRule(rule.id);
      this.rules.update((list) => list.filter((r) => r.id !== rule.id));
      this.toast.success('Automated SMS rule deleted');
    } catch (err: any) {
      this.toast.error(err?.message || 'Failed to delete rule');
    }
  }

  async runRuleNow(rule: CommunicationRule) {
    if (!rule.id) return;
    this.runningRuleId.set(rule.id);
    try {
      let targets: { id: number; name: string; phone: string }[] = [];

      if (rule.target_ids && rule.target_ids.length > 0) {
        const idSet = new Set(rule.target_ids);
        const allCandidates = [
          ...this.workers().map((w) => ({ id: w.id, name: w.name, phone: this.isValidPhone(w.contact) || '' })),
          ...this.clients().map((c) => ({ id: c.id, name: c.name, phone: this.isValidPhone(c.contact) || '' })),
        ];
        const seen = new Set<number>();
        targets = allCandidates.filter((t) => {
          if (!idSet.has(t.id) || !t.phone || seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
      } else if (rule.audience === 'worker') {
        targets = this.workers()
          .filter((w) => w.role === 'Worker')
          .map((w) => ({ id: w.id, name: w.name, phone: this.isValidPhone(w.contact) || '' }))
          .filter((t) => !!t.phone);
      } else if (rule.audience === 'admin') {
        targets = this.workers()
          .filter((w) => w.role === 'Admin')
          .map((w) => ({ id: w.id, name: w.name, phone: this.isValidPhone(w.contact) || '' }))
          .filter((t) => !!t.phone);
      } else if (rule.audience === 'debtors') {
        targets = this.clients()
          .filter((c) => Number(c.total_debt) > 0)
          .map((c) => ({ id: c.id, name: c.name, phone: this.isValidPhone(c.contact) || '' }))
          .filter((t) => !!t.phone);
      } else {
        targets = this.clients()
          .map((c) => ({ id: c.id, name: c.name, phone: this.isValidPhone(c.contact) || '' }))
          .filter((t) => !!t.phone);
      }

      if (targets.length === 0) {
        this.toast.warning(`No recipients with valid phone numbers found.`);
        return;
      }

      const branchName = this.auth.currentUser()?.business?.name || 'Agrolytix';
      const today = new Date().toISOString().slice(0, 10);
      const templates = (rule.message_templates && rule.message_templates.length > 0
        ? rule.message_templates
        : [rule.message_template]
      ).filter((m) => !!m?.trim());

      const mappedAudience: 'worker' | 'client' | 'admin' | 'all' =
        rule.audience === 'debtors' ? 'client' : (rule.audience === 'custom' ? 'all' : rule.audience);

      let totalSent = 0;
      let lastError = '';

      for (const tpl of templates) {
        const renderedMessage = tpl
          .replace(/\{branch\}/gi, branchName)
          .replace(/\{date\}/gi, today)
          .replace(/\{name\}/gi, targets.length === 1 ? targets[0].name : (rule.audience === 'worker' ? 'Team' : 'Customer'));

        const res = await this.chatService.sendCommunication({
          audience: mappedAudience,
          mode: 'automated',
          event_type: rule.trigger_event,
          recipient_ids: targets.map((t) => t.id),
          recipient_names: targets.map((t) => t.name),
          phones: targets.map((t) => t.phone),
          message: renderedMessage,
        });

        if (res?.success) {
          totalSent += Number(res.count || targets.length);
        } else {
          lastError = res?.error || 'Failed to dispatch rule SMS';
        }
      }

      if (totalSent > 0) {
        await this.chatService.markRuleRun(rule.id);
        this.toast.success(`Automated SMS "${rule.name}" sent (${templates.length} message${templates.length > 1 ? 's' : ''}, ${targets.length} recipient${targets.length > 1 ? 's' : ''})!`);
        const [comms, rulesList] = await Promise.all([
          this.chatService.getCommunications(),
          this.chatService.getCommunicationRules(),
        ]);
        this.records.set(comms);
        this.rules.set(rulesList);
      } else {
        this.toast.error(lastError || 'Failed to dispatch rule SMS');
      }
    } catch (err: any) {
      this.toast.error(err?.message || 'Failed to run rule');
    } finally {
      this.runningRuleId.set(null);
      this.cdr.detectChanges();
    }
  }
}
