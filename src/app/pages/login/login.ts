import { Component, inject } from '@angular/core';
import { User } from '../../services/user';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

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
  
  login(){
    const loginData = {
    username: this.username,
    password: this.password
    };

  this.userService.loginUser(loginData).subscribe({
    next: (response: any) => {
      console.log('User logged in successfully:', response);

      localStorage.setItem('currentUser', JSON.stringify(response.user));
      this.router.navigate(['/dashboard']);
    },
    error: (error) => {
      console.error('Error logging in user:', error);
    }
    });
  };
}
