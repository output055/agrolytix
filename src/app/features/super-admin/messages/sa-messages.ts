import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/services/toast.service';

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

@Component({
  selector: 'app-sa-messages',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-6xl mx-auto space-y-6">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-black text-white tracking-tight">Contact Messages</h1>
          <p class="text-gray-400 text-sm mt-1">Inquiries from the public website.</p>
        </div>
      </div>

      <!-- Content -->
      @if (loading) {
        <div class="text-gray-500 text-sm">Loading messages...</div>
      } @else if (error) {
        <div class="text-red-400 text-sm">Failed to load messages.</div>
      } @else if (messages.length === 0) {
        <div class="rounded-2xl border p-12 text-center shadow-2xl"
             style="background: rgba(7,10,30,0.9); border-color: rgba(99,102,241,0.15);">
          <div class="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center text-gray-400"
               style="background: rgba(255,255,255,0.05);">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <h3 class="text-white font-bold mb-1">No messages yet</h3>
          <p class="text-gray-400 text-sm">When users submit the contact form, their messages will appear here.</p>
        </div>
      } @else {
        <div class="rounded-2xl border overflow-hidden shadow-2xl"
             style="background: rgba(7,10,30,0.9); border-color: rgba(99,102,241,0.15);">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr style="background: rgba(0,0,0,0.4);">
                  <th class="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b w-12" style="border-color:rgba(99,102,241,0.1);"></th>
                  <th class="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b" style="border-color:rgba(99,102,241,0.1);">Sender</th>
                  <th class="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b w-1/2" style="border-color:rgba(99,102,241,0.1);">Message</th>
                  <th class="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b" style="border-color:rgba(99,102,241,0.1);">Date</th>
                </tr>
              </thead>
              <tbody class="divide-y" style="divide-color: rgba(99,102,241,0.07);">
                @for (m of messages; track m.id) {
                  <tr class="hover:bg-white/[0.02] transition-colors cursor-pointer" 
                      [class.bg-indigo-500]="!m.read_at" [class.bg-opacity-5]="!m.read_at"
                      (click)="openMessage(m)">
                    <td class="px-6 py-4 text-center">
                      @if (!m.read_at) {
                        <span class="w-2.5 h-2.5 rounded-full bg-indigo-400 inline-block"></span>
                      }
                    </td>
                    <td class="px-6 py-4">
                      <div class="text-sm font-bold" [class.text-white]="!m.read_at" [class.text-gray-300]="m.read_at">{{ m.name }}</div>
                      <div class="text-xs text-gray-500">{{ m.email }}</div>
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-sm line-clamp-1" [class.text-gray-200]="!m.read_at" [class.text-gray-400]="m.read_at">
                        {{ m.message }}
                      </p>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {{ m.created_at | date:'MMM d, yyyy h:mm a' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- Message Modal -->
      @if (selectedMessage) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" (click)="closeMessage()">
          <div class="w-full max-w-2xl rounded-2xl border shadow-2xl p-6" 
               style="background: rgba(7,10,30,0.95); border-color: rgba(99,102,241,0.2);"
               (click)="$event.stopPropagation()">
            
            <div class="flex justify-between items-start mb-6 pb-6 border-b" style="border-color: rgba(255,255,255,0.05);">
              <div>
                <h3 class="text-lg font-bold text-white mb-1">{{ selectedMessage.name }}</h3>
                <a [href]="'mailto:' + selectedMessage.email" class="text-sm text-indigo-400 hover:underline">{{ selectedMessage.email }}</a>
              </div>
              <div class="text-right">
                <div class="text-xs text-gray-500 mb-2">{{ selectedMessage.created_at | date:'medium' }}</div>
                <button (click)="closeMessage()" class="text-gray-400 hover:text-white transition-colors">
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <div class="prose prose-invert max-w-none text-gray-300 text-sm whitespace-pre-wrap leading-relaxed mb-8">
              {{ selectedMessage.message }}
            </div>
            
            <div class="flex justify-end pt-4 border-t" style="border-color: rgba(255,255,255,0.05);">
               <a [href]="'mailto:' + selectedMessage.email" class="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold rounded-lg transition-colors">
                 Reply via Email
               </a>
            </div>
          </div>
        </div>
      }

    </div>
  `
})
export class SaMessages implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private apiUrl = environment.apiUrl;

  messages: ContactMessage[] = [];
  loading = true;
  error = false;
  selectedMessage: ContactMessage | null = null;

  ngOnInit() {
    this.loadMessages();
  }

  loadMessages() {
    this.loading = true;
    this.http.get<{data: ContactMessage[]}>(`${this.apiUrl}/super-admin/messages`).subscribe({
      next: (res) => {
        this.messages = res.data;
        this.loading = false;
        this.error = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = true;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openMessage(m: ContactMessage) {
    this.selectedMessage = m;
    if (!m.read_at) {
      this.markAsRead(m);
    }
  }

  closeMessage() {
    this.selectedMessage = null;
  }

  markAsRead(m: ContactMessage) {
    this.http.patch<{data: ContactMessage}>(`${this.apiUrl}/super-admin/messages/${m.id}/read`, {}).subscribe({
      next: (res) => {
        // Update local object
        m.read_at = res.data.read_at;
        this.cdr.detectChanges();
      }
    });
  }
}
