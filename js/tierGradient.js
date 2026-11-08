// Monta a string CSS de um gradiente de tier, a partir de até 5 cores e
// uma direção — usado em todo lugar que exibe o badge/cor de um tier.

export const GRADIENT_DIRECTIONS = [
    { value: '135deg', label: 'Diagonal ↘' },
    { value: '45deg', label: 'Diagonal ↗' },
    { value: '225deg', label: 'Diagonal ↙' },
    { value: '315deg', label: 'Diagonal ↖' },
    { value: 'to right', label: 'Horizontal →' },
    { value: 'to bottom', label: 'Vertical ↓' },
];

export function tierGradientCSS(tier) {
    if (!tier) return 'linear-gradient(135deg, #8a8a8a, #e8e8e8)';
    const colors = [tier.gradient_from, tier.gradient_to, tier.gradient_color_3, tier.gradient_color_4, tier.gradient_color_5].filter(Boolean);
    const direction = tier.gradient_direction || '135deg';
    return `linear-gradient(${direction}, ${colors.join(', ')})`;
}

// Acha o tier mais alto cujo min_points a pontuação do pack alcança.
// `tiers` precisa estar ordenado por min_points (não importa a direção,
// a função ordena de novo por segurança).
export function calculateAutoTier(points, tiers) {
    if (!tiers || tiers.length === 0) return null;
    const sorted = [...tiers].sort((a, b) => (b.min_points || 0) - (a.min_points || 0));
    return sorted.find((t) => points >= (t.min_points || 0)) || sorted[sorted.length - 1];
}

