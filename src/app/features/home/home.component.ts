import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ContactService } from '../../core/services/contact.service';
import { ToastService } from '../../core/services/toast.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private contactService = inject(ContactService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  contactForm = { name: '', email: '', message: '' };
  contactLoading = false;
  contactSuccess = false;

  ngOnInit() {
    if (this.auth.currentUser()) {
      if (this.auth.isSuperAdmin()) {
        this.router.navigate(['/super-admin/dashboard']);
      } else {
        this.router.navigate(['/dashboard']);
      }
    }
  }

  scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  submitContact() {
    if (!this.contactForm.name || !this.contactForm.email || !this.contactForm.message) return;
    this.contactLoading = true;
    this.cdr.detectChanges();
    
    this.contactService.submitMessage(this.contactForm).subscribe({
      next: () => {
        this.contactLoading = false;
        this.contactSuccess = true;
        this.contactForm = { name: '', email: '', message: '' };
        this.cdr.detectChanges();
      },
      error: () => {
        this.contactLoading = false;
        this.cdr.detectChanges();
        this.toast.show('There was an error sending your message. Please try again.', 'error');
      }
    });
  }
}
