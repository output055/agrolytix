import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

interface HelpSection {
  id: string;
  title: string;
  iconPath: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-help-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-20">
      <!-- Header -->
      <div class="flex items-center gap-4 mb-8">
        <div class="p-3 rounded-2xl bg-green-500/10 text-green-400">
          <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 class="text-3xl font-bold text-white tracking-tight">System Documentation</h1>
          <p class="text-sm text-gray-400 mt-1">Professional step-by-step guides for the Agrolytix platform</p>
        </div>
      </div>

      <div class="flex flex-col lg:flex-row gap-8">
        <!-- Sidebar Navigation -->
        <div class="lg:w-72 shrink-0">
          <div class="sticky top-24 space-y-2">
            @for (section of visibleSections(); track section.id) {
              <button (click)="activeSection.set(section.id)"
                      [class.bg-green-600]="activeSection() === section.id"
                      [class.text-white]="activeSection() === section.id"
                      [class.bg-white\/5]="activeSection() !== section.id"
                      [class.text-gray-400]="activeSection() !== section.id"
                      class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all hover:bg-white/10 text-left border border-white/5">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="section.iconPath" />
                </svg>
                <span class="text-sm">{{ section.title }}</span>
              </button>
            }
          </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 rounded-3xl border p-8 lg:p-12 min-h-[600px]"
             style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.06);">
          
          <!-- PLATFORM OVERVIEW -->
          @if (activeSection() === 'overview') {
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div class="space-y-4">
                <h2 class="text-3xl font-bold text-white">Platform Overview</h2>
                <p class="text-gray-400 leading-relaxed text-lg">
                  Welcome to Agrolytix. This documentation provides systematic instructions for managing your inventory, processing sales, and auditing your financial performance.
                </p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
                <div class="space-y-4">
                  <h3 class="font-bold text-green-400 uppercase tracking-widest text-xs">Core Concepts</h3>
                  <div class="space-y-4">
                    <div class="flex gap-4">
                      <div class="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white font-bold">1</div>
                      <p class="text-sm text-gray-400"><strong class="text-gray-200">Contextual Design:</strong> All green-themed actions relate to Retail operations, while Blue/Amber relate to Wholesale.</p>
                    </div>
                    <div class="flex gap-4">
                      <div class="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white font-bold">2</div>
                      <p class="text-sm text-gray-400"><strong class="text-gray-200">Security Layers:</strong> Sensitive financial operations and staff management are restricted to Administrative accounts.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- INVENTORY -->
          @if (activeSection() === 'inventory') {
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 class="text-3xl font-bold text-white">Inventory Management</h2>
              
              <div class="space-y-10">
                <section class="space-y-4">
                  <h3 class="text-xl font-bold text-green-400 flex items-center gap-2">
                    How to Add New Products
                  </h3>
                  <div class="space-y-4 ml-4 border-l border-white/10 pl-6">
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 1:</span> Navigate to <code class="bg-black/40 px-2 py-0.5 rounded text-white italic">Management > Retail Inventory</code>.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 2:</span> Click the <span class="text-white font-bold underline">Add Product</span> button in the top right.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 3:</span> Enter the product name, set the <span class="text-white">Base Unit</span> (e.g., Litre, Bag), and input the cost and selling prices.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 4:</span> Define a <span class="text-white font-bold">Low Stock Alert</span>. The system will alert you on the dashboard when stock hits this level.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 5:</span> Click <span class="text-white font-bold italic">Create Product</span> to save.
                    </div>
                  </div>
                </section>

                <section class="space-y-4">
                  <h3 class="text-xl font-bold text-green-400">
                    Stock Replenishment
                  </h3>
                  <div class="space-y-4 ml-4 border-l border-white/10 pl-6 text-gray-400">
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 1:</span> Find the product in the inventory list.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 2:</span> Click the <span class="text-white font-bold font-mono">Restock</span> icon on the product row.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 3:</span> Enter the new shipment quantity and confirm the update.
                    </div>
                  </div>
                </section>
              </div>
            </div>
          }

          <!-- POS RETAIL -->
          @if (activeSection() === 'retail') {
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 class="text-3xl font-bold text-white">Processing Retail Sales</h2>
              
              <div class="space-y-10">
                <section class="space-y-6">
                  <div class="space-y-4 ml-4 border-l border-white/10 pl-6">
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 1:</span> Open <code class="bg-black/40 px-2 py-0.5 rounded text-white">Point of Sale > Retail POS</code>.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 2:</span> Use the <span class="text-white font-bold italic">Category Filter</span> or <span class="text-white font-bold italic">Search Bar</span> to locate items.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 3:</span> Click an item to add it to the <span class="text-white">Active Cart</span> on the right (on mobile screens, tap the floating cart button to open the order sheet).
                    </div>
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 4:</span> Adjust quantity using the +/- buttons or click the discount icon to lower the price for the specific customer.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 5:</span> Review the subtotal and click <span class="text-white font-bold underline">Checkout Now</span>.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-green-500 font-bold mr-2">Step 6:</span> Select the payment method and confirm. The system will automatically update stock levels and generate a digital receipt.
                    </div>
                  </div>
                </section>
              </div>
            </div>
          }

          <!-- POS WHOLESALE -->
          @if (activeSection() === 'wholesale') {
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 class="text-3xl font-bold text-white">Wholesale & Client Debt</h2>
              
              <div class="space-y-10">
                <section class="space-y-6">
                  <h3 class="text-xl font-bold text-blue-400 ml-4">The Wholesale Flow</h3>
                  <div class="space-y-4 ml-4 border-l border-white/10 pl-6">
                    <div class="text-gray-300">
                      <span class="text-blue-500 font-bold mr-2">Step 1:</span> Open Wholesale POS and FIRST select a <span class="text-white font-bold">Client</span> from the dropdown. Wholesale sales cannot be processed without a linked client.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-blue-500 font-bold mr-2">Step 2:</span> Add wholesale inventory items to the cart (on mobile screens, tap the floating cart button to open the order sheet).
                    </div>
                    <div class="text-gray-300">
                      <span class="text-blue-500 font-bold mr-2">Step 3:</span> During checkout, choose between <span class="text-white italic">Cash Payment</span> or <span class="text-white italic">Record as Debt</span>.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-blue-500 font-bold mr-2">Step 4:</span> If recorded as debt, the amount is automatically added to the client's profile in the <span class="text-blue-100 italic">Clients</span> management module.
                    </div>
                  </div>
                </section>

                <section class="space-y-4">
                  <h3 class="text-xl font-bold text-blue-400 ml-4">Settling Debt</h3>
                  <div class="space-y-3 ml-4 border-l border-white/10 pl-6 text-gray-400 text-sm">
                    <div class="text-gray-300">
                      <span class="text-blue-500 font-bold mr-2">Step 1:</span> Navigate to <span class="text-white">Management > Clients</span>.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-blue-500 font-bold mr-2">Step 2:</span> Find the specific client in the list.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-blue-500 font-bold mr-2">Step 3:</span> Click <span class="text-white font-bold font-mono">Process Payment</span> to record money received against their outstanding balance.
                    </div>
                  </div>
                </section>
              </div>
            </div>
          }

          <!-- EXPENSES -->
          @if (activeSection() === 'expenses') {
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 class="text-3xl font-bold text-white">Logging Operational Expenses</h2>
              
              <div class="space-y-10">
                <section class="space-y-6">
                  <h3 class="text-lg font-bold text-orange-400 bg-orange-400/10 inline-block px-4 py-1 rounded-full">Revenue Validation Rule</h3>
                  <p class="text-gray-400 text-sm ml-4">The platform prevents expenses from exceeding your actual cash-on-hand. You can only record an expense if that amount has already been earned in the counter for the day.</p>
                  
                  <div class="space-y-4 ml-4 border-l border-white/10 pl-6">
                    <div class="text-gray-300">
                      <span class="text-orange-500 font-bold mr-2">Step 1:</span> Navigate to <code class="bg-black/40 px-2 py-0.5 rounded text-white">Management > Expenses</code>.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-orange-500 font-bold mr-2">Step 2:</span> Select the appropriate <span class="text-white">Category</span> (e.g., Salaries, Utilities).
                    </div>
                    <div class="text-gray-300">
                      <span class="text-orange-500 font-bold mr-2">Step 3:</span> Enter the amount. If the amount is larger than today's earnings, the <span class="text-red-400 italic font-mono">Submit</span> button will remain disabled.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-orange-500 font-bold mr-2">Step 4:</span> Once saved, the expense is deducted from your daily **Net Profit** report.
                    </div>
                  </div>
                </section>
              </div>
            </div>
          }

          <!-- REPORTS -->
          @if (activeSection() === 'reports') {
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 class="text-3xl font-bold text-white">Analyzing Reports</h2>
              
              <div class="space-y-10">
                <section class="space-y-4">
                  <h3 class="text-xl font-bold text-emerald-400 flex items-center gap-2">
                    Financial Performance Flow
                  </h3>
                  <div class="space-y-4 ml-4 border-l border-white/10 pl-6">
                    <div class="text-gray-300">
                      <span class="text-emerald-500 font-bold mr-2">Step 1:</span> Choose a <span class="text-white">Date Preset</span> (Today, This Month, etc.) in the top right.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-emerald-500 font-bold mr-2">Step 2:</span> Review the <span class="text-white font-bold">Period Performance Summary</span>. This shows total revenue, total cost, and profit broken down by Retail and Wholesale channels.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-emerald-500 font-bold mr-2">Step 3:</span> Locate the <span class="text-white italic">Actual Net Profit</span> card. This is your final result after all expenses and reversals are subtracted.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-emerald-500 font-bold mr-2">Step 4:</span> Scroll down to see <span class="text-white">Replenishment Alerts</span> for products requiring a restock.
                    </div>
                  </div>
                </section>
              </div>
            </div>
          }

          <!-- ADMIN TOOLS -->
          @if (activeSection() === 'admin' && isAdmin()) {
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 class="text-3xl font-bold text-white">Administrative Operations</h2>
              
              <div class="space-y-10">
                <section class="space-y-4">
                  <h3 class="text-xl font-bold text-red-400 border-b border-red-500/20 pb-2">Reversals & Voids</h3>
                  <div class="space-y-3 ml-4 border-l border-white/10 pl-6">
                    <div class="text-sm text-gray-400 py-2 bg-red-500/5 px-4 rounded-lg border border-red-500/10 mb-4">
                      <strong>Policy Check:</strong> Reversals are only permitted within 24 hours of a transaction.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-red-500 font-bold mr-2">Step 1:</span> Go to <span class="text-white">Management > Reversals</span>.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-red-500 font-bold mr-2">Step 2:</span> Select a reversal request from the list.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-red-500 font-bold mr-2">Step 3:</span> Review the original items. Click <span class="text-white font-bold italic">Approve Reversal</span> to return items to inventory and void the financial record.
                    </div>
                  </div>
                </section>

                <section class="space-y-4">
                  <h3 class="text-xl font-bold text-gray-100">Staff Accountability</h3>
                  <div class="space-y-4 ml-4 border-l border-white/10 pl-6">
                    <div class="text-gray-300">
                      <span class="text-white font-bold mr-2">Step 1:</span> Navigate to <span class="text-white">Admin > User Logs</span>.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-white font-bold mr-2">Step 2:</span> Filter by Date or Search by Staff Name.
                    </div>
                    <div class="text-gray-300">
                      <span class="text-white font-bold mr-2">Step 3:</span> Review the <span class="text-white italic underline italic">Action</span> column to see exactly what change was made.
                    </div>
                  </div>
                </section>
              </div>
            </div>
          }

          <!-- FAQ -->
          @if (activeSection() === 'faq') {
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 class="text-3xl font-bold text-white">General Troubleshooting</h2>
              
              <div class="space-y-6">
                <div class="p-8 rounded-2xl bg-white/5 border border-white/10 space-y-4 text-gray-400">
                  <h4 class="font-bold text-emerald-400 uppercase tracking-widest text-xs">Login Failures</h4>
                  <p class="text-sm">Navigate to <span class="text-white underline">Worker Management</span> and verify that the user account is correctly registered and permission levels are assigned.</p>
                </div>

                <div class="p-8 rounded-2xl bg-white/5 border border-white/10 space-y-4 text-gray-400">
                  <h4 class="font-bold text-emerald-400 uppercase tracking-widest text-xs">Missing Financial Data</h4>
                  <p class="text-sm">If your reports appear empty, check the <span class="text-white italic">Date Filter</span>. Ensure it is set to a period containing recorded sales.</p>
                </div>
              </div>
            </div>
          }

        </div>
      </div>
    </div>
  `
})
export class HelpView {
  private authService = inject(AuthService);
  
  isAdmin = computed(() => this.authService.currentUser()?.role === 'Admin');
  
  activeSection = signal('overview');

  sections: HelpSection[] = [
    { id: 'overview', title: 'Platform Overview', iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'inventory', title: 'Inventory Management', iconPath: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { id: 'retail', title: 'Retail Workflows', iconPath: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
    { id: 'wholesale', title: 'Wholesale & Debt', iconPath: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'expenses', title: 'Operating Expenses', iconPath: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'reports', title: 'Reports & Analytics', iconPath: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', adminOnly: true },
    { id: 'admin', title: 'Administrative Tools', iconPath: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2-2v6a2 2 0 002 2z', adminOnly: true },
    { id: 'faq', title: 'Troubleshooting & FAQ', iconPath: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  visibleSections = computed(() => {
    return this.sections.filter(s => !s.adminOnly || this.isAdmin());
  });
}
