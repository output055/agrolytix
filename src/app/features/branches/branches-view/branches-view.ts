import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BranchService, Branch } from '../../../core/services/branch.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-branches-view',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold" style="color: #f0fdf4;">Branches & Stores</h1>
          <p class="text-sm mt-1" style="color: #9ca3af;">Manage child business locations under your subscription</p>
        </div>
        <button (click)="openModal()" class="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors"
                style="background: #16a34a; color: white;">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
          </svg>
          Add Branch
        </button>
      </div>

      <!-- Stats Section -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="rounded-2xl p-5 border" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);">
          <div class="text-sm font-medium mb-1" style="color: #9ca3af;">Total Branches</div>
          <div class="text-3xl font-bold" style="color: #4ade80;">{{ branches().length }}</div>
        </div>
      </div>

      <!-- Main Table Card -->
      <div class="rounded-2xl overflow-hidden border" style="background: rgba(10,21,10,0.97); border-color: rgba(255,255,255,0.08);">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr class="border-b" style="border-color: rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); color: #9ca3af;">
                <th class="px-6 py-4 font-medium">Branch Location</th>
                <th class="px-6 py-4 font-medium">Phone / Contact</th>
                <th class="px-6 py-4 font-medium">Email</th>
                <th class="px-6 py-4 font-medium">Physical Address</th>
                <th class="px-6 py-4 font-medium">Created On</th>
                <th class="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y" style="divide-color: rgba(255,255,255,0.04);">
              @for (branch of branches(); track branch.id) {
                <tr class="transition-colors hover:bg-white/5">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                           style="background: rgba(22,163,74,0.1); color: #4ade80;">
                        🏪
                      </div>
                      <div>
                        <div class="font-bold text-gray-100">{{ branch.name }}</div>
                        <div class="text-xs text-gray-400">Branch ID: #{{ branch.id }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4" style="color: #d1d5db;">
                    {{ branch.phone || 'N/A' }}
                  </td>
                  <td class="px-6 py-4 text-gray-300">
                    {{ branch.email || 'N/A' }}
                  </td>
                  <td class="px-6 py-4 text-gray-300 max-w-xs truncate">
                    {{ branch.address || 'N/A' }}
                  </td>
                  <td class="px-6 py-4 text-gray-400 text-xs">
                    {{ branch.created_at | date:'dd MMM yyyy' }}
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center justify-end gap-3">
                      <button (click)="openEdit(branch)" title="Edit branch" class="text-blue-400 hover:text-blue-300 transition-colors">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                        </svg>
                      </button>
                      <button (click)="deleteBranch(branch)" title="Delete branch" class="text-red-400 hover:text-red-300 transition-colors">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              }
              @if (branches().length === 0) {
                <tr>
                  <td colspan="6" class="px-6 py-12 text-center" style="color: #6b7280;">
                    No child branches found under this account. Create one.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Form -->
    @if (isModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" (click)="closeModal()"></div>
        
        <!-- Dialog -->
        <div class="relative w-full max-w-md rounded-2xl border shadow-2xl flex flex-col max-h-[90vh]"
             style="background: #0a150a; border-color: rgba(255,255,255,0.08);">
          <div class="p-6 border-b shrink-0" style="border-color: rgba(255,255,255,0.08);">
            <h2 class="text-xl font-bold" style="color: #f0fdf4;">{{ editingBranch() ? 'Edit Branch' : 'Add New Branch' }}</h2>
          </div>
          
          <div class="p-6 overflow-y-auto" style="scrollbar-width: thin;">
            <form [formGroup]="form" class="space-y-4">
              <div class="border rounded-xl px-4 py-2" style="background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.05);">
                <label class="block text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Branch Name *</label>
                <input type="text" formControlName="name" class="w-full bg-transparent outline-none text-sm" style="color: #f3f4f6;" placeholder="Kumasi Outlet">
              </div>
              
              <div class="border rounded-xl px-4 py-2" style="background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.05);">
                <label class="block text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Contact Email</label>
                <input type="email" formControlName="email" class="w-full bg-transparent outline-none text-sm" style="color: #f3f4f6;" placeholder="kumasi@business.com">
              </div>

              <div class="border rounded-xl px-4 py-2" style="background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.05);">
                <label class="block text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Contact Phone</label>
                <input type="text" formControlName="phone" class="w-full bg-transparent outline-none text-sm" style="color: #f3f4f6;" placeholder="e.g. +233...">
              </div>

              <div class="border rounded-xl px-4 py-2" style="background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.05);">
                <label class="block text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Physical Address</label>
                <input type="text" formControlName="address" class="w-full bg-transparent outline-none text-sm" style="color: #f3f4f6;" placeholder="Street, City">
              </div>
            </form>
          </div>

          <div class="p-6 border-t flex items-center justify-end gap-3 shrink-0" style="border-color: rgba(255,255,255,0.08); background: rgba(0,0,0,0.2);">
            <button (click)="closeModal()" class="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                    style="color: #9ca3af; background: rgba(255,255,255,0.05);">
              Cancel
            </button>
            <button (click)="saveBranch()" [disabled]="form.invalid || saving()"
                    class="px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                    style="background: #16a34a; color: white; box-shadow: 0 4px 12px rgba(22,163,74,0.3);">
              {{ saving() ? 'Saving...' : (editingBranch() ? 'Save Changes' : 'Add Branch') }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class BranchesView implements OnInit {
  branchService = inject(BranchService);
  toast = inject(ToastService);
  fb = inject(FormBuilder);
  auth = inject(AuthService);
  router = inject(Router);

  branches = signal<Branch[]>([]);
  isModalOpen = signal(false);
  editingBranch = signal<Branch | null>(null);
  saving = signal(false);
  isHeadquarters = computed(() => {
    const user = this.auth.currentUser();
    return user?.role === 'Admin' && !user?.business?.parent_id;
  });

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    email: [''],
    phone: [''],
    address: ['']
  });

  ngOnInit() {
    if (!this.isHeadquarters()) {
      this.toast.error('Only headquarters can manage branches');
      this.router.navigate(['/dashboard']);
      return;
    }

    this.loadBranches();
  }

  loadBranches() {
    this.branchService.getBranches().subscribe({
      next: (data: Branch[]) => this.branches.set(data),
      error: () => this.toast.error('Failed to load branches')
    });
  }

  openModal() {
    this.form.reset();
    this.editingBranch.set(null);
    this.isModalOpen.set(true);
  }

  openEdit(branch: Branch) {
    this.editingBranch.set(branch);
    this.form.patchValue({
      name: branch.name,
      email: branch.email ?? '',
      phone: branch.phone ?? '',
      address: branch.address ?? ''
    });
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingBranch.set(null);
  }

  saveBranch() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const data = this.form.value;
    const branch = this.editingBranch();
    const request = branch
      ? this.branchService.updateBranch(branch.id, data)
      : this.branchService.createBranch(data);

    request.subscribe({
      next: () => {
        this.toast.success(`Branch ${branch ? 'updated' : 'added'} successfully`);
        this.loadBranches();
        this.closeModal();
      },
      error: (e: any) => {
        this.toast.error(e.error?.message || 'Error saving branch');
      },
      complete: () => this.saving.set(false)
    });
  }

  deleteBranch(branch: Branch) {
    const ok = confirm(`Delete ${branch.name}? This will remove the branch and all records assigned to it.`);
    if (!ok) return;

    this.branchService.deleteBranch(branch.id).subscribe({
      next: () => {
        this.toast.success('Branch deleted successfully');
        this.loadBranches();
      },
      error: (e: any) => this.toast.error(e.error?.message || 'Error deleting branch')
    });
  }
}
