// Calcula quantos pontos cada Pack vale (a média do score que cada uma das
// suas fases dá na lista respectiva, no rank/percentToQualify atual) e agrega
// esses pontos por jogador — usado pra somar no Leaderboard e mostrar no
// perfil do jogador.

import { supabase } from './supabase.js';
import { fetchList, fetchPlatformerList, fetchChallengeList } from './content.js';
import { scoreClassic, scorePlatformer, scoreChallenge, round } from './score.js';

const LIST_FETCHERS = {
    classic: fetchList,
    platformer: fetchPlatformerList,
    challenge: fetchChallengeList,
};

const SCORE_FNS = {
    classic: scoreClassic,
    platformer: scorePlatformer,
    challenge: scoreChallenge,
};

let cachedPromise = null;

/**
 * Retorna { packBonus, byPlayer, packs }
 * - packBonus[pack.id] = pontos que aquele pack vale
 * - byPlayer[listType][playerNameLowerCase] = soma dos pontos de pack ganhos
 *   por aquele jogador naquela lista
 * - packs = lista crua de packs aprovados (com list_type, name, etc)
 */
export async function computePackBonuses() {
    if (cachedPromise) return cachedPromise;

    cachedPromise = (async () => {
        const empty = { packBonus: {}, byPlayer: { classic: {}, platformer: {}, challenge: {} }, packs: [] };

        const { data: packs } = await supabase.from('packs').select('*').eq('status', 'approved');
        if (!packs || packs.length === 0) return empty;

        const packIds = packs.map((p) => p.id);
        const [{ data: levels }, { data: victors }] = await Promise.all([
            supabase.from('pack_levels').select('*').in('pack_id', packIds),
            supabase.from('pack_victors').select('*').in('pack_id', packIds),
        ]);

        const listTypesNeeded = [...new Set(packs.map((p) => p.list_type).filter(Boolean))];
        const results = await Promise.all(listTypesNeeded.map((t) => LIST_FETCHERS[t]()));
        const listData = {};
        listTypesNeeded.forEach((t, i) => { listData[t] = results[i] || []; });

        const packBonus = {};
        packs.forEach((p) => {
            if (!p.list_type || !SCORE_FNS[p.list_type]) {
                packBonus[p.id] = 0;
                return;
            }
            const scoreFn = SCORE_FNS[p.list_type];
            const list = listData[p.list_type] || [];
            const packLevels = (levels || []).filter((l) => l.pack_id === p.id);

            const scores = packLevels.map((pl) => {
                const idx = list.findIndex(([lvl]) => lvl && lvl.path === pl.level_path);
                if (idx === -1) return 0;
                const [level] = list[idx];
                return scoreFn(idx + 1, 100, level.percentToQualify);
            });

            const rawAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
            const inflated = rawAvg * (1 + (p.bonus_percent || 0) / 100);
            packBonus[p.id] = round(inflated);
        });

        const byPlayer = { classic: {}, platformer: {}, challenge: {} };
        (victors || []).forEach((v) => {
            const pack = packs.find((p) => p.id === v.pack_id);
            if (!pack || !pack.list_type) return;
            const bonus = packBonus[pack.id] || 0;
            const key = v.player_name.toLowerCase();
            byPlayer[pack.list_type][key] = round((byPlayer[pack.list_type][key] || 0) + bonus);
        });

        return { packBonus, byPlayer, packs };
    })();

    return cachedPromise;
}
