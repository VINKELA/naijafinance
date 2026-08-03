import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Django REST backend base URL (dev). CORS is enabled for localhost:4200. */
export const API_BASE = '/api'; // relative: nginx proxies /api/ to backend (staging + prod)

export interface Bond { id: number; symbol: string; name: string; last_price: string; asset_type: string; sector?: string | null; maturity_date?: string | null; coupon_rate?: string | null; }
export interface Auction { id: number; instrument_symbol: string; instrument_name: string; auction_date: string; tenor: string; offer_size: string | null; stop_rate: string | null; notes?: string | null; }
export interface NavSnapshot { id: number; fund: number; date: string; nav: string; }
export interface Fund { id: number; name: string; manager: string | null; asset_class: string; asset_class_display: string; latest_nav: NavSnapshot | null; nav_history: NavSnapshot[]; }
export interface FxRate { id: number; pair: string; rate: string; date: string; source: string; }
export interface CompanyProfile { id: number; symbol: string; name: string; sector: string | null; description: string | null; eps: string | null; pe_ratio: string | null; book_value: string | null; market_cap: string | null; }
export interface Alert { id?: number; instrument: number | null; instrument_symbol?: string | null; fund: number | null; fund_name?: string | null; alert_type: string; alert_type_display?: string; threshold: string; direction: string; direction_display?: string; active: boolean; triggered?: boolean; triggered_at?: string | null; last_evaluated_at?: string | null; last_value?: string | null; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // F-04
  bonds(): Observable<Bond[]> { return this.http.get<Bond[]>(`${API_BASE}/bonds/`); }
  auctions(): Observable<Auction[]> { return this.http.get<Auction[]>(`${API_BASE}/auctions/`); }

  // F-05
  funds(): Observable<Fund[]> { return this.http.get<Fund[]>(`${API_BASE}/funds/`); }

  // F-06
  fxRates(latest = true): Observable<FxRate[]> { return this.http.get<FxRate[]>(`${API_BASE}/fx-rates/${latest ? '?latest=1' : ''}`); }

  // F-07
  companies(): Observable<CompanyProfile[]> { return this.http.get<CompanyProfile[]>(`${API_BASE}/companies/`); }

  // F-08
  alerts(): Observable<Alert[]> { return this.http.get<Alert[]>(`${API_BASE}/alerts/`); }
  createAlert(alert: Alert): Observable<Alert> { return this.http.post<Alert>(`${API_BASE}/alerts/`, alert); }
  updateAlert(id: number, alert: Partial<Alert>): Observable<Alert> { return this.http.patch<Alert>(`${API_BASE}/alerts/${id}/`, alert); }
  deleteAlert(id: number): Observable<void> { return this.http.delete<void>(`${API_BASE}/alerts/${id}/`); }
}
