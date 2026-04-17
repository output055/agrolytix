import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  public currentUser = signal<any>(null);

  constructor(private http: HttpClient, private router: Router) {
    this.restoreSession();
  }

  login(credentials: { email: string; password: string }) {
    return this.http.post<{ user: any; token: string }>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('auth_user', JSON.stringify(res.user));
        this.currentUser.set(res.user);
        this.router.navigate(['/dashboard']);
      })
    );
  }

  hasPermission(permission: string): boolean {
    const user = this.currentUser();
    if (!user) return false;
    if (user.role === 'Admin') return true;
    if (user.permissions && Array.isArray(user.permissions)) {
      return user.permissions.includes(permission);
    }
    return false;
  }

  logout() {
    return this.http.post(`${this.apiUrl}/logout`, {}).pipe(
      tap(() => this.clearAuth())
    );
  }

  private restoreSession() {
    const userStr = localStorage.getItem('auth_user');
    const token   = localStorage.getItem('auth_token');
    if (userStr) {
      try { this.currentUser.set(JSON.parse(userStr)); } catch {}
    }
    if (token) {
      this.http.get<any>(`${this.apiUrl}/user`).subscribe({
        next: user => {
          localStorage.setItem('auth_user', JSON.stringify(user));
          this.currentUser.set(user);
        },
        error: () => this.clearAuth()
      });
    }
  }

  private clearAuth() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this.currentUser.set(null);
    this.router.navigate(['/auth']);
  }
}
