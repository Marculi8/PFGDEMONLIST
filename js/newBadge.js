// Checa se algo (fase, pack, verificação, projeto) ainda está dentro da
// janela de "Novo" — usado no badge amarelo espalhado pelas listas.

export const NEW_BADGE_DAYS = {
    level: 14,        // 2 semanas
    levelUpdated: 14,  // 2 semanas — badge "Updated"
    pack: 7,           // 1 semana
    verification: 14,  // 2 semanas
    project: 14,        // 2 semanas
    projectUpdated: 14, // 2 semanas — badge "Updated"
};

export const BADGE_FILTER_LABELS = {
    all: 'All',
    new: 'New',
    updated: 'Updated',
    none: 'No Badge',
};

// Dado se algo tem New/Updated e o filtro escolhido, diz se deve aparecer.
// hasNew sempre tem prioridade sobre hasUpdated (mesma regra de exibição).
export function matchesBadgeFilter(filter, hasNew, hasUpdated) {
    if (filter === 'all') return true;
    if (filter === 'new') return hasNew;
    if (filter === 'updated') return hasUpdated && !hasNew;
    if (filter === 'none') return !hasNew && !hasUpdated;
    return true;
}

export function isNew(dateString, days) {
    if (!dateString) return false;
    const added = new Date(dateString);
    if (Number.isNaN(added.getTime())) return false;
    const diffMs = Date.now() - added.getTime();
    return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}
