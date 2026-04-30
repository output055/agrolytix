import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-public-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './public-navbar.component.html'
})
export class PublicNavbarComponent implements OnInit, OnDestroy {
  scrolled = false;

  constructor(private router: Router) {}

  ngOnInit() {
    // Initial check
    this.onScroll();
    window.addEventListener('scroll', this.onScroll);
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.onScroll);
  }

  onScroll = () => {
    this.scrolled = window.scrollY > 50;
  }

  handleScroll(elementId: string) {
    if (this.router.url === '/' || this.router.url.startsWith('/#')) {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // Fallback if element not found right away
        this.router.navigate(['/'], { fragment: elementId });
      }
    } else {
      this.router.navigate(['/'], { fragment: elementId });
      // Small timeout to allow routing before scrolling
      setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }
}
