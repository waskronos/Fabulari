import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CurrentUser } from '../models/user.model';

function getCurrentUser(): CurrentUser | null {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || 'null');
  } catch {
    return null;
  }
}

export const authGuard: CanActivateFn = () => {
  const user = getCurrentUser();
  return !!user?.sessionToken || inject(Router).createUrlTree(['/login']);
};

export const chatGuard: CanActivateFn = () => {
  return getCurrentUser()?.role !== 'superAdmin' || inject(Router).createUrlTree(['/dashboard']);
};

export function sessionOptions() {
  const token = getCurrentUser()?.sessionToken;
  return {headers: {Authorization: `Bearer ${token || ''}`}};
}
