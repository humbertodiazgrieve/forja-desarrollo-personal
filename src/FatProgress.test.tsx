import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cumulativeFatEstimate, initialState } from './domain';
import { FatProgress } from './FatProgress';
import { Calories } from './Calories';
import { Home } from './Home';

const date = '2026-10-28';
function fixture(balances: number[]) {
  const state = initialState(date);
  balances.forEach((balance, index) => {
    const day = `2026-09-${String(index + 1).padStart(2, '0')}`;
    state.records[day] = { calories: 20000 };
    state.calorieExpenditure ??= {};
    state.calorieExpenditure[day] = 20000 + balance;
  });
  return state;
}
describe('Cumulative estimated fat progress', () => {
  it.each([
    [[], 0, 0, 0],
    [[-1000], -1000, 0, 0],
    [[3850], 3850, 0, 3850],
    [[7700], 7700, 1, 0],
    [[7700, 7700, 3850], 19250, 2, 3850],
    [[-1000, 7700], 6700, 0, 6700],
    [[7700, -1000], 6700, 0, 6700],
    [[7699.99, 0.01], 7700, 1, 0],
  ])('computes net balance %j', (balances, netKcal, completedKg, currentKcal) => {
    const result = cumulativeFatEstimate(fixture(balances as number[]), date);
    expect(result).toMatchObject({
      netKcal,
      completedKg,
      currentKcal,
      recordedDays: (balances as number[]).length,
    });
    expect(result.fraction).toBe(Number(currentKcal) / 7700);
  });
  it('ignores incomplete entries, maintenance references and future days; includes old recorded days', () => {
    const state = fixture([3850]);
    state.records['2026-10-01'] = { calories: 1000 };
    state.calorieMaintenance = { '2026-10-01': 9000 };
    state.calorieExpenditure!['2026-10-02'] = 9000;
    state.records['2026-10-29'] = { calories: 0 };
    state.calorieExpenditure!['2026-10-29'] = 7700;
    expect(cumulativeFatEstimate(state, date)).toMatchObject({
      netKcal: 3850,
      recordedDays: 1,
      fraction: 0.5,
    });
  });
  it('renders empty and surplus explanations and exact kilogram milestone', () => {
    expect(renderToStaticMarkup(<FatProgress state={fixture([])} date={date} />)).toContain(
      'Tu primer paso',
    );
    expect(renderToStaticMarkup(<FatProgress state={fixture([-1000])} date={date} />)).toContain(
      'Superávit neto acumulado',
    );
    const markup = renderToStaticMarkup(<FatProgress state={fixture([7700])} date={date} />);
    expect(markup).toContain('aria-valuenow="0"');
    expect(markup).toContain('1 kg completo');
    expect(markup).toContain('Próximo hito: 2 kg');
  });
  it('shows the shared visual on both pages', () => {
    const props = {
      state: fixture([3850]),
      date,
      update: () => {},
      go: () => {},
      notify: () => {},
    };
    for (const Page of [Home, Calories]) {
      const markup = renderToStaticMarkup(<Page {...props} />);
      expect(markup).toContain('Grasa quemada estimada');
      expect(markup).toContain('aria-valuenow="50"');
    }
  });
});
