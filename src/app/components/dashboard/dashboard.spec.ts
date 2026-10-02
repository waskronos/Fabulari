import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Dashboard } from './dashboard';
import { Group } from '../../services/group';
import { User } from '../../services/user';
import { of } from 'rxjs';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        {provide: Group, useValue: {getGroup: () => of([]), getChannels: () => of([]), getGroupRequests: () => of([])}},
        {provide: User, useValue: {updateProfile: vi.fn(), changePassword: vi.fn()}},
        {
          provide: Router,
          useValue: { navigate: vi.fn(), url: '/dashboard' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('checks Group Admin access from the group', () => {
    component.currentuser = { username: 'hello1' };

    expect(component.isGroupAdmin({ admins: ['hello1'] })).toBe(true);
    expect(component.isGroupAdmin({ admins: ['hello2'] })).toBe(false);
  });
});
