import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientService } from '../../../core/services/client.service';
import { SalesService } from '../../../core/services/sales.service';
import { ToastService } from '../../../core/services/toast.service';
import { Client } from '../../../core/models/client.model';
import { WholesaleSale } from '../../../core/models/sales.model';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-detail.html',
  styleUrl: './client-detail.css'
})
export class ClientDetailComponent implements OnInit {
  private clientService = inject(ClientService);
  private salesService = inject(SalesService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  client: Client | null = null;
  clientSales: WholesaleSale[] = [];
  loading = false;
  clientId: number = 0;

  // Payment Modal State
  showPaymentModal = false;
  selectedSale: WholesaleSale | null = null;
  paymentForm = {
    amount_paid: 0,
    note: ''
  };
  paymentProcessing = false;

  // Tab State
  activeTab: 'unpaid' | 'all' | 'history' = 'unpaid';

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.clientId = parseInt(params['id'], 10);
      this.loadClientDetails();
    });
  }

  loadClientDetails() {
    this.loading = true;
    this.cdr.detectChanges();

    this.clientService.getClient(this.clientId).subscribe({
      next: (client) => {
        this.client = client;
        this.loadClientSales();
      },
      error: () => {
        this.toastService.show('Failed to load client', 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadClientSales() {
    this.salesService.getWholesaleSales({ preset: '', client_id: this.clientId }).subscribe({
      next: (res) => {
        this.clientSales = res.data || res;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastService.show('Failed to load sales', 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get unpaidSales() {
    return this.clientSales.filter(s => s.debt > 0);
  }

  get allPayments() {
    const payments: any[] = [];
    this.clientSales.forEach(sale => {
      if (sale.debtPayments) {
        sale.debtPayments.forEach(payment => {
          payments.push({
            ...payment,
            saleId: sale.id,
            receiptNumber: sale.receipt_number,
            created_at: payment.created_at
          });
        });
      }
    });
    return payments.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  openPaymentModal(sale: WholesaleSale) {
    this.selectedSale = sale;
    this.paymentForm = { amount_paid: sale.debt, note: '' };
    this.showPaymentModal = true;
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.selectedSale = null;
    this.paymentForm = { amount_paid: 0, note: '' };
  }

  recordPayment() {
    if (!this.selectedSale || this.paymentForm.amount_paid <= 0) {
      this.toastService.show('Please enter a valid amount', 'error');
      return;
    }

    if (this.paymentForm.amount_paid > this.selectedSale.debt) {
      this.toastService.show('Payment cannot exceed remaining debt', 'error');
      return;
    }

    this.paymentProcessing = true;
    this.cdr.detectChanges();

    this.salesService.payWholesaleDebt(this.selectedSale.id, {
      amount_paid: this.paymentForm.amount_paid,
      note: this.paymentForm.note
    }).subscribe({
      next: () => {
        this.toastService.show('Payment recorded successfully', 'success');
        this.closePaymentModal();
        this.loadClientSales();
        this.paymentProcessing = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastService.show('Failed to record payment: ' + (err?.error?.message || 'Unknown error'), 'error');
        this.paymentProcessing = false;
        this.cdr.detectChanges();
      }
    });
  }

  goBack() {
    this.router.navigate(['/clients']);
  }
}
