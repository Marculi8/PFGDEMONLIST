import { round, scoreClassic, scorePlatformer, scoreChallenge, scoreImpossible, scoreVerifications } from './score.js';

/**
 * Path to directory containing `_list.json` and all levels
 */
const dir = '/data';

/**
 * Path to directory containing `_platformer_list.json` and all platformer levels
 */
const platformerDir = '/data/platformer';

/**
 * Path to directory containing `_challenge_list.json` and all challenge levels
 */
const challengeDir = '/data/challenge';

/**
 * Path to directory containing `_impossible_list.json` and all impossible levels
 */
const impossibleDir = '/data/impossible';

/**
 * Path to directory containing `_verifications_list.json` and all verification levels
 */
const verificationsDir = '/data/verifications';

export async function fetchList() {
    const listResult = await fetch(`${dir}/_list.json`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${dir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    return [
                        {
                            ...level,
                            path,
                            records: level.records.sort(
                                (a, b) => b.percent - a.percent,
                            ),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load list.`);
        return null;
    }
}

export async function fetchPlatformerList() {
    const listResult = await fetch(`${platformerDir}/_platformer_list.json`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${platformerDir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    return [
                        {
                            ...level,
                            path,
                            records: level.records.sort(
                                (a, b) => b.percent - a.percent,
                            ),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load platformer level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load platformer list.`);
        return null;
    }
}

export async function fetchChallengeList() {
    const listResult = await fetch(`${challengeDir}/_challenge_list.json`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${challengeDir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    return [
                        {
                            ...level,
                            path,
                            records: level.records.sort(
                                (a, b) => b.percent - a.percent,
                            ),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load challenge level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load challenge list.`);
        return null;
    }
}

export async function fetchImpossibleList() {
    const listResult = await fetch(`${impossibleDir}/_impossible_list.json`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${impossibleDir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    // Records são mantidos na ORDEM ORIGINAL do arquivo (cronológica,
                    // ordem de submissão) — necessário pro cálculo de World Record,
                    // que depende de saber quem bateu qual % primeiro.
                    return [{ ...level, path }, null];
                } catch {
                    console.error(`Failed to load impossible level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load impossible list.`);
        return null;
    }
}

export async function fetchVerificationsList() {
    const listResult = await fetch(`${verificationsDir}/_verifications_list.json`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${verificationsDir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    // Sem "records" — cada fase de Verifications tem uma % pública
                    // única (level.percent), o histórico por trás fica no Supabase.
                    return [{ ...level, path }, null];
                } catch {
                    console.error(`Failed to load verification level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load verifications list.`);
        return null;
    }
}

/**
 * Returns the current World Record for an Impossible level: who holds it,
 * what percent, and whether the level is fully verified (100% reached, no
 * more submissions accepted).
 */
export function getImpossibleWR(level) {
    if (!level || !level.records || level.records.length === 0) {
        return { holder: null, percent: 0, link: null, verified: false };
    }
    let best = level.records[0];
    for (const r of level.records) {
        if (r.percent > best.percent) best = r;
    }
    return { holder: best.user, percent: best.percent, link: best.link, verified: best.percent === 100 };
}

export async function fetchEditors() {
    try {
        const editorsResults = await fetch(`${dir}/_editors.json`);
        const editors = await editorsResults.json();
        return editors;
    } catch {
        return null;
    }
}

/**
 * Fetch player profiles (avatar + social links) from _players.json
 * Returns a map: { "shiori": { name, avatar, youtube, twitter, discord, bio, videos }, ... }
 */
export async function fetchPlayers() {
    try {
        const result = await fetch(`${dir}/_players.json`);
        const players = await result.json();
        const map = {};
        players.forEach((p) => {
            map[p.name.toLowerCase()] = p;
        });
        return map;
    } catch {
        return {};
    }
}

export async function fetchLeaderboard() {
    const list = await fetchList();
    return buildLeaderboard(list, scoreClassic);
}

export async function fetchPlatformerLeaderboard() {
    const list = await fetchPlatformerList();
    return buildLeaderboard(list, scorePlatformer);
}

export async function fetchChallengeLeaderboard() {
    const list = await fetchChallengeList();
    return buildLeaderboard(list, scoreChallenge);
}

export async function fetchImpossibleLeaderboard() {
    const list = await fetchImpossibleList();
    return buildImpossibleLeaderboard(list);
}

export async function fetchVerificationsLeaderboard() {
    const list = await fetchVerificationsList();
    return buildVerificationsLeaderboard(list);
}

/**
 * Leaderboard builder for the Verifications list. Only levels with
 * status === 'verified' count — 1 fixed point each, credited to
 * whoever is listed as the level's `verifier` at the time it was verified.
 */
function buildVerificationsLeaderboard(list) {
    if (!list || list.length === 0) {
        return [[], []];
    }

    const scoreMap = {};
    const errs = [];

    list.forEach(([level, err]) => {
        if (err) {
            errs.push(err);
            return;
        }
        if (level.status !== 'verified' || !level.verifier) return;

        const verifier = Object.keys(scoreMap).find(
            (u) => u.toLowerCase() === level.verifier.toLowerCase(),
        ) || level.verifier;
        scoreMap[verifier] ??= { verified: [], completed: [], progressed: [] };
        scoreMap[verifier].verified.push({
            rank: scoreMap[verifier].verified.length + 1,
            level: level.name,
            score: scoreVerifications(),
            link: level.showcase || null,
            date: level.verified_date || null,
        });
    });

    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const total = scores.verified.reduce((prev, cur) => prev + cur.score, 0);
        return {
            user,
            total: round(total),
            ...scores,
        };
    });

    return [res.sort((a, b) => b.total - a.total), errs];
}

/**
 * Leaderboard builder for the Impossible list's World Record system.
 * Every record still counts (even ones that don't beat the current WR — those
 * just score less), and records are walked in file order (chronological /
 * submission order) so we know which ones actually set a new World Record at
 * the time they were achieved. Earlier WR holders never lose their points
 * when someone later beats their percent.
 */
function buildImpossibleLeaderboard(list) {
    if (!list || list.length === 0) {
        return [[], []];
    }

    const scoreMap = {};
    const errs = [];

    list.forEach(([level, err], rank) => {
        if (err) {
            errs.push(err);
            return;
        }

        let runningMax = 0;

        (level.records || []).forEach((record) => {
            const isWorldRecord = record.percent > runningMax;
            if (isWorldRecord) runningMax = record.percent;

            const user = Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === record.user.toLowerCase(),
            ) || record.user;
            scoreMap[user] ??= { verified: [], completed: [], progressed: [] };
            const { completed, progressed } = scoreMap[user];

            const score = scoreImpossible(record.percent, isWorldRecord);
            const entry = {
                rank: rank + 1,
                level: level.name,
                score,
                link: record.link,
                isWorldRecord,
            };

            if (record.percent === 100) {
                completed.push(entry);
            } else {
                progressed.push({ ...entry, percent: record.percent });
            }
        });
    });

    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed, progressed } = scores;
        const total = [verified, completed, progressed]
            .flat()
            .reduce((prev, cur) => prev + cur.score, 0);
        return {
            user,
            total: round(total),
            ...scores,
        };
    });

    return [res.sort((a, b) => b.total - a.total), errs];
}

/**
 * Shared leaderboard-building logic, used by Classic/Platformer/Challenge.
 * Returns [[], []] safely when the list is null or empty.
 */
function buildLeaderboard(list, scoreFn) {
    // ✅ Se a lista não carregou ou está vazia, retorna resultado vazio sem quebrar
    if (!list || list.length === 0) {
        return [[], []];
    }

    const scoreMap = {};
    const errs = [];

    list.forEach(([level, err], rank) => {
        if (err) {
            errs.push(err);
            return;
        }

        const verifier = Object.keys(scoreMap).find(
            (u) => u.toLowerCase() === level.verifier.toLowerCase(),
        ) || level.verifier;
        scoreMap[verifier] ??= {
            verified: [],
            completed: [],
            progressed: [],
        };
        const { verified } = scoreMap[verifier];
        verified.push({
            rank: rank + 1,
            level: level.name,
            score: scoreFn(rank + 1, 100, level.percentToQualify),
            link: level.verification,
        });

        level.records.forEach((record) => {
            const user = Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === record.user.toLowerCase(),
            ) || record.user;
            scoreMap[user] ??= {
                verified: [],
                completed: [],
                progressed: [],
            };
            const { completed, progressed } = scoreMap[user];
            if (record.percent === 100) {
                completed.push({
                    rank: rank + 1,
                    level: level.name,
                    score: scoreFn(rank + 1, 100, level.percentToQualify),
                    link: record.link,
                });
                return;
            }
            progressed.push({
                rank: rank + 1,
                level: level.name,
                percent: record.percent,
                score: scoreFn(rank + 1, record.percent, level.percentToQualify),
                link: record.link,
            });
        });
    });

    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed, progressed } = scores;
        const total = [verified, completed, progressed]
            .flat()
            .reduce((prev, cur) => prev + cur.score, 0);
        return {
            user,
            total: round(total),
            ...scores,
        };
    });

    return [res.sort((a, b) => b.total - a.total), errs];
}
