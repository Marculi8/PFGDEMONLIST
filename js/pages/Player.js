import { localize, embed } from '../util.js';
import { supabase } from '../supabase.js';
import { computePackBonuses } from '../packScore.js';
import {
    fetchLeaderboard,
    fetchPlatformerLeaderboard,
    fetchChallengeLeaderboard,
    fetchImpossibleLeaderboard,
    fetchVerificationsLeaderboard,
    fetchList,
    fetchPlatformerList,
    fetchChallengeList,
    fetchImpossibleList,
    fetchVerificationsList,
    fetchPlayers,
} from '../content.js';
import { scoreClassic, scorePlatformer, scoreChallenge, scoreImpossible, scoreVerifications } from '../score.js';

import Spinner from '../components/Spinner.js';
import LevelAuthors from '../components/List/LevelAuthors.js';

const LEADERBOARD_FETCHERS = {
    classic: fetchLeaderboard,
    platformer: fetchPlatformerLeaderboard,
    challenge: fetchChallengeLeaderboard,
    impossible: fetchImpossibleLeaderboard,
    verifications: fetchVerificationsLeaderboard,
};

const LIST_FETCHERS = {
    classic: fetchList,
    platformer: fetchPlatformerList,
    challenge: fetchChallengeList,
    impossible: fetchImpossibleList,
    verifications: fetchVerificationsList,
};

const SCORERS = {
    classic: scoreClassic,
    platformer: scorePlatformer,
    challenge: scoreChallenge,
    impossible: scoreImpossible,
    verifications: scoreVerifications,
};

const LIST_LABELS = {
    classic: 'Classic',
    platformer: 'Platformer',
    challenge: 'Challenge',
    impossible: 'Impossible',
    verifications: 'Verified',
};

export default {
    components: { Spinner, LevelAuthors },
    data: () => ({
        mode: 'classic',
        mobileSection: 1, // 0 = records list, 1 = profile, 2 = statistics
        carouselDir: "fwd", // 'fwd' | 'back' — direção da animação do carrossel mobile
        categoryMenuOpen: false,
        playerData: null,
        playerProfile: null,
        isClaimedAccount: false,
        allStats: null,
        packStats: null,
        levelMap: {},
        selectedLevel: null,
        loading: true,
        notFound: false,
        err: [],
    }),
    template: `
        <transition name="tab-fade" mode="out-in">
        <main v-if="loading" key="loading">
            <Spinner></Spinner>
        </main>
        <main v-else key="loaded" class="page-list">

            <!-- Navegação entre as 3 seções, só aparece no mobile -->
            <div class="mobile-section-nav" v-if="!notFound">
                <button type="button" @click="carouselDir = 'back'; mobileSection = Math.max(0, mobileSection - 1)" :disabled="mobileSection === 0" aria-label="Previous section">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <transition :name="'carousel-' + carouselDir" mode="out-in">
                    <span class="type-label-lg" :key="mobileSection">{{ ['Records', playerName, 'Statistics'][mobileSection] }}</span>
                </transition>
                <button type="button" @click="carouselDir = 'fwd'; mobileSection = Math.min(2, mobileSection + 1)" :disabled="mobileSection === 2" aria-label="Next section">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
            </div>

            <div class="list-container" :class="{ 'mobile-section-active': mobileSection === 0 }">
                <div v-if="notFound" style="padding: 2rem;">
                    <h2>Player not found</h2>
                    <p>No records found for "{{ playerName }}".</p>
                </div>

                <template v-else>
                    <h2 style="padding: 1.25rem 1rem 1rem; text-align: center;">{{ playerName }}</h2>

                    <div style="display: flex; justify-content: center; margin-bottom: 1.5rem; padding: 0 1rem;">
                        <div style="position: relative; width: 100%; max-width: 22rem;">
                        <button
                            class="list-tab"
                            @click="categoryMenuOpen = !categoryMenuOpen"
                            style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 0.65rem 0.9rem;"
                        >
                            <span class="type-label-lg" style="flex: 1; text-align: center;">{{ listLabels[mode] }}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: categoryMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                        <transition name="tab-fade">
                        <div
                            v-if="categoryMenuOpen"
                            style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; overflow: hidden; z-index: 20;"
                        >
                            <button
                                v-for="(label, key) in listLabels"
                                :key="key"
                                class="type-label-lg"
                                @click="switchMode(key); categoryMenuOpen = false;"
                                :style="{
                                    display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                    border: 'none', cursor: 'pointer',
                                    backgroundColor: mode === key ? 'var(--color-primary)' : 'transparent',
                                    color: mode === key ? '#ffffff' : 'inherit',
                                }"
                            >{{ label }}</button>
                        </div>
                        </transition>
                        <div v-if="categoryMenuOpen" @click="categoryMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                        </div>
                    </div>

                    <div class="error-container" v-if="err.length > 0">
                        <p class="error">Data may be incomplete: {{ err.join(', ') }}</p>
                    </div>

                    <div v-if="playerData" class="list-panel" style="margin: 0 0.5rem;">
                        <p style="padding: 0.5rem; opacity: 0.6; font-size: 0.9rem;">
                            Total: {{ localize(playerData.total) }}
                        </p>

                        <template v-if="playerData.verified.length > 0">
                            <p class="type-label-lg" style="padding: 0.25rem 0.5rem; opacity: 0.5;">Verified ({{ playerData.verified.length }})</p>
                            <table class="list">
                                <tr v-for="score in playerData.verified" :class="{ 'active': selectedLevel && selectedLevel.name === score.level }">
                                    <td class="rank"><p class="type-label-lg">#{{ score.rank }}</p></td>
                                    <td class="level">
                                        <button @click="selectLevel(score.level)">
                                            <span class="type-label-lg">{{ score.level }}</span>
                                        </button>
                                    </td>
                                </tr>
                            </table>
                        </template>

                        <template v-if="playerData.completed.length > 0">
                            <p class="type-label-lg" style="padding: 0.75rem 0.5rem 0.25rem; opacity: 0.5;">Completed ({{ playerData.completed.length }})</p>
                            <table class="list">
                                <tr v-for="score in playerData.completed" :class="{ 'active': selectedLevel && selectedLevel.name === score.level }">
                                    <td class="rank"><p class="type-label-lg">#{{ score.rank }}</p></td>
                                    <td class="level">
                                        <button @click="selectLevel(score.level)">
                                            <span class="type-label-lg">{{ score.level }}</span>
                                        </button>
                                    </td>
                                </tr>
                            </table>
                        </template>

                        <template v-if="playerData.progressed.length > 0">
                            <p class="type-label-lg" style="padding: 0.75rem 0.5rem 0.25rem; opacity: 0.5;">Progressed ({{ playerData.progressed.length }})</p>
                            <table class="list">
                                <tr v-for="score in playerData.progressed" :class="{ 'active': selectedLevel && selectedLevel.name === score.level }">
                                    <td class="rank"><p class="type-label-lg">#{{ score.rank }}</p></td>
                                    <td class="level">
                                        <button @click="selectLevel(score.level)">
                                            <span class="type-label-lg">{{ score.percent }}% {{ score.level }}</span>
                                        </button>
                                    </td>
                                </tr>
                            </table>
                        </template>

                        <p
                            v-if="playerData.verified.length === 0 && playerData.completed.length === 0 && playerData.progressed.length === 0"
                            style="padding: 1rem; opacity: 0.6;"
                        >
                            No records on {{ listLabels[mode] }} list.
                        </p>
                    </div>
                </template>
            </div>

            <div class="level-container" :class="{ 'mobile-section-active': mobileSection === 1 }">
                <div class="level" v-if="!notFound">

                    <div class="player-profile-card">
                    <div class="player-profile-header">
                        <div class="player-avatar-wrapper">
                            <img
                                v-if="playerProfile && playerProfile.avatar"
                                :src="playerProfile.avatar"
                                :alt="playerName"
                                class="player-avatar"
                            >
                            <div v-else class="player-avatar-placeholder">
                                {{ playerName.charAt(0).toUpperCase() }}
                            </div>
                        </div>
                        <div class="player-profile-info">
                            <h1 style="margin: 0;">{{ playerName }}</h1>
                            <div class="player-socials" v-if="playerProfile">
                                <a v-if="playerProfile.youtube" :href="playerProfile.youtube" target="_blank" class="social-link social-youtube" title="YouTube">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                </a>
                                <a v-if="playerProfile.twitter" :href="playerProfile.twitter" target="_blank" class="social-link social-twitter" title="X / Twitter">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                                </a>
                                <span v-if="playerProfile.discord" class="social-link social-discord" :title="'Discord: ' + playerProfile.discord" style="cursor: default;">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                                    <span style="font-size: 0.85rem; margin-left: 4px;">{{ playerProfile.discord }}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <p v-if="playerProfile && playerProfile.bio" class="player-bio">{{ playerProfile.bio }}</p>
                    <p v-else class="player-bio player-bio-empty">No bio yet.</p>
                    </div>

                    <template v-if="selectedLevel">
                    <transition name="tab-fade" mode="out-in">
                    <div :key="selectedLevel.path || selectedLevel.name" style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 1rem;">
                            <img
                                v-if="selectedLevel.difficulty && selectedLevel.rating"
                                :src="\`/assets/difficulty/\${selectedLevel.difficulty}_\${selectedLevel.rating}.png\`"
                                :alt="selectedLevel.difficulty"
                                style="height: 3.4rem; width: auto; flex-shrink: 0;"
                            >
                            <h2 style="margin: 0; text-align: center;">{{ selectedLevel.name }}</h2>
                        </div>
                        <LevelAuthors :author="selectedLevel.author" :creators="selectedLevel.creators" :verifier="selectedLevel.verifier"></LevelAuthors>
                        <iframe class="video" :src="levelVideo" frameborder="0" allowfullscreen></iframe>
                        <ul class="stats">
                            <li>
                                <div class="type-title-sm">Points when completed</div>
                                <p>{{ levelScore }}</p>
                            </li>
                            <li>
                                <div class="type-title-sm">ID</div>
                                <p>{{ selectedLevel.id }}</p>
                            </li>
                            <li>
                                <div class="type-title-sm">Password</div>
                                <p>{{ selectedLevel.password || 'Free to Copy' }}</p>
                            </li>
                        </ul>
                    </div>
                    </transition>
                    </template>
                    <p v-else style="opacity: 0.4; text-align: center; margin-top: 1rem;">← Click a level to preview it</p>

                </div>
            </div>

            <div class="meta-container" :class="{ 'mobile-section-active': mobileSection === 2 }">
                <div class="meta" v-if="!notFound && allStats">
                    <h3>Statistics</h3>

                    <div v-for="(label, key) in listLabels" class="player-stat-block">
                        <h4 class="player-stat-title">{{ label }}</h4>
                        <template v-if="allStats[key]">
                            <ul class="player-stat-list">
                                <li>
                                    <span class="stat-label">Rank</span>
                                    <span class="stat-value">#{{ allStats[key].rank }}</span>
                                </li>
                                <li>
                                    <span class="stat-label">Score</span>
                                    <span class="stat-value">{{ localize(allStats[key].total) }}</span>
                                </li>
                                <li>
                                    <span class="stat-label">Verified</span>
                                    <span class="stat-value">{{ allStats[key].verified }}</span>
                                </li>
                                <li v-if="key !== 'verifications'">
                                    <span class="stat-label">Completed</span>
                                    <span class="stat-value">{{ allStats[key].completed }}</span>
                                </li>
                                <li v-if="key !== 'verifications' && allStats[key].progressed > 0">
                                    <span class="stat-label">Progressed</span>
                                    <span class="stat-value">{{ allStats[key].progressed }}</span>
                                </li>
                            </ul>
                        </template>
                        <p v-else style="opacity: 0.4; font-size: 0.85rem; margin: 0.25rem 0 0;">No records.</p>
                    </div>

                    <div v-if="packStats && packStats.total > 0" class="player-stat-block">
                        <h4 class="player-stat-title">Packs</h4>
                        <ul class="player-stat-list">
                            <li>
                                <span class="stat-label">Total from Packs</span>
                                <span class="stat-value">{{ localize(packStats.total) }}</span>
                            </li>
                            <li v-if="packStats.classic > 0">
                                <span class="stat-label">Classic</span>
                                <span class="stat-value">{{ localize(packStats.classic) }}</span>
                            </li>
                            <li v-if="packStats.platformer > 0">
                                <span class="stat-label">Platformer</span>
                                <span class="stat-value">{{ localize(packStats.platformer) }}</span>
                            </li>
                            <li v-if="packStats.challenge > 0">
                                <span class="stat-label">Challenge</span>
                                <span class="stat-value">{{ localize(packStats.challenge) }}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

        </main>
        </transition>
    `,
    computed: {
        playerName() {
            return this.$route.params.name;
        },
        listLabels() {
            return LIST_LABELS;
        },
        levelVideo() {
            if (!this.selectedLevel) return '';

            const customVideos = this.playerProfile?.videos || {};
            const normalize = (str) => str.replace(/[_\s]+/g, '').toLowerCase();
            const normalizedLevelName = normalize(this.selectedLevel.name);

            const customLink = Object.entries(customVideos).find(
                ([key]) => normalize(key) === normalizedLevelName
            )?.[1];

            const src = customLink || this.selectedLevel.showcase || this.selectedLevel.verification;
            return embed(src);
        },
        levelScore() {
            if (!this.selectedLevel) return 0;
            return SCORERS[this.mode](
                this.selectedLevel._rank,
                100,
                this.selectedLevel.percentToQualify,
            );
        },
    },
    watch: {
        mobileSection() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
    },
    async mounted() {
        await this.loadMode();
    },
    methods: {
        localize,

        async loadPlayerProfile(playersMap) {
            const { data: claimedProfile } = await supabase
                .from('profiles')
                .select('avatar, bio, youtube, twitter, discord, videos, list_name, username')
                .ilike('list_name', this.playerName)
                .maybeSingle();

            if (claimedProfile) {
                this.playerProfile = claimedProfile;
                this.isClaimedAccount = true;
                return;
            }

            // Contas sem list_name ainda (nenhum record/claim) ficam acessíveis pelo username.
            const { data: byUsername } = await supabase
                .from('profiles')
                .select('avatar, bio, youtube, twitter, discord, videos, list_name, username')
                .ilike('username', this.playerName)
                .is('list_name', null)
                .maybeSingle();

            if (byUsername) {
                this.playerProfile = byUsername;
                this.isClaimedAccount = true;
                return;
            }

            this.playerProfile = playersMap[this.playerName.toLowerCase()] || null;
            this.isClaimedAccount = false;
        },

        selectLevel(levelName) {
            const level = this.levelMap[levelName.toLowerCase()];
            if (level) this.selectedLevel = level;
            this.mobileSection = 1;
        },

        async loadMode() {
            this.loading = true;
            this.err = [];
            this.playerData = null;
            this.selectedLevel = null;
            this.levelMap = {};

            const [
                lbResult,
                listResult,
                playersMap,
                classicLb,
                platformerLb,
                challengeLb,
                impossibleLb,
                verificationsLb,
            ] = await Promise.all([
                LEADERBOARD_FETCHERS[this.mode](),
                LIST_FETCHERS[this.mode](),
                fetchPlayers(),
                fetchLeaderboard(),
                fetchPlatformerLeaderboard(),
                fetchChallengeLeaderboard(),
                fetchImpossibleLeaderboard(),
                fetchVerificationsLeaderboard(),
            ]);

            const [leaderboard, lbErr] = lbResult;
            this.err = lbErr;

            await this.loadPlayerProfile(playersMap);

            if (listResult) {
                listResult.forEach(([level, err], index) => {
                    if (level) {
                        this.levelMap[level.name.toLowerCase()] = {
                            ...level,
                            _rank: index + 1,
                        };
                    }
                });
            }

            // Soma os pontos de pack em Classic/Platformer/Challenge, e reordena
            // (mesma lógica da página de Leaderboard) antes de extrair o rank/score.
            const { byPlayer } = await computePackBonuses();
            const applyPackBonus = (lb, listType) => {
                const bonuses = byPlayer[listType] || {};
                lb.forEach((e) => {
                    const bonus = bonuses[e.user.toLowerCase()] || 0;
                    if (bonus > 0) {
                        e.packBonus = bonus;
                        e.total = Math.round((e.total + bonus) * 1000) / 1000;
                    }
                });
                lb.sort((a, b) => b.total - a.total);
            };
            applyPackBonus(classicLb[0], 'classic');
            applyPackBonus(platformerLb[0], 'platformer');
            applyPackBonus(challengeLb[0], 'challenge');

            const modeLeaderboard = { classic: classicLb[0], platformer: platformerLb[0], challenge: challengeLb[0] }[this.mode] || leaderboard;

            const entry = modeLeaderboard.find(
                (e) => e.user.toLowerCase() === this.playerName.toLowerCase(),
            );

            if (!entry && !this.playerProfile) {
                this.notFound = true;
                this.loading = false;
                return;
            }

            this.notFound = false;
            this.playerData = entry || {
                user: this.playerName,
                total: 0,
                verified: [],
                completed: [],
                progressed: [],
            };

            const allLeaderboards = {
                classic: classicLb[0],
                platformer: platformerLb[0],
                challenge: challengeLb[0],
                impossible: impossibleLb[0],
                verifications: verificationsLb[0],
            };

            const stats = {};
            for (const [key, lb] of Object.entries(allLeaderboards)) {
                const idx = lb.findIndex(
                    (e) => e.user.toLowerCase() === this.playerName.toLowerCase(),
                );
                if (idx !== -1) {
                    const e = lb[idx];
                    stats[key] = {
                        rank: idx + 1,
                        total: e.total,
                        verified: e.verified.length,
                        completed: e.completed.length,
                        progressed: e.progressed.length,
                    };
                } else {
                    stats[key] = null;
                }
            }
            this.allStats = stats;

            const nameLower = this.playerName.toLowerCase();
            const packStats = {
                classic: byPlayer.classic[nameLower] || 0,
                platformer: byPlayer.platformer[nameLower] || 0,
                challenge: byPlayer.challenge[nameLower] || 0,
            };
            packStats.total = Math.round((packStats.classic + packStats.platformer + packStats.challenge) * 1000) / 1000;
            this.packStats = packStats;

            this.loading = false;
        },

        async switchMode(mode) {
            if (this.mode === mode) return;
            this.mode = mode;
            this.loading = true;
            this.selectedLevel = null;
            this.levelMap = {};
            this.err = [];

            const [lbResult, listResult] = await Promise.all([
                LEADERBOARD_FETCHERS[mode](),
                LIST_FETCHERS[mode](),
            ]);

            const [leaderboard, lbErr] = lbResult;
            this.err = lbErr;

            if (listResult) {
                listResult.forEach(([level, err], index) => {
                    if (level) {
                        this.levelMap[level.name.toLowerCase()] = {
                            ...level,
                            _rank: index + 1,
                        };
                    }
                });
            }

            const entry = leaderboard.find(
                (e) => e.user.toLowerCase() === this.playerName.toLowerCase(),
            );

            this.playerData = entry || {
                user: this.playerName,
                total: 0,
                verified: [],
                completed: [],
                progressed: [],
            };
            this.loading = false;
        },
    },
};
