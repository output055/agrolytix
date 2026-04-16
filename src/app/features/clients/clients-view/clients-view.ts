import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientService } from '../../../core/services/client.service';
import { ToastService } from '../../../core/services/toast.service';
import { Client } from '../../../core/models/client.model';
import { ConfirmModal } from '../../../shared/confirm-modal/confirm-modal';

@Component({
  selector: 'app-clients-view',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModal],
  templateUrl: './clients-view.html',
  styleUrl: './clients-view.css'
})
export class ClientsView implements OnInit {
  private clientService = inject(ClientService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  clients: Client[] = [];
  loading = false;
  searchQuery = '';

  // Form Modal State
  showModal = false;
  editingId: number | null = null;
  form: Partial<Client> = {
    name: '',
    contact: '',
    location: '',
    email: ''
  };
  submitting = false;

  // Delete Modal State
  showDeleteModal = false;
  clientToDelete: Client | null = null;
  deleting = false;

  get filteredClients() {
    let list = this.clients;
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        (c.contact && c.contact.toLowerCase().includes(q)) ||
        (c.location && c.location.toLowerCase().includes(q))
      );
    }
    return list;
  }

  ngOnInit() {
    this.loadClients();
  }

  loadClients() {
    this.loading = true;
    this.cdr.detectChanges();
    this.clientService.getClients().subscribe({
      next: (res) => {
        this.clients = res;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastService.show('Failed to load clients', 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openAddModal() {
    this.editingId = null;
    this.form = { name: '', contact: '', location: '', email: '' };
    this.showModal = true;
  }

  openEditModal(client: Client) {
    this.editingId = client.id;
    this.form = { 
      name: client.name, 
      contact: client.contact || '', 
      location: client.location || '', 
      email: client.email || '' 
    };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  saveClient() {
    if (!this.form.name) return;
    this.submitting = true;
    
    if (this.editingId) {
      this.clientService.updateClient(this.editingId, this.form).subscribe({
        next: (updated) => {
          this.toastService.show('Client updated successfully', 'success');
          // Update locally to avoid full reload
          const index = this.clients.findIndex(c => c.id === updated.id);
          if (index !== -1) {
            this.clients[index] = { ...this.clients[index], ...updated };
          }
          this.closeModal();
          this.submitting = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toastService.show(err.error?.message || 'Failed to update client', 'error');
          this.submitting = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.clientService.createClient(this.form).subscribe({
        next: (created) => {
          this.toastService.show('Client added successfully', 'success');
          // Update locally
          this.clients = [created, ...this.clients];
          this.closeModal();
          this.submitting = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toastService.show(err.error?.message || 'Failed to add client', 'error');
          this.submitting = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  confirmDelete(client: Client) {
    this.clientToDelete = client;
    this.showDeleteModal = true;
  }

  executeDelete() {
    if (!this.clientToDelete) return;
    this.deleting = true;
    this.clientService.deleteClient(this.clientToDelete.id).subscribe({
      next: () => {
        this.toastService.show('Client deleted', 'info');
        this.clients = this.clients.filter(c => c.id !== this.clientToDelete!.id);
        this.showDeleteModal = false;
        this.clientToDelete = null;
        this.deleting = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastService.show('Failed to delete client', 'error');
        this.deleting = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancelDelete() {
    this.showDeleteModal = false;
    this.clientToDelete = null;
  }
}
