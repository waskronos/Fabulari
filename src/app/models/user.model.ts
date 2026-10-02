export interface RegisterRequest {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ProfileRequest {
  profileImage?: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  currentPassword: string;
}

export interface CurrentUser {
  profileImage?: string;
  sessionToken?: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth?: string;
  age: number;
  role: 'user' | 'superAdmin';
}

export interface PasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ApiMessage {
  message: string;
}

export interface LoginResponse extends ApiMessage {
  user: CurrentUser;
}
