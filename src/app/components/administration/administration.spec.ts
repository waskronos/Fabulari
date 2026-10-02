import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Administration } from './administration';
import { Admin } from '../../services/admin';

describe('Administration', () => {
  let component: Administration;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('currentUser');
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: Router, useValue: {navigate: vi.fn()}},
    ]});
    component = TestBed.runInInjectionContext(() => new Administration());
    http = TestBed.inject(HttpTestingController);
    component.currentUser = {username: 'alice', role: 'user'};
    component.groups = [
      {_id: 'one', title: 'Study', admins: ['alice'], members: ['alice', 'bob'], description: 'Study together', minimumAge: 18},
      {_id: 'two', title: 'Games', admins: ['bob'], members: ['alice', 'bob']},
    ];
  });

  afterEach(() => http.verify());

  it('only offers groups this account administers', () => {
    expect(component.manageableGroups().map(group => group.title)).toEqual(['Study']);
    expect(component.joinedGroups().map(group => group.title)).toEqual(['Study', 'Games']);
    component.groupId = 'one';
    component.selectGroup();
    expect(component.description).toBe('Study together');
    expect(component.minimumAge).toBe(18);
  });

  it('checks the group and role before displaying request review buttons', () => {
    expect(component.canReview({type: 'ban', status: 'pending', groupId: 'one'})).toBe(true);
    expect(component.canReview({type: 'ban', status: 'pending', groupId: 'two'})).toBe(false);
    expect(component.canReview({type: 'deleteUser', status: 'pending'})).toBe(false);
    component.currentUser = {username: 'admin', role: 'superAdmin'};
    expect(component.canReview({type: 'deleteUser', status: 'pending'})).toBe(true);
    expect(component.canReview({type: 'ban', status: 'pending', groupId: 'one'})).toBe(false);
    expect(component.canReview({type: 'deleteUser', status: 'rejected'})).toBe(false);
  });

  it('refreshes parent data after a successful administrative request', () => {
    const changed = vi.fn();
    component.changed.subscribe(changed);
    const service = TestBed.inject(Admin);
    component.runAction(service.rejectJoin('one', 'bob'));
    const request = http.expectOne('http://localhost:3000/api/groups/reject');
    expect(request.request.body).toEqual({groupId: 'one', username: 'bob'});
    request.flush({message: 'Membership request rejected'});
    http.expectOne('http://localhost:3000/api/moderation-requests').flush([]);
    expect(changed).toHaveBeenCalledOnce();
    expect(component.feedback()).toBe('Membership request rejected');
  });

  it('shows server permission errors without reporting success', () => {
    const changed = vi.fn();
    component.changed.subscribe(changed);
    component.runAction(TestBed.inject(Admin).deleteUser('bob'));
    http.expectOne('http://localhost:3000/api/users/bob').flush({message: 'Only Super Admin can delete accounts'},
      {status: 403, statusText: 'Forbidden'});
    expect(component.feedback()).toBe('Only Super Admin can delete accounts');
    expect(changed).not.toHaveBeenCalled();
  });
});
