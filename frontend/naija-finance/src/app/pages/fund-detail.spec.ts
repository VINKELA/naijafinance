import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { FundDetailPage } from './fund-detail';
import { ApiService } from '../api.service';
import { ActivatedRoute } from '@angular/router';
import { LangService } from '../lang.service';

const DETAIL = {
  id: 14, name: 'Balanced Fund', kind: 'fund', asset_type: 'Fund · Balanced',
  manager: 'United Capital', price: '2.8270', changePct: '40.35', isUp: true,
  about: 'About text.',
  chart_data: [{ date: '2024-04-02', value: 2.0143 }, { date: '2024-04-03', value: 2.02 }],
};

describe('FundDetailPage', () => {
  // Swappable mock so individual tests can change what /api/fund/<id>/ returns.
  const apiMock: { impl: (id: number) => any } = { impl: () => of(DETAIL) };

  beforeEach(async () => {
    apiMock.impl = () => of(DETAIL);
    await TestBed.configureTestingModule({
      imports: [FundDetailPage],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => '14' }) } },
        { provide: ApiService, useValue: { fundDetail: (id: number) => apiMock.impl(id) } },
      ],
    }).compileComponents();
  });

  /** Creates the page without booting real lightweight-charts inside jsdom. */
  function makePage(): FundDetailPage {
    const cmp = TestBed.createComponent(FundDetailPage).componentInstance;
    vi.spyOn(cmp as any, 'renderChart').mockImplementation(() => {}); // chart canvas is unavailable in unit tests
    return cmp;
  }

  it('boots in English and switches every string to Pidgin via the shared service (header toggle)', () => {
    const cmp = makePage();
    const i18n = TestBed.inject(LangService);
    expect(i18n.isPidgin).toBe(false);
    expect(cmp.t().cadence).toBe('Update cadence');
    expect(cmp.t().navTrend).toBe('NAV history & trend');

    i18n.toggle(); // what the header 🇳🇬 button calls
    expect(cmp.t().cadence).toBe('How often dem dey update am');
    expect(cmp.t().navTrend).toBe('How di NAV don dey go');
    expect(cmp.t().allInfo).toBe('All di information');

    i18n.toggle(); // back to EN
    expect(cmp.t().cadence).toBe('Update cadence');
  });

  it('inline pills keep the shared service in sync', () => {
    const cmp = makePage();
    const i18n = TestBed.inject(LangService);
    cmp.setLang('pcm');
    expect(i18n.isPidgin).toBe(true);
    expect(cmp.t().noNav).toContain('Dem never publish');
    cmp.setLang('en');
    expect(i18n.isPidgin).toBe(false);
  });

  it('loads a fund and renders only fields that exist in the payload; cadence is honestly blank', () => {
    const cmp = makePage();
    cmp.ngOnInit();
    expect(cmp.detail()).toEqual(DETAIL);
    const rows = cmp.allInfoRows();
    expect(rows.find(r => r.label === 'Manager')!.value).toBe('United Capital');
    expect(rows.find(r => r.label === 'Latest NAV')!.value).toBe('2.8270');
    const cadenceRow = rows.find(r => r.label.startsWith('Update cadence'))!;
    expect(cadenceRow.value.startsWith('—')).toBe(true); // no fabricated cadence value
    expect(cmp.infoRows().find(r => r.label === 'Update cadence')!.value).toBe('—');
    expect(cmp.hasNav()).toBe(true);
  });

  it('handles funds with no NAV history gracefully', () => {
    apiMock.impl = () => of({ ...DETAIL, chart_data: [], price: '—', changePct: '—' });
    const cmp = makePage();
    cmp.ngOnInit();
    expect(cmp.hasNav()).toBe(false);
    expect(cmp.t().noNav).toContain('No NAV history published yet');
  });

  it('shows the not-found state when the fund does not resolve', () => {
    apiMock.impl = () => throwError(() => new Error('404'));
    const cmp = makePage();
    cmp.ngOnInit();
    expect(cmp.notFound()).toBe(true);
    expect(cmp.detail()).toBeNull();
  });
});
