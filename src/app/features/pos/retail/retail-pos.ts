import { Component, effect, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../../core/services/inventory.service';
import { PosService } from '../../../core/services/pos.service';
import { ToastService } from '../../../core/services/toast.service';
import { Product, ProductUnit } from '../../../core/models/inventory.model';
import { CartItem, RetailPosPayload, RetailPosItemPayload } from '../../../core/models/pos.model';
import { ConfirmModal } from '../../../shared/confirm-modal/confirm-modal';

@Component({
  selector: 'app-retail-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModal],
  templateUrl: './retail-pos.html',
  styleUrl: './retail-pos.css'
})
export class RetailPos implements OnInit {
  private inventoryService = inject(InventoryService);
  private posService = inject(PosService);
  private toastService = inject(ToastService);

  products = signal<Product[]>([]);
  cart = signal<CartItem[]>([]);
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('All');

  selectedProduct = signal<Product | null>(null);
  selectedUnit = signal<ProductUnit | 'base' | null>(null);
  itemQuantity = signal<number>(1);

  paymentMethod = signal<'Cash' | 'MoMo'>('Cash');
  paymentMethods: ('Cash' | 'MoMo')[] = ['Cash', 'MoMo'];
  momoNumber = signal<string>('');

  isCheckingOut = signal<boolean>(false);

  // Computed
  categories = computed(() => {
    const cats = [...new Set(this.products().map(p => p.category).filter(Boolean))];
    return ['All', ...cats.sort()];
  });

  // Products sorted by real sales_count from the API (most-sold first),
  // then filtered by search/category. Out-of-stock items sink to the bottom.
  filteredProducts = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const cat = this.selectedCategory();
    return this.products()
      .filter(p =>
        (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) &&
        (cat === 'All' || p.category === cat)
      )
      .sort((a, b) => {
        // Primary: most sold first (API already orders by this, but keep here for safety after local filter)
        const soldDiff = (b.sales_count ?? 0) - (a.sales_count ?? 0);
        if (soldDiff !== 0) return soldDiff;
        // Secondary: in-stock before out-of-stock
        if (a.quantity <= 0 && b.quantity > 0) return 1;
        if (b.quantity <= 0 && a.quantity > 0) return -1;
        return 0;
      });
  });

  cartTotal = computed(() => {
    return this.cart().reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  });

  /** Convenience accessor for the template badge */
  getSalesCount(product: Product): number {
    return product.sales_count ?? 0;
  }

  constructor() {
    // Persist cart across page refreshes
    const savedCart = localStorage.getItem('retail_cart');
    if (savedCart) {
      try {
        this.cart.set(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart from localStorage');
      }
    }

    effect(() => {
      localStorage.setItem('retail_cart', JSON.stringify(this.cart()));
    });
  }

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.inventoryService.getRetailProducts().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : res.data;
        this.products.set(data);
      },
      error: () => this.toastService.show('Failed to load products', 'error')
    });
  }

  openProductSelection(product: Product) {
    if (product.quantity <= 0) {
      this.toastService.show('Product is out of stock', 'warning');
      return;
    }

    if (!product.units || product.units.length === 0) {
      this.selectedProduct.set(product);
      this.selectedUnit.set('base');
      this.itemQuantity.set(1);
      this.addToCart();
      return;
    }

    this.selectedProduct.set(product);
    this.selectedUnit.set('base');
    this.itemQuantity.set(1);
  }

  closeProductSelection() {
    this.selectedProduct.set(null);
    this.selectedUnit.set(null);
    this.itemQuantity.set(1);
  }

  increaseQuantity() {
    const maxQty = this.getMaxQuantityForSelection();
    if (this.itemQuantity() < maxQty) {
      this.itemQuantity.update(q => q + 1);
    }
  }

  decreaseQuantity() {
    if (this.itemQuantity() > 1) {
      this.itemQuantity.update(q => q - 1);
    }
  }

  getMaxQuantityForSelection(): number {
    const product = this.selectedProduct();
    if (!product) return 0;
    
    const unit = this.selectedUnit();
    if (unit === 'base' || !unit) {
      return product.quantity;
    } else {
      // It's a ProductUnit object
      return Math.floor(product.quantity / (unit as ProductUnit).quantity_in_base);
    }
  }

  getPriceForSelection(): number {
    const unit = this.selectedUnit();
    const product = this.selectedProduct();
    if (!product) return 0;

    if (unit === 'base' || !unit) {
        return product.sell_price;
    }
    return (unit as ProductUnit).price;
  }

  addToCart() {
    const product = this.selectedProduct();
    const unit = this.selectedUnit();
    const qty = this.itemQuantity();

    if (!product || !unit) return;

    let unitName = product.base_unit;
    let unitPrice = product.sell_price;
    let qtyBase = qty;
    let isBulk = false;

    if (unit !== 'base') {
      const u = unit as ProductUnit;
      unitName = u.unit_name;
      unitPrice = u.price;
      qtyBase = qty * u.quantity_in_base;
      isBulk = u.is_bulk;
    }

    // Check if we are exceeding total stock with what's already in the cart
    const currentInCartBase = this.cart().filter(c => c.product_id === product.id).reduce((sum, c) => sum + c.quantity_base, 0);
    if (currentInCartBase + qtyBase > product.quantity) {
      this.toastService.show('Adding this would exceed available stock limit', 'error');
      return;
    }

    const newItem: CartItem = {
      cart_id: Math.random().toString(36).substr(2, 9),
      product_id: product.id,
      name: product.name,
      unit_name: unitName,
      quantity: qty,
      quantity_base: qtyBase,
      unit_price: unitPrice,
      cost_price: product.cost_price, // Will be correct unless cost price varies per unit (usually cost price is base)
      is_bulk: isBulk,
      max_stock_base: product.quantity,
      max_stock_unit: this.getMaxQuantityForSelection()
    };

    if (unit !== 'base') {
      const u = unit as ProductUnit;
      // Calculate scaled cost price
      newItem.cost_price = product.cost_price * u.quantity_in_base;
    }

    const existingMatch = this.cart().find(c => c.product_id === product.id && c.unit_name === unitName);

    if (existingMatch) {
      this.cart.update(items => items.map(item => {
        if (item.cart_id === existingMatch.cart_id) {
          return { ...item, quantity: item.quantity + qty, quantity_base: item.quantity_base + qtyBase };
        }
        return item;
      }));
    } else {
      this.cart.update(items => [...items, newItem]);
    }

    this.closeProductSelection();
  }

  removeFromCart(cartId: string) {
    this.cart.update(items => items.filter(i => i.cart_id !== cartId));
  }

  increaseCartItemQty(cartId: string) {
    this.cart.update(items => items.map(item => {
      if (item.cart_id === cartId) {
        const unitsPerItem = item.quantity > 0 ? item.quantity_base / item.quantity : 1;
        const currentInCartBase = items.filter(c => c.product_id === item.product_id).reduce((sum, c) => sum + c.quantity_base, 0);
        if (currentInCartBase + unitsPerItem > item.max_stock_base) {
          this.toastService.show('Adding this would exceed available stock limit', 'error');
          return item;
        }
        return { ...item, quantity: item.quantity + 1, quantity_base: item.quantity_base + unitsPerItem };
      }
      return item;
    }));
  }

  decreaseCartItemQty(cartId: string) {
    this.cart.update(items => items.map(item => {
      if (item.cart_id === cartId) {
        if (item.quantity > 1) {
          const unitsPerItem = item.quantity_base / item.quantity;
          return { ...item, quantity: item.quantity - 1, quantity_base: item.quantity_base - unitsPerItem };
        }
      }
      return item;
    }));
  }

  clearCart() {
    this.cart.set([]);
    this.momoNumber.set('');
    this.paymentMethod.set('Cash');
  }

  checkout() {
    if (this.cart().length === 0) return;
    
    this.isCheckingOut.set(true);

    const payload: RetailPosPayload = {
      payment_method: this.paymentMethod(),
      momo_number: this.paymentMethod() === 'MoMo' ? this.momoNumber() : undefined,
      items: this.cart().map(item => ({
        product_id: item.product_id!,
        unit_name: item.unit_name,
        quantity: item.quantity,
        quantity_base: item.quantity_base,
        unit_price: item.unit_price,
        cost_price: item.cost_price
      }))
    };

    this.posService.retailCheckout(payload).subscribe({
      next: (res) => {
        this.toastService.show('Checkout successful!', 'success');
        this.clearCart();
        this.loadProducts(); // refresh stock
        this.isCheckingOut.set(false);
      },
      error: (err) => {
        this.toastService.show(err.error?.message || 'Checkout failed', 'error');
        this.isCheckingOut.set(false);
      }
    });
  }
}
