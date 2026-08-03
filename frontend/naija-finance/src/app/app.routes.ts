import { Routes } from '@angular/router';
import { BondsPage } from './pages/bonds';
import { FundsPage } from './pages/funds';
import { FxPage } from './pages/fx';
import { CompaniesPage } from './pages/companies';
import { AlertsPage } from './pages/alerts';
import { MarketPage } from './pages/market';

export const routes: Routes = [
  { path: '', redirectTo: '/market', pathMatch: 'full' },
  { path: 'market', component: MarketPage, title: 'Market Overview' },
  { path: 'bonds', component: BondsPage, title: 'Bonds & Auctions' },
  { path: 'funds', component: FundsPage, title: 'Mutual Funds' },
  { path: 'fx', component: FxPage, title: 'CBN FX Rates' },
  { path: 'companies', component: CompaniesPage, title: 'Company Profiles' },
  { path: 'alerts', component: AlertsPage, title: 'Threshold Alerts' },
];
