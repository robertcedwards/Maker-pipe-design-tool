import { useDerived } from '../state/derived';
import { type PanelTab, useStore } from '../state/store';
import { formatMoney } from '../model/units';
import { BuildTab } from './tabs/BuildTab';
import { CatalogTab } from './tabs/CatalogTab';
import { CutTab } from './tabs/CutTab';
import { DesignTab } from './tabs/DesignTab';
import { PartsTab } from './tabs/PartsTab';

export function Panel() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const { bom, plan, steps, analysis } = useDerived();
  const problems = analysis.issues.filter((i) => i.level !== 'info').length + bom.issues.length;
  const tabs: { id: PanelTab; label: string; count?: string }[] = [
    { id: 'design', label: 'Design', count: problems ? `${problems}!` : undefined },
    { id: 'parts', label: 'Parts', count: bom.lines.length ? formatMoney(bom.total).replace(/\.\d\d$/, '') : undefined },
    { id: 'cut', label: 'Cut list', count: plan.parts.length ? String(plan.parts.reduce((s, p) => s + p.pipeIds.length, 0)) : undefined },
    { id: 'build', label: 'Build', count: steps.length ? String(steps.length) : undefined },
    { id: 'catalog', label: 'Prices' },
  ];
  return (
    <section className="panel" aria-label="Details">
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            className="tab"
            aria-selected={tab === t.id}
            aria-controls={`tabpanel-${t.id}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count && <span className="count">{t.count}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`} style={{ minHeight: 0, display: 'grid' }}>
        {tab === 'design' && <DesignTab />}
        {tab === 'parts' && <PartsTab />}
        {tab === 'cut' && <CutTab />}
        {tab === 'build' && <BuildTab />}
        {tab === 'catalog' && <CatalogTab />}
      </div>
    </section>
  );
}
