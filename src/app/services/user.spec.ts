import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { User } from './user';

describe('User', () => {
  let service: User;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(User);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('sends login details to the server', () => {
    service.loginUser({username: 'alice', password: 'Password8'}).subscribe();
    const request = http.expectOne('http://localhost:3000/api/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({username: 'alice', password: 'Password8'});
    request.flush({message: 'Login successful', user: {username: 'alice'}});
  });
});
