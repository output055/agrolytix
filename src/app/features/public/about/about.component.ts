import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PublicNavbarComponent } from '../../../layout/public-navbar/public-navbar.component';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, CommonModule, PublicNavbarComponent],
  templateUrl: './about.component.html',
})
export class AboutComponent {
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
