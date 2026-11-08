// Divide uma lista ordenada por rank em Main List (1-75), Extended List
// (76-150) e Extended List+ (151+) — sem afetar pontuação, só organização
// visual. Usado tanto na List.js (lista principal) quanto na Leaderboard.js
// (Verified/Completed/Progressed do jogador selecionado).

export const DIVISION_THRESHOLDS = { extended: 76, extendedPlus: 151 };

export const DIVISION_LABELS = {
    all: 'All',
    main: 'Main List',
    extended: 'Extended List',
    extendedPlus: 'Extended+',
};

/**
 * @param {Array} items - lista já ordenada por rank crescente
 * @param {(item: any) => number} getRank - como pegar o rank (1-based) de um item
 * @returns Array de { divider: true, label, key } ou { divider: false, item }
 */
export function withDivisionDividers(items, getRank) {
    const rows = [{ divider: true, label: 'Main List', key: 'div-main' }];
    let shownExtended = false;
    let shownExtendedPlus = false;

    items.forEach((item) => {
        const rank = getRank(item);

        if (rank >= DIVISION_THRESHOLDS.extendedPlus && !shownExtendedPlus) {
            rows.push({ divider: true, label: 'Extended List+', key: 'div-extended-plus' });
            shownExtended = true;
            shownExtendedPlus = true;
        } else if (rank >= DIVISION_THRESHOLDS.extended && !shownExtended) {
            rows.push({ divider: true, label: 'Extended List', key: 'div-extended' });
            shownExtended = true;
        }

        rows.push({ divider: false, item });
    });

    // Extended List+ sempre aparece no final, mesmo que a lista ainda não
    // tenha chegado na posição 151 — marca onde ela vai começar quando chegar.
    if (!shownExtendedPlus) {
        rows.push({ divider: true, label: 'Extended List+', key: 'div-extended-plus' });
    }

    return rows;
}
