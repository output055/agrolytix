import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
})
export class Register {
  private auth   = inject(AuthService);
  private router = inject(Router);

  business_name  = '';
  business_email = '';
  admin_name     = '';
  email          = '';
  password       = '';
  loading        = signal(false);
  error          = signal('');

  submit() {
    this.error.set('');
    this.loading.set(true);
    
    const payload = {
      business_name: this.business_name,
      business_email: this.business_email,
      admin_name: this.admin_name,
      email: this.email,
      password: this.password
    };

    this.auth.register(payload).subscribe({
      next:  () => this.loading.set(false),
      error: (e) => {
        this.loading.set(false);
        this.error.set(e.error?.message ?? 'Registration failed. Please check your details.');
      }
    });
  }
}
