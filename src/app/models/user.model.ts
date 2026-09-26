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

export interface CurrentUser {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth?: string;
  age: number;
  role: 'user' | 'groupAdmin' | 'superAdmin';
}

export interface ApiMessage {
  message: string;
}

export interface LoginResponse extends ApiMessage {
  user: CurrentUser;
}
