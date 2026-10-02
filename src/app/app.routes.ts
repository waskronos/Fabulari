import { Routes } from '@angular/router';
import { Landing } from './pages/landing/landing';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Dashboard } from './components/dashboard/dashboard';
import { Chat } from './components/chat/chat';
import { authGuard, chatGuard } from './services/access';

export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'home', component: Dashboard, canActivate: [authGuard] },
  { path: 'chat/:groupTitle/:channelName', component: Chat, canActivate: [authGuard, chatGuard] }
]
