import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-landing',
  styleUrl: './landing.css',
  templateUrl: './landing.html',
})
export class Landing implements OnInit {
  private router = inject(Router);
  title = 'FABULARI';

  ngOnInit() {
    if (localStorage.getItem('currentUser')) {
      this.router.navigate(['/home']);
    }
  }
}
