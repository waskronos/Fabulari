import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { sessionOptions } from './access';
import {
  ApiMessage,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ProfileRequest,
  PasswordRequest,
} from '../models/user.model';

@Service()
export class User {
    private http = inject(HttpClient);

    registerUser(user: RegisterRequest) {
      return this.http.post<ApiMessage>('http://localhost:3000/api/users', user);
    }

    loginUser(credentials: LoginRequest) {
      return this.http.post<LoginResponse>('http://localhost:3000/api/login', credentials);
    }

    updateProfile(username: string, profile: ProfileRequest) {
      return this.http.patch<LoginResponse>(
        `http://localhost:3000/api/users/${encodeURIComponent(username)}`, profile, sessionOptions()
      );
    }

    logout() {
      return this.http.post<ApiMessage>('http://localhost:3000/api/logout', {}, sessionOptions());
    }

    changePassword(username: string, passwords: PasswordRequest) {
      return this.http.patch<ApiMessage>(
        `http://localhost:3000/api/users/${encodeURIComponent(username)}/password`, passwords, sessionOptions()
      );
    }
}
