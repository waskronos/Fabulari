import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Login } from './login';
import { Router } from '@angular/router';
import { User } from '../../services/user';
import { of, throwError } from 'rxjs';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  const userService = {loginUser: vi.fn()};
  const router = {navigate: vi.fn()};

  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [{provide: User, useValue: userService}, {provide: Router, useValue: router}],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('stores the logged-in account and opens home', () => {
    userService.loginUser.mockReturnValue(of({user: {username: 'alice', role: 'user'}}));
    component.username = 'alice';
    component.password = 'Password8';
    component.login();
    expect(userService.loginUser).toHaveBeenCalledWith({username: 'alice', password: 'Password8'});
    expect(JSON.parse(localStorage.getItem('currentUser')!).username).toBe('alice');
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('opens the administrative dashboard for Super Admin', () => {
    userService.loginUser.mockReturnValue(of({user: {username: 'admin', role: 'superAdmin'}}));
    component.login();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('shows a login error without navigating', () => {
    userService.loginUser.mockReturnValue(throwError(() => ({error: {message: 'Invalid credentials'}})));
    component.login();
    expect(component.feedbackMessage()).toBe('Invalid credentials');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem('currentUser')).toBeNull();
  });
});
