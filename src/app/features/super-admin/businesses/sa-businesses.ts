import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

export interface Business {
  id: number;
  name: string;
  owner_name: string;
  owner_email: string;
  subscription_status: string;
  subscription_plan: string;
  subscription_ends_at: string;
  trial_ends_at: string;
  users_count: number;
  total_revenue: number;
  last_payment_date: string;
  last_payment_status: string;
  created_at: string;
}

@Component({
  selector: 'app-sa-businesses',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: './sa-businesses.html',
})
export class SaBusinesses implements OnInit {
  private http = inject(HttpClient);
  private api  = environment.apiUrl;

  businesses     = signal<Business[]>([]);
  loading        = signal(true);
  
  // Filters
  searchQuery    = signal('');
  filterStatus   = signal('');
  filterPlan     = signal('');

  // Dropdown state
  activeDropdown = signal<number | null>(null);

  // Drawer state
  drawerBusiness = signal<any | null>(null);
  drawerLoading  = signal(false);

  // KPIs
  totalBusinesses = computed(() => this.businesses().length);
  activeSubscriptions = computed(() => this.businesses().filter(b => b.subscription_status === 'active').length);
  trialUsers = computed(() => this.businesses().filter(b => b.subscription_status === 'trialing').length);
  totalPlatformRevenue = computed(() => this.businesses().reduce((sum, b) => sum + (Number(b.total_revenue) || 0), 0));

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<Business[]>(`${this.api}/super-admin/businesses`).subscribe({
      next: (d) => { this.businesses.set(d); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  get filtered() {
    let list = this.businesses();
    const q = this.searchQuery().toLowerCase();
    
    if (q) {
      list = list.filter(b =>
        b.name.toLowerCase().includes(q) ||
        (b.owner_email ?? '').toLowerCase().includes(q)
      );
    }
    
    const status = this.filterStatus();
    if (status) {
      list = list.filter(b => b.subscription_status === status);
    }

    const plan = this.filterPlan();
    if (plan) {
      list = list.filter(b => b.subscription_plan === plan);
    }

    return list;
  }

  isExpiringSoon(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  }

  toggleDropdown(id: number) {
    this.activeDropdown.set(this.activeDropdown() === id ? null : id);
  }

  closeDropdown() {
    this.activeDropdown.set(null);
  }

  // Actions
  suspend(id: number) {
    if (!confirm('Are you sure you want to suspend this business?')) return;
    this.http.post(`${this.api}/super-admin/businesses/${id}/suspend`, {}).subscribe(() => this.load());
    this.closeDropdown();
  }

  activate(id: number) {
    if (!confirm('Manually grant 1 month active access?')) return;
    this.http.post(`${this.api}/super-admin/businesses/${id}/activate`, {}).subscribe(() => this.load());
    this.closeDropdown();
  }

  extendTrial(id: number) {
    if (!confirm('Extend trial by 14 days?')) return;
    this.http.post(`${this.api}/super-admin/businesses/${id}/extend-trial`, {}).subscribe(() => this.load());
    this.closeDropdown();
  }

  changePlan(id: number, currentPlan: string) {
    const newPlan = currentPlan === 'annual' ? 'monthly' : 'annual';
    if (!confirm(`Change plan to ${newPlan}?`)) return;
    this.http.post(`${this.api}/super-admin/businesses/${id}/change-plan`, { plan: newPlan }).subscribe(() => this.load());
    this.closeDropdown();
  }

  // Drawer
  openDrawer(biz: Business) {
    this.drawerBusiness.set(null);
    this.drawerLoading.set(true);
    this.http.get<any>(`${this.api}/super-admin/businesses/${biz.id}/details`).subscribe({
      next: (res) => {
        this.drawerBusiness.set(res);
        this.drawerLoading.set(false);
      },
      error: () => this.drawerLoading.set(false)
    });
    this.closeDropdown();
  }

  closeDrawer() {
    this.drawerBusiness.set(null);
  }
}
