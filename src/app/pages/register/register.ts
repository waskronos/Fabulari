import { inject, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { User } from '../../services/user';

@Component({
  imports: [FormsModule],
  selector: 'app-register',
  styleUrl: './register.css',
  templateUrl: './register.html',
})
export class Register {

  private userService = inject(User);
  
  username: string = '';
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  age: number | null = null;
  password: string = '';

  register(){
    const user = {
      username: this.username,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      age: this.age,
      password: this.password
    };
    this.userService.registerUser(user).subscribe({
      next: (response) => {
        console.log('User registered successfully:', response);
      },
      error: (error) => {
        console.error('Error registering user:', error);
      }
    })
    }
  }

