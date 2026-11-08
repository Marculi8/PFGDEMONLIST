const scale = 3;

// ─── CONFIGURAÇÕES — CLASSIC ──────────────────────────────────
const CLASSIC_LIST_SIZE = 150;   // 👈 Aumente aqui ao adicionar fases Classic
const CLASSIC_BASE_POINTS = 300; // Pontos máximos para o rank 1
const CLASSIC_DECAY = 0.973;     // Queda por rank (menor = mais agressivo)
// ────────────────────────────────────────────────────────────────

// ─── CONFIGURAÇÕES — PLATFORMER ───────────────────────────────
const PLATFORMER_LIST_SIZE = 15;    // 👈 Aumente aqui ao adicionar fases Platformer
const PLATFORMER_BASE_POINTS = 200; // Pontos máximos para o rank 1
const PLATFORMER_DECAY = 0.965;     // Queda por rank (menor = mais agressivo)
// ────────────────────────────────────────────────────────────────

// ─── CONFIGURAÇÕES — CHALLENGE ────────────────────────────────
const CHALLENGE_LIST_SIZE = 75;    // 👈 Aumente aqui ao adicionar fases Challenge
const CHALLENGE_BASE_POINTS = 250; // Pontos máximos para o rank 1
const CHALLENGE_DECAY = 0.960;     // Queda por rank (menor = mais agressivo)
// ────────────────────────────────────────────────────────────────

// ─── CONFIGURAÇÕES — IMPOSSIBLE (World Record system) ─────────
const IMPOSSIBLE_MAX_POINTS = 500;  // 👈 Pontos dados a quem chega em 100%
const IMPOSSIBLE_CURVE = 2.5;       // 👈 Maior = crescimento mais dramático perto de 100%
const IMPOSSIBLE_NON_WR_MULTIPLIER = 0.9; // 👈 Fator aplicado quando o record NÃO é um novo WR (10% de desconto)
// ────────────────────────────────────────────────────────────────

// ─── CONFIGURAÇÕES — VERIFICATIONS ─────────────────────────────
const VERIFICATIONS_POINTS_PER_LEVEL = 1; // 👈 Pontos fixos dados por fase verificada
// ────────────────────────────────────────────────────────────────

/**
 * Pontuação para records da lista Impossible, baseada em "World Record".
 * Não depende de rank — só da porcentagem em si.
 *
 * @param {number} percent - a porcentagem do record (1-100)
 * @param {boolean} isWorldRecord - true se esse record bateu o maior % até então pra essa fase
 */
export function scoreImpossible(percent, isWorldRecord) {
    let score = IMPOSSIBLE_MAX_POINTS * Math.pow(percent / 100, IMPOSSIBLE_CURVE);

    if (!isWorldRecord) {
        score *= IMPOSSIBLE_NON_WR_MULTIPLIER;
    }

    return round(Math.max(0, score));
}

/**
 * Pontuação para a lista Verifications — sempre 1 ponto fixo por fase
 * verificada (não depende de rank, % ou dificuldade).
 */
export function scoreVerifications() {
    return VERIFICATIONS_POINTS_PER_LEVEL;
}

/**
 * Lógica de pontuação compartilhada pelas listas.
 * Não precisa mexer aqui — ajuste as constantes acima.
 */
function calculateScore(rank, percent, minPercent, listSize, basePoints, decay) {
    if (rank > listSize) return 0;
    if (rank > Math.floor(listSize / 2) && percent < 100) return 0;

    let score = basePoints * Math.pow(decay, rank - 1);

    // Multiplicador de porcentagem (preservado original)
    score = score * ((percent - (minPercent - 1)) / (100 - (minPercent - 1)));

    score = Math.max(0, score);

    // Penalidade por não completar (preservada original)
    if (percent != 100) {
        return round(score - score / 3);
    }
    return Math.max(round(score), 0);
}

/**
 * Pontuação para fases da lista Classic
 */
export function scoreClassic(rank, percent, minPercent) {
    return calculateScore(
        rank,
        percent,
        minPercent,
        CLASSIC_LIST_SIZE,
        CLASSIC_BASE_POINTS,
        CLASSIC_DECAY,
    );
}

/**
 * Pontuação para fases da lista Platformer
 */
export function scorePlatformer(rank, percent, minPercent) {
    return calculateScore(
        rank,
        percent,
        minPercent,
        PLATFORMER_LIST_SIZE,
        PLATFORMER_BASE_POINTS,
        PLATFORMER_DECAY,
    );
}

/**
 * Pontuação para fases da lista Challenge
 */
export function scoreChallenge(rank, percent, minPercent) {
    return calculateScore(
        rank,
        percent,
        minPercent,
        CHALLENGE_LIST_SIZE,
        CHALLENGE_BASE_POINTS,
        CHALLENGE_DECAY,
    );
}

export function round(num) {
    if (!('' + num).includes('e')) {
        return +(Math.round(num + 'e+' + scale) + 'e-' + scale);
    } else {
        var arr = ('' + num).split('e');
        var sig = '';
        if (+arr[1] + scale > 0) {
            sig = '+';
        }
        return +(
            Math.round(+arr[0] + 'e' + sig + (+arr[1] + scale)) +
            'e-' +
            scale
        );
    }
}
