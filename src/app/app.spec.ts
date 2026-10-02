import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.removeItem('currentUser');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    })
      .compileComponents();
  });

  it('opens and closes the logged-in navigation menu', async () => {
    localStorage.setItem('currentUser', JSON.stringify({firstName: 'Alice', lastName: 'Check', username: 'alice'}));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('#account-menu')).toBeNull();
    (page.querySelector('.menu-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(page.querySelector('#account-menu')?.textContent).toContain('Alice Check');
    (page.querySelector('.menu-backdrop') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(page.querySelector('#account-menu')).toBeNull();
    localStorage.removeItem('currentUser');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the Fabulari brand', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand')?.textContent).toContain('Fabulari');
  });
});
