import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
})
export class Login {
  private auth   = inject(AuthService);
  private router = inject(Router);

  email    = '';
  password = '';
  loading  = signal(false);
  error    = signal('');

  submit() {
    this.error.set('');
    this.loading.set(true);
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next:  () => this.loading.set(false),
      error: (e) => {
        this.loading.set(false);
        this.error.set(e.error?.message ?? 'Login failed. Check your credentials.');
      }
    });
  }
}
