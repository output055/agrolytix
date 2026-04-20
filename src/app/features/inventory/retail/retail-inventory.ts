import { Component, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';

import { Product, PaginatedResponse } from '../../../core/models/inventory.model';
import { ConfirmModal } from '../../../shared/confirm-modal/confirm-modal';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'app-retail-inventory',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ConfirmModal],
  template: `
    <div class="mb-6 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold" style="color: #f0fdf4;">Retail Inventory</h1>
        <p class="text-sm" style="color: #9ca3af;">Manage retail products, stock levels, and pricing.</p>
      </div>
      @if (isAdmin) {
        <button (click)="openForm()" 
                class="px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2"
                style="background: #4ade80; color: #064e3b;">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          Add Product
        </button>
      }
    </div>

    <!-- KPI / Stats Summary -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      <div class="rounded-2xl p-5 border" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);">
        <div class="text-sm font-medium mb-1" style="color: #9ca3af;">Total Products</div>
        <div class="text-3xl font-bold" style="color: #f0fdf4;">{{ overallStats?.total || totalItems }}</div>
      </div>
      <div class="rounded-2xl p-5 border" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);">
        <div class="text-sm font-medium mb-1" style="color: #9ca3af;">Low Stock Alerts</div>
        <div class="text-3xl font-bold" style="color: #f59e0b;">{{ overallStats?.low_stock_count || 0 }}</div>
      </div>
      @if (isAdmin) {
        <div class="rounded-2xl p-5 border" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);">
          <div class="text-sm font-medium mb-1" style="color: #9ca3af;">Total Cost Value (GH₵)</div>
          <div class="text-3xl font-bold" style="color: #60a5fa;">{{ (overallStats?.total_cost_value || 0) | number:'1.2-2' }}</div>
        </div>
      }
      <div class="rounded-2xl p-5 border" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);">
        <div class="text-sm font-medium mb-1" style="color: #9ca3af;">Total Selling Value (GH₵)</div>
        <div class="text-3xl font-bold" style="color: #4ade80;">{{ (overallStats?.total_selling_value || 0) | number:'1.2-2' }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="mb-4 flex flex-col sm:flex-row gap-4 justify-between items-center p-2">
      <div class="relative w-full sm:w-96">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 absolute left-3 top-2.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input type="text" placeholder="Search products or categories..." 
               (input)="onSearch($event)"
               class="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-green-400 transition-colors">
      </div>
    </div>

    <!-- Data Table -->
    <div class="rounded-2xl border overflow-hidden" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm" style="color: #d1d5db;">
          <thead class="text-xs uppercase border-b" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05); color: #9ca3af;">
            <tr>
              <th class="px-6 py-4 font-medium cursor-pointer hover:text-white" (click)="sortBy('name')">
                Product <span *ngIf="sortColumn === 'name'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
              </th>
              <th class="px-6 py-4 font-medium cursor-pointer hover:text-white" (click)="sortBy('category')">
                Category <span *ngIf="sortColumn === 'category'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
              </th>
              <th class="px-6 py-4 font-medium cursor-pointer hover:text-white" (click)="sortBy('sell_price')">
                Price <span *ngIf="sortColumn === 'sell_price'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
              </th>
              <th class="px-6 py-4 font-medium cursor-pointer hover:text-white" (click)="sortBy('quantity')">
                Stock <span *ngIf="sortColumn === 'quantity'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
              </th>
              <th class="px-6 py-4 font-medium cursor-pointer hover:text-white" (click)="sortBy('last_added_qty')">
                Last Added <span *ngIf="sortColumn === 'last_added_qty'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
              </th>
              <th class="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y" style="border-color: rgba(255,255,255,0.05);">
            @for (product of products; track product.id) {
              <tr class="hover:bg-white/5 transition-colors">
                <td class="px-6 py-4">
                  <div class="font-medium" style="color: #f0fdf4;">{{ product.name }}</div>
                  <div class="text-xs mt-1 opacity-70">
                    {{ product.base_unit }} 
                    @if (isAdmin) { • Cost: GH₵{{ product.cost_price }} }
                  </div>
                </td>
                <td class="px-6 py-4">
                  <span class="px-2 py-1 rounded text-xs" style="background: rgba(255,255,255,0.1);">
                    {{ product.category || 'Uncategorized' }}
                  </span>
                </td>
                <td class="px-6 py-4 font-medium" style="color: #4ade80;">
                  GH₵{{ product.sell_price | number:'1.2-2' }}
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2">
                    <span [class.text-red-400]="isLowStock(product)">
                      {{ product.quantity }} {{ product.base_unit }}s
                    </span>
                    @if (isLowStock(product)) {
                      <span title="Low Stock Alert" class="w-2 h-2 rounded-full" style="background: #dc2626;"></span>
                    }
                  </div>
                </td>
                <td class="px-6 py-4 text-gray-400">
                  {{ product.last_added_qty || 0 }} {{ product.base_unit }}s
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-3">
                    <button (click)="openRestock(product)" title="Restock" class="text-amber-400 hover:text-amber-300 font-medium transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                    @if (isAdmin) {
                      <button (click)="openForm(product)" title="Edit" class="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button (click)="openDelete(product)" title="Delete" class="text-red-400 hover:text-red-300 font-medium transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-500">
                  No retail products found.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="px-6 py-4 flex items-center justify-between border-t border-white/5 bg-white/5">
        <div class="text-xs text-gray-400">
          Showing <span class="text-white">{{ (currentPage - 1) * perPage + 1 }}</span> to 
          <span class="text-white">{{ Math.min(currentPage * perPage, totalItems) }}</span> of 
          <span class="text-white">{{ totalItems }}</span> products
        </div>
        <div class="flex gap-2">
          <button (click)="changePage(currentPage - 1)" 
                  [disabled]="currentPage === 1"
                  class="p-2 rounded-lg bg-black/20 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          
          <div class="flex items-center gap-1">
            @for (p of [].constructor(lastPage); track i; let i = $index) {
              @if (i + 1 === 1 || i + 1 === lastPage || (i + 1 >= currentPage - 1 && i + 1 <= currentPage + 1)) {
                <button (click)="changePage(i + 1)"
                      [class.bg-green-500]="currentPage === i + 1"
                      [class.text-green-950]="currentPage === i + 1"
                      class="w-8 h-8 rounded-lg text-xs font-bold transition-all hover:bg-green-500/20">
                  {{ i + 1 }}
                </button>
              } @else if (i + 1 === 2 || i + 1 === lastPage - 1) {
                <span class="px-1 text-gray-600">...</span>
              }
            }
          </div>

          <button (click)="changePage(currentPage + 1)" 
                  [disabled]="currentPage === lastPage"
                  class="p-2 rounded-lg bg-black/20 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Product Form Modal -->
    @if (showFormModal) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div class="rounded-2xl p-6 w-full max-w-2xl border shadow-2xl relative my-auto"
             style="background: #111d11; border-color: rgba(255,255,255,0.1);">
          
          <button (click)="closeForm()" class="absolute top-4 right-4 text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h3 class="text-xl font-bold mb-6" style="color: #f0fdf4;">
            {{ editingProduct ? 'Edit Product' : 'Add New Product' }}
          </h3>

          <form [formGroup]="productForm" (ngSubmit)="submitForm()">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label class="block text-xs font-medium mb-1 text-gray-400">Name *</label>
                <input type="text" formControlName="name" 
                       class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-400">
              </div>
              <div>
                <label class="block text-xs font-medium mb-1 text-gray-400">Category</label>
                <input type="text" list="agro-categories" formControlName="category" placeholder="Search or type..."
                       class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-400">
                <datalist id="agro-categories">
                  <option value="Fertilizers"></option>
                  <option value="Weedicides"></option>
                  <option value="Herbicides"></option>
                  <option value="Pesticides"></option>
                  <option value="Fungicides"></option>
                  <option value="Insecticides"></option>
                  <option value="Seeds"></option>
                  <option value="Machinery"></option>
                  <option value="Animal Feed"></option>
                  <option value="Tools"></option>
                </datalist>
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-medium mb-1 text-gray-400">Description</label>
                <input type="text" formControlName="description" 
                       class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-400">
              </div>
              
              <div>
                <label class="block text-xs font-medium mb-1 text-gray-400">Base Unit (e.g., Bottle, Piece) *</label>
                <input type="text" formControlName="base_unit" 
                       class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-400">
              </div>
              <div>
                <label class="block text-xs font-medium mb-1 text-gray-400">Current Stock *</label>
                <input type="number" formControlName="quantity" 
                       class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-400">
              </div>

              <div>
                <label class="block text-xs font-medium mb-1 text-gray-400">Cost Price (GH₵) *</label>
                <input type="number" formControlName="cost_price" 
                       class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-400">
              </div>
              <div>
                <label class="block text-xs font-medium mb-1 text-gray-400">Selling Price (GH₵) *</label>
                <input type="number" formControlName="sell_price" 
                       class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-400">
              </div>

              <div>
                <label class="block text-xs font-medium mb-1 text-gray-400">Low Stock Alert Level</label>
                <input type="number" formControlName="low_stock_alert" 
                       class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-400">
              </div>
            </div>

            <div class="mb-6">
              <div class="flex justify-between items-center mb-3">
                <h4 class="text-sm font-semibold text-white">Secondary Units / Bulk Pricing</h4>
                <button type="button" (click)="addUnit()" class="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-lg hover:bg-green-500/30 transition">
                  + Add Unit
                </button>
              </div>
              
              <div formArrayName="units" class="space-y-3">
                @for (unitCtrl of units.controls; track i; let i = $index) {
                  <div [formGroupName]="i" class="flex gap-3 items-end bg-black/20 p-3 rounded-xl border border-white/5 relative group">
                    <button type="button" (click)="removeUnit(i)" class="absolute -right-2 -top-2 bg-red-500/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                    </button>
                    <div class="flex-1">
                      <label class="block text-[10px] font-medium mb-1 text-gray-500">Unit Name</label>
                      <input type="text" formControlName="unit_name" placeholder="e.g. Box" class="w-full bg-transparent border-b border-white/10 px-1 py-1 text-sm text-white focus:outline-none focus:border-green-400">
                    </div>
                    <div class="flex-1">
                      <label class="block text-[10px] font-medium mb-1 text-gray-500">Qty in Base</label>
                      <input type="number" formControlName="quantity_in_base" placeholder="e.g. 12" class="w-full bg-transparent border-b border-white/10 px-1 py-1 text-sm text-white focus:outline-none focus:border-green-400">
                    </div>
                    <div class="flex-1">
                      <label class="block text-[10px] font-medium mb-1 text-gray-500">Price (GH₵)</label>
                      <input type="number" formControlName="price" class="w-full bg-transparent border-b border-white/10 px-1 py-1 text-sm text-white focus:outline-none focus:border-green-400">
                    </div>
                    <div class="w-16 flex flex-col items-center pb-2">
                      <label class="block text-[10px] font-medium mb-2 text-gray-500">Is Bulk?</label>
                      <input type="checkbox" formControlName="is_bulk" class="accent-green-500">
                    </div>
                  </div>
                }
                @if(units.controls.length === 0) {
                  <p class="text-xs text-gray-500 italic">No secondary units configured. Product is only sold by base unit.</p>
                }
              </div>
            </div>

            <div class="flex justify-end gap-3 mt-8">
              <button type="button" (click)="closeForm()" class="px-5 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button type="submit" [disabled]="productForm.invalid || isSubmitting" 
                      class="px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
                      style="background: #4ade80; color: #064e3b;">
                {{ isSubmitting ? 'Saving...' : 'Save Product' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Restock Modal -->
    @if (showRestockModal && selectedProduct) {
       <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="rounded-2xl p-6 w-full max-w-sm border shadow-2xl relative"
             style="background: #111d11; border-color: rgba(255,255,255,0.1);">
          <h3 class="text-lg font-bold mb-1" style="color: #f0fdf4;">Restock {{ selectedProduct.name }}</h3>
          <p class="text-xs text-gray-400 mb-4">Current stock: {{ selectedProduct.quantity }} {{ selectedProduct.base_unit }}s</p>
          
          <div class="mb-6">
            <label class="block text-xs font-medium mb-1 text-gray-400">Add Quantity ({{ selectedProduct.base_unit }}s) *</label>
            <input type="number" [formControl]="restockControl" 
                   class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-amber-400">
          </div>

          <div class="flex justify-end gap-3">
            <button (click)="closeRestock()" class="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button (click)="submitRestock()" [disabled]="restockControl.invalid || (restockControl.value || 0) <= 0 || isSubmitting"
                    class="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 bg-amber-500 text-black">
              {{ isSubmitting ? '...' : 'Add Stock' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete Confirmation -->
    <app-confirm-modal 
      [visible]="showDeleteModal"
      title="Delete Product?"
      [message]="'Are you sure you want to completely remove ' + (selectedProduct?.name || '') + '? This cannot be undone.'"
      (confirm)="submitDelete()"
      (cancel)="closeDelete()">
    </app-confirm-modal>
  `
})
export class RetailInventory implements OnInit, OnDestroy {
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);

  Math = Math;
  products: Product[] = [];
  selectedProduct: Product | null = null;
  
  searchTerm = '';
  sortColumn: keyof Product | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Pagination state
  currentPage = 1;
  totalItems = 0;
  perPage = 10;
  lastPage = 1;
  overallStats: any = null;

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  showFormModal = false;
  showRestockModal = false;
  showDeleteModal = false;
  isSubmitting = false;

  productForm: FormGroup;
  restockControl = this.fb.control(0, [Validators.required, Validators.min(1)]);

  get editingProduct(): boolean {
    return !!this.selectedProduct;
  }

  get units(): FormArray {
    return this.productForm.get('units') as FormArray;
  }

  get isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'Admin';
  }

  constructor() {
    this.productForm = this.fb.group({
      name: ['', Validators.required],
      category: [''],
      description: [''],
      base_unit: ['', Validators.required],
      quantity: [0, [Validators.required, Validators.min(0)]],
      cost_price: [0, [Validators.required, Validators.min(0)]],
      sell_price: [0, [Validators.required, Validators.min(0)]],
      low_stock_alert: [10],
      units: this.fb.array([])
    });

    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.searchTerm = term;
      this.currentPage = 1;
      this.loadProducts();
    });
  }

  ngOnInit() {
    this.loadProducts();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(event: any) {
    this.searchSubject.next(event.target.value);
  }

  loadProducts() {
    const params = {
      paginate: 1,
      page: this.currentPage,
      per_page: this.perPage,
      search: this.searchTerm,
      sort_column: this.sortColumn,
      sort_direction: this.sortDirection
    };

    this.inventoryService.getRetailProducts(params).subscribe({
      next: (res: any) => {
        const paginated = res as PaginatedResponse<Product>;
        this.products = paginated.data;
        this.totalItems = paginated.total;
        this.currentPage = paginated.current_page;
        this.lastPage = paginated.last_page;
        this.overallStats = paginated.stats;
        this.cdr.detectChanges();
      },
      error: () => this.toastService.error('Failed to load retail products')
    });
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.lastPage) {
      this.currentPage = page;
      this.loadProducts();
    }
  }

  isLowStock(product: Product): boolean {
    return product.quantity <= (product.low_stock_alert || 0);
  }

  sortBy(column: keyof Product) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.loadProducts();
  }

  // --- Form Actions ---

  openForm(product?: Product) {
    this.selectedProduct = product || null;
    this.productForm.reset({ quantity: 0, cost_price: 0, sell_price: 0, low_stock_alert: 10 });
    this.units.clear();

    if (this.selectedProduct) {
      this.productForm.patchValue(this.selectedProduct);
      if (this.selectedProduct.units) {
        this.selectedProduct.units.forEach(u => this.addUnit(u));
      }
    }
    
    this.showFormModal = true;
  }

  closeForm() {
    this.showFormModal = false;
    this.selectedProduct = null;
  }

  addUnit(initialData?: any) {
    this.units.push(this.fb.group({
      unit_name: [initialData?.unit_name || '', Validators.required],
      quantity_in_base: [initialData?.quantity_in_base || 1, [Validators.required, Validators.min(1)]],
      price: [initialData?.price || 0, [Validators.required, Validators.min(0)]],
      is_bulk: [initialData?.is_bulk || false],
      bulk_discount_pct: [initialData?.bulk_discount_pct || 0]
    }));
  }

  removeUnit(index: number) {
    this.units.removeAt(index);
  }

  submitForm() {
    if (this.productForm.invalid) return;
    
    this.isSubmitting = true;
    const payload = this.productForm.value;

    const request = this.selectedProduct 
      ? this.inventoryService.updateRetailProduct(this.selectedProduct.id, payload)
      : this.inventoryService.createRetailProduct(payload);

    request.subscribe({
      next: (res) => {
        this.toastService.success(`Product ${this.selectedProduct ? 'updated' : 'created'} successfully`);
        this.loadProducts();
        this.closeForm();
        this.isSubmitting = false;
      },
      error: (err) => {
        this.toastService.error(err.error?.message || 'Failed to save product');
        this.isSubmitting = false;
      }
    });
  }

  // --- Restock Actions ---

  openRestock(product: Product) {
    this.selectedProduct = product;
    this.restockControl.reset(0);
    this.showRestockModal = true;
  }

  closeRestock() {
    this.showRestockModal = false;
    this.selectedProduct = null;
  }

  submitRestock() {
    if (this.restockControl.invalid || !this.selectedProduct) return;
    
    this.isSubmitting = true;
    this.inventoryService.restockRetailProduct(this.selectedProduct.id, this.restockControl.value || 0).subscribe({
      next: () => {
        this.toastService.success('Stock added successfully');
        this.loadProducts();
        this.closeRestock();
        this.isSubmitting = false;
      },
      error: () => {
        this.toastService.error('Failed to update stock');
        this.isSubmitting = false;
      }
    });
  }

  // --- Delete Actions ---

  openDelete(product: Product) {
    this.selectedProduct = product;
    this.showDeleteModal = true;
  }

  closeDelete() {
    this.showDeleteModal = false;
    this.selectedProduct = null;
  }

  submitDelete() {
    if (!this.selectedProduct) return;
    
    this.inventoryService.deleteRetailProduct(this.selectedProduct.id).subscribe({
      next: () => {
        this.toastService.success('Product deleted');
        this.loadProducts();
        this.closeDelete();
      },
      error: () => {
        this.toastService.error('Failed to delete product');
        this.closeDelete();
      }
    });
  }
}

