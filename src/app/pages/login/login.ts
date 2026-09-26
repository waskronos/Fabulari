import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { User } from '../../services/user';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse } from '../../models/user.model';

@Component({
  imports: [FormsModule],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {

  private userService = inject(User);
  private router = inject(Router);
  
  username: string = '';
  password: string = '';
  feedbackMessage: string = '';
  
  login(){
    this.feedbackMessage = '';

    const loginData: LoginRequest = {
      username: this.username,
      password: this.password
    };

  this.userService.loginUser(loginData).subscribe({
    next: (response: LoginResponse) => {
      localStorage.setItem('currentUser', JSON.stringify(response.user));
      this.router.navigate(['/dashboard']);
    },
    error: (error: HttpErrorResponse) => {
      this.feedbackMessage = error.error?.message ?? 'Login failed. Please try again.';
    }
    });
  }
}
