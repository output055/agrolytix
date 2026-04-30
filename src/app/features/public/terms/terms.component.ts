import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PublicNavbarComponent } from '../../../layout/public-navbar/public-navbar.component';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink, CommonModule, PublicNavbarComponent],
  templateUrl: './terms.component.html',
})
export class TermsComponent {
  scrolled = false;

  ngOnInit() {
    window.addEventListener('scroll', this.onScroll);
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.onScroll);
  }

  onScroll = () => {
    this.scrolled = window.scrollY > 50;
  }
}
