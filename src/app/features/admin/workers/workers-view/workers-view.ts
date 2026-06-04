import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { WorkerService, Worker } from '../../../../core/services/worker.service';
import { ToastService } from '../../../../core/services/toast.service';
import { BranchService, Branch } from '../../../../core/services/branch.service';
import { AuthService } from '../../../../core/services/auth.service';

const PERMISSIONS = [
  { id: 'pos.retail', label: 'Retail POS' },
  { id: 'pos.wholesale', label: 'Wholesale POS' },
  { id: 'sales.retail', label: 'Retail Sales' },
  { id: 'sales.wholesale', label: 'Wholesale Sales' },
  { id: 'inventory.retail', label: 'Retail Inventory' },
  { id: 'inventory.wholesale', label: 'Wholesale Inventory' },
  { id: 'clients', label: 'Clients' },
  { id: 'reversals', label: 'Reversals' },
];

/** Preset permission sets for quick role assignment */
const RETAILER_PERMISSIONS = ['pos.retail', 'sales.retail', 'inventory.retail'];

type UserRole = 'Admin' | 'Retailer' | 'Worker';

@Component({
  selector: 'app-workers-view',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold" style="color: #f0fdf4;">Users & Workers</h1>
          <p class="text-sm mt-1" style="color: #9ca3af;">Manage user accounts, roles and permissions</p>
        </div>
        <button (click)="openModal()" class="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors"
                style="background: #16a34a; color: white;">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      <!-- Main Table Card -->
      <div class="rounded-2xl overflow-hidden border" style="background: rgba(10,21,10,0.97); border-color: rgba(255,255,255,0.08);">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr class="border-b" style="border-color: rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); color: #9ca3af;">
                <th class="px-6 py-4 font-medium">User</th>
                <th class="px-6 py-4 font-medium">Role</th>
                <th class="px-6 py-4 font-medium">Contact</th>
                <th class="px-6 py-4 font-medium">Permissions</th>
                <th class="px-6 py-4 font-medium text-center">Status</th>
                <th class="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y" style="divide-color: rgba(255,255,255,0.04);">
              @for (worker of workers(); track worker.id) {
                <tr class="transition-colors hover:bg-white/5">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                           [style.background]="worker.role === 'Admin' ? 'rgba(251,191,36,0.1)' : 'rgba(22,163,74,0.1)'"
                           [style.color]="worker.role === 'Admin' ? '#fbbf24' : '#4ade80'">
                        {{ worker.name.charAt(0).toUpperCase() }}
                      </div>
                      <div>
                        <div class="font-bold text-gray-100 flex items-center gap-2">
                          {{ worker.name }}
                          <span class="px-1.5 py-0.5 text-[9px] uppercase font-bold rounded"
                                [style.background]="worker.business_id ? 'rgba(192,132,252,0.15)' : 'rgba(74,222,128,0.15)'"
                                [style.color]="worker.business_id ? '#c084fc' : '#4ade80'">
                            {{ worker.business?.name || 'Main HQ' }}
                          </span>
                        </div>
                        <div class="text-xs text-gray-400">{{ worker.email }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded-lg text-xs font-bold uppercase"
                          [style.background]="worker.role === 'Admin' ? 'rgba(251,191,36,0.12)' : 'rgba(74,222,128,0.1)'"
                          [style.color]="worker.role === 'Admin' ? '#fbbf24' : '#4ade80'">
                      {{ worker.role === 'Admin' ? '👑 Admin' : '🔧 Worker' }}
                    </span>
                  </td>
                  <td class="px-6 py-4" style="color: #d1d5db;">
                    {{ worker.contact || 'N/A' }}
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1 max-w-xs">
                      @if (worker.role === 'Admin') {
                        <span class="px-2 py-0.5 text-[10px] uppercase font-bold rounded"
                              style="background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid rgba(251,191,36,0.2);">
                          Full Access
                        </span>
                      } @else if (!worker.permissions || worker.permissions.length === 0) {
                        <span class="text-xs text-gray-500 italic">No permissions</span>
                      } @else {
                        @for (p of worker.permissions; track p) {
                          <span class="px-2 py-0.5 text-[10px] uppercase font-bold rounded"
                                style="background: rgba(255,255,255,0.05); color: #9ca3af; border: 1px solid rgba(255,255,255,0.08);">
                            {{ formatPermission(p) }}
                          </span>
                        }
                      }
                    </div>
                  </td>
                  <td class="px-6 py-4 text-center">
                    <button (click)="toggleStatus(worker)"
                            class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                            [ngStyle]="{ 'background': worker.status === 'active' ? '#16a34a' : 'rgba(255,255,255,0.1)' }">
                      <span class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform"
                            [ngClass]="worker.status === 'active' ? 'translate-x-5' : 'translate-x-1'"></span>
                    </button>
                    <div class="text-[10px] mt-1 font-medium tracking-wide uppercase"
                         [ngStyle]="{ 'color': worker.status === 'active' ? '#4ade80' : '#6b7280' }">
                      {{ worker.status }}
                    </div>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button (click)="editWorker(worker)" class="p-2 rounded-lg transition-colors hover:bg-white/10" style="color: #9ca3af;">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button (click)="deleteWorker(worker.id)" class="p-2 rounded-lg transition-colors hover:bg-red-500/10" style="color: #ef4444;">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              }
              @if (workers().length === 0) {
                <tr>
                  <td colspan="6" class="px-6 py-12 text-center" style="color: #6b7280;">
                    No users found. Create one.
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
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" (click)="closeModal()"></div>
        
        <!-- Dialog -->
        <div class="relative w-full max-w-xl rounded-2xl border shadow-2xl flex flex-col max-h-[90vh]"
             style="background: #0a150a; border-color: rgba(255,255,255,0.08);">
          <div class="p-6 border-b shrink-0" style="border-color: rgba(255,255,255,0.08);">
            <h2 class="text-xl font-bold" style="color: #f0fdf4;">{{ editingWorker() ? 'Edit' : 'Add' }} User</h2>
            <p class="text-xs mt-1" style="color: #6b7280;">Assign role, branch and access permissions</p>
          </div>
          
          <div class="p-6 overflow-y-auto" style="scrollbar-width: thin;">
            <form [formGroup]="form" class="space-y-5">

              <!-- Role Selector (shown prominently at top) -->
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider mb-3" style="color: #d1d5db;">User Role</label>
                <div class="grid grid-cols-3 gap-3">
                  @for (r of roleOptions; track r.value) {
                    <button type="button" (click)="selectRole(r.value)"
                            class="flex flex-col items-center gap-2 p-3 rounded-xl border transition-all"
                            [style.background]="selectedRole() === r.value ? r.activeBg : 'rgba(0,0,0,0.2)'"
                            [style.border-color]="selectedRole() === r.value ? r.activeColor : 'rgba(255,255,255,0.06)'">
                      <span class="text-xl">{{ r.icon }}</span>
                      <span class="text-xs font-bold" [style.color]="selectedRole() === r.value ? r.activeColor : '#6b7280'">
                        {{ r.label }}
                      </span>
                      <span class="text-[10px] text-center" style="color: #4b5563; line-height: 1.3;">{{ r.desc }}</span>
                    </button>
                  }
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2 sm:col-span-1 border rounded-xl px-4 py-2" style="background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.05);">
                  <label class="block text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Name</label>
                  <input type="text" formControlName="name" class="w-full bg-transparent outline-none text-sm" style="color: #f3f4f6;" placeholder="Full Name">
                </div>
                
                <div class="col-span-2 sm:col-span-1 border rounded-xl px-4 py-2" style="background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.05);">
                  <label class="block text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Email</label>
                  <input type="email" formControlName="email" class="w-full bg-transparent outline-none text-sm" style="color: #f3f4f6;" placeholder="Email address">
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2 sm:col-span-1 border rounded-xl px-4 py-2" style="background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.05);">
                  <label class="block text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Contact (Phone)</label>
                  <input type="text" formControlName="contact" class="w-full bg-transparent outline-none text-sm" style="color: #f3f4f6;" placeholder="Optional">
                </div>

                <div class="col-span-2 sm:col-span-1 border rounded-xl px-4 py-2" style="background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.05);">
                  <label class="block text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Password</label>
                  <input type="password" formControlName="password" class="w-full bg-transparent outline-none text-sm" style="color: #f3f4f6;" [placeholder]="editingWorker() ? 'Leave blank to keep' : 'Minimum 6 characters'">
                </div>
              </div>

              <!-- Store / Branch dropdown (Headquarters admin only) -->
              @if (isMainAdminAtHQ()) {
                <div class="border rounded-xl px-4 py-2" style="background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.05);">
                  <label class="block text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Store / Branch Assignment</label>
                  <select formControlName="business_id" class="w-full bg-transparent outline-none text-sm border-none" style="color: #f3f4f6;">
                    <option [ngValue]="null" style="background: #0a150a;">Main Headquarters</option>
                    @for (b of branches(); track b.id) {
                      <option [ngValue]="b.id" style="background: #0a150a;">{{ b.name }}</option>
                    }
                  </select>
                </div>
              }

              <!-- Permissions (only for Worker role) -->
              @if (selectedRole() === 'Worker') {
                <div class="pt-2">
                  <label class="block text-xs font-bold uppercase tracking-wider mb-3" style="color: #d1d5db;">Permissions</label>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    @for (p of availablePermissions; track p.id) {
                      <label class="flex items-center gap-3 p-3 rounded-xl cursor-border border transition-colors cursor-pointer group"
                             [ngStyle]="{'background': hasFormPermission(p.id) ? 'rgba(22,163,74,0.1)' : 'rgba(0,0,0,0.2)', 'border-color': hasFormPermission(p.id) ? '#16a34a' : 'rgba(255,255,255,0.05)'}">
                        <div class="flex items-center justify-center w-5 h-5 rounded border transition-colors"
                             [ngStyle]="{'background': hasFormPermission(p.id) ? '#16a34a' : 'transparent', 'border-color': hasFormPermission(p.id) ? '#16a34a' : 'rgba(255,255,255,0.2)'}">
                          @if (hasFormPermission(p.id)) {
                            <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                            </svg>
                          }
                        </div>
                        <span class="text-sm font-medium transition-colors" [ngStyle]="{'color': hasFormPermission(p.id) ? '#fff' : '#9ca3af'}">{{ p.label }}</span>
                        <input type="checkbox" class="hidden" [checked]="hasFormPermission(p.id)" (change)="toggleFormPermission(p.id)">
                      </label>
                    }
                  </div>
                </div>
              }

              <!-- Retailer role info banner -->
              @if (selectedRole() === 'Retailer') {
                <div class="rounded-xl p-3 flex items-start gap-3" style="background: rgba(74,222,128,0.06); border: 1px solid rgba(74,222,128,0.15);">
                  <span class="text-lg shrink-0">ℹ️</span>
                  <div>
                    <div class="text-xs font-bold mb-1" style="color: #4ade80;">Retailer Preset</div>
                    <div class="text-xs" style="color: #6b7280;">Auto-grants: Retail POS, Retail Sales, Retail Inventory. No wholesale or admin access.</div>
                  </div>
                </div>
              }

              <!-- Admin role info banner -->
              @if (selectedRole() === 'Admin') {
                <div class="rounded-xl p-3 flex items-start gap-3" style="background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.15);">
                  <span class="text-lg shrink-0">👑</span>
                  <div>
                    <div class="text-xs font-bold mb-1" style="color: #fbbf24;">Branch Admin</div>
                    <div class="text-xs" style="color: #6b7280;">This user will have full admin access to their assigned branch — including inventory, sales, reports and user management.</div>
                  </div>
                </div>
              }

            </form>
          </div>

          <div class="p-6 border-t flex items-center justify-end gap-3 shrink-0" style="border-color: rgba(255,255,255,0.08); background: rgba(0,0,0,0.2);">
            <button (click)="closeModal()" class="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                    style="color: #9ca3af; background: rgba(255,255,255,0.05);">
              Cancel
            </button>
            <button (click)="saveWorker()" [disabled]="form.invalid || saving()"
                    class="px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                    style="background: #16a34a; color: white; box-shadow: 0 4px 12px rgba(22,163,74,0.3);">
              {{ saving() ? 'Saving...' : (editingWorker() ? 'Save Changes' : 'Create User') }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class WorkersView implements OnInit {
  workerService = inject(WorkerService);
  toast = inject(ToastService);
  fb = inject(FormBuilder);
  branchService = inject(BranchService);
  authService = inject(AuthService);

  workers = signal<Worker[]>([]);
  branches = signal<Branch[]>([]);
  isModalOpen = signal(false);
  editingWorker = signal<Worker | null>(null);
  saving = signal(false);
  selectedRole = signal<UserRole>('Worker');

  isMainAdminAtHQ = computed(() => {
    const user = this.authService.currentUser();
    return user?.role === 'Admin' && !user?.business?.parent_id;
  });

  availablePermissions = PERMISSIONS;

  roleOptions = [
    {
      value: 'Admin' as UserRole,
      label: 'Admin',
      icon: '👑',
      desc: 'Full branch access',
      activeColor: '#fbbf24',
      activeBg: 'rgba(251,191,36,0.08)'
    },
    {
      value: 'Retailer' as UserRole,
      label: 'Retailer',
      icon: '🏪',
      desc: 'Retail only preset',
      activeColor: '#34d399',
      activeBg: 'rgba(52,211,153,0.08)'
    },
    {
      value: 'Worker' as UserRole,
      label: 'Worker',
      icon: '🔧',
      desc: 'Custom permissions',
      activeColor: '#60a5fa',
      activeBg: 'rgba(96,165,250,0.08)'
    }
  ];

  form: FormGroup = this.fb.group({
    name:        ['', Validators.required],
    email:       ['', [Validators.required, Validators.email]],
    password:    [''],
    contact:     [''],
    permissions: [[]],
    business_id: [null]
  });

  ngOnInit() {
    this.loadWorkers();
    if (this.isMainAdminAtHQ()) {
      this.loadBranches();
    }
  }

  loadWorkers() {
    this.workerService.getWorkers().subscribe({
      next: (data) => this.workers.set(data),
      error: () => this.toast.error('Failed to load users')
    });
  }

  loadBranches() {
    this.branchService.getBranches().subscribe({
      next: (data) => this.branches.set(data),
      error: () => {}
    });
  }

  formatPermission(pId: string): string {
    const found = this.availablePermissions.find(p => p.id === pId);
    return found ? found.label : pId;
  }

  selectRole(role: UserRole) {
    this.selectedRole.set(role);
    if (role === 'Retailer') {
      this.form.patchValue({ permissions: [...RETAILER_PERMISSIONS] });
    } else if (role === 'Admin') {
      this.form.patchValue({ permissions: [] });
    }
  }

  openModal() {
    this.editingWorker.set(null);
    this.selectedRole.set('Worker');
    this.form.reset({ permissions: [], business_id: null });
    this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.get('password')?.updateValueAndValidity();
    this.isModalOpen.set(true);
  }

  editWorker(worker: Worker) {
    this.editingWorker.set(worker);
    // Map backend role → UI role
    const uiRole: UserRole = worker.role === 'Admin' ? 'Admin' : 'Worker';
    this.selectedRole.set(uiRole);
    this.form.patchValue({
      name:        worker.name,
      email:       worker.email,
      contact:     worker.contact,
      password:    '',
      permissions: worker.permissions || [],
      business_id: worker.business_id
    });
    this.form.get('password')?.clearValidators();
    this.form.get('password')?.updateValueAndValidity();
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  hasFormPermission(id: string): boolean {
    const current = this.form.get('permissions')?.value || [];
    return current.includes(id);
  }

  toggleFormPermission(id: string) {
    const current = this.form.get('permissions')?.value || [];
    if (current.includes(id)) {
      this.form.patchValue({ permissions: current.filter((p: string) => p !== id) });
    } else {
      this.form.patchValue({ permissions: [...current, id] });
    }
  }

  saveWorker() {
    if (this.form.invalid) return;
    this.saving.set(true);

    const formVal = this.form.value;
    const uiRole  = this.selectedRole();

    // Translate UI role → backend role + permissions
    const backendRole = uiRole === 'Admin' ? 'Admin' : 'Worker';
    const permissions = uiRole === 'Retailer'
      ? RETAILER_PERMISSIONS
      : (uiRole === 'Admin' ? [] : (formVal.permissions || []));

    const data = {
      ...formVal,
      role: backendRole,
      permissions
    };

    const worker = this.editingWorker();
    const subs = worker
      ? this.workerService.updateWorker(worker.id, data)
      : this.workerService.createWorker(data);

    subs.subscribe({
      next: () => {
        this.toast.success(`User ${worker ? 'updated' : 'created'} successfully`);
        this.loadWorkers();
        this.closeModal();
      },
      error: (e) => {
        this.toast.error(e.error?.message || 'Error saving user');
      },
      complete: () => this.saving.set(false)
    });
  }

  toggleStatus(worker: Worker) {
    const newStatus = worker.status === 'active' ? 'inactive' : 'active';
    this.workerService.updateStatus(worker.id, newStatus).subscribe({
      next: () => {
        this.toast.success(`User marked as ${newStatus}`);
        this.loadWorkers();
      },
      error: () => this.toast.error('Failed to change status')
    });
  }

  deleteWorker(id: number) {
    if (confirm('Are you sure you want to delete this user? This cannot be undone.')) {
      this.workerService.deleteWorker(id).subscribe({
        next: () => {
          this.toast.success('User deleted');
          this.loadWorkers();
        },
        error: () => this.toast.error('Error deleting user')
      });
    }
  }
}
