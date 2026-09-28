import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Register } from './register';
import { User } from '../../services/user';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  const registerUser = vi.fn();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        {
          provide: User,
          useValue: { registerUser },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('rejects a future date of birth before calling the API', () => {
    component.dateOfBirth = '2999-01-01';

    component.register();

    expect(component.feedbackMessage()).toBe('Date of birth cannot be in the future.');
    expect(component.feedbackType()).toBe('error');
    expect(registerUser).not.toHaveBeenCalled();
  });
});
