import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Header } from '../header/header';
import { LayoutService } from '../../core/services/layout.service';
import { Toast } from '../../shared/toast/toast';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Header, Toast],
  templateUrl: './app-layout.html',
})
export class AppLayout {
  layoutService = inject(LayoutService);
}
