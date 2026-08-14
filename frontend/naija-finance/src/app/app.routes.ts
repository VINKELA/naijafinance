import { Routes } from '@angular/router';
import { BondsPage } from './pages/bonds';
import { FundsPage } from './pages/funds';
import { FxPage } from './pages/fx';
import { AlertsPage } from './pages/alerts';
import { MarketPage } from './pages/market';
import { LearnPage } from './pages/learn';
import { AssetPage } from './pages/asset';
import { AuthPage } from './pages/auth';
import { LegalPage } from './pages/legal';

export const routes: Routes = [
  { path: '', redirectTo: '/market', pathMatch: 'full' },
  { path: 'market', component: MarketPage, title: 'Market Overview' },
  { path: 'bonds', component: BondsPage, title: 'Bonds & Auctions' },
  { path: 'funds', component: FundsPage, title: 'Mutual Funds' },
  { path: 'fx', component: FxPage, title: 'CBN FX Rates' },
  { path: 'learn', component: LearnPage, title: 'Learn — Education' },
  { path: 'alerts', component: AlertsPage, title: 'Threshold Alerts' },
  { path: 'asset', component: AssetPage, title: 'Asset Information' },
  { path: 'account', component: AuthPage, title: 'Account' },
  { path: 'legal', component: LegalPage, title: 'Terms & Privacy' },
];
