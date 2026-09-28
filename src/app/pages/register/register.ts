import { inject, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { User } from '../../services/user';
import { ApiMessage, RegisterRequest } from '../../models/user.model';

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
  dateOfBirth: string = '';
  password: string = '';
  feedbackMessage = signal('');
  feedbackType = signal<'success' | 'error'>('success');

  register() {
    this.feedbackMessage.set('');

    if (!this.dateOfBirth) {
      this.showFeedback('Please enter your date of birth.', 'error');
      return;
    }

    if (new Date(`${this.dateOfBirth}T00:00:00`) > new Date()) {
      this.showFeedback('Date of birth cannot be in the future.', 'error');
      return;
    }

    const user: RegisterRequest = {
      username: this.username,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      dateOfBirth: this.dateOfBirth,
      password: this.password
    };

    this.userService.registerUser(user).subscribe({
      next: (response: ApiMessage) => {
        this.showFeedback(response.message, 'success');
      },
      error: (error: HttpErrorResponse) => {
        this.showFeedback(
          error.error?.message ?? 'Registration failed. Please try again.',
          'error'
        );
      }
    });
  }

  private showFeedback(message: string, type: 'success' | 'error') {
    this.feedbackMessage.set(message);
    this.feedbackType.set(type);
  }
}
