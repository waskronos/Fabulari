import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Group } from './group';

describe('Group', () => {
  let service: Group;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
    service = TestBed.inject(Group);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads groups from the API', () => {
    service.getGroup().subscribe(groups => expect(groups).toEqual([{title: 'Study'}]));
    const request = http.expectOne('http://localhost:3000/api/groups');
    expect(request.request.method).toBe('GET');
    request.flush([{title: 'Study'}]);
  });

  it('sends the login token when requesting membership', () => {
    localStorage.setItem('currentUser', JSON.stringify({sessionToken: 'test-token'}));
    service.requestJoin('Study', 'alice').subscribe();
    const request = http.expectOne('http://localhost:3000/api/groups/join');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(request.request.body).toEqual({title: 'Study', username: 'alice'});
    request.flush({message: 'Request sent'});
  });
});
