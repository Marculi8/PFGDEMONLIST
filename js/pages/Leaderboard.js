import { fetchLeaderboard, fetchPlatformerLeaderboard, fetchChallengeLeaderboard, fetchImpossibleLeaderboard, fetchVerificationsLeaderboard } from '../content.js';
import { localize } from '../util.js';
import { computePackBonuses } from '../packScore.js';
import { withDivisionDividers, DIVISION_LABELS } from '../listDivisions.js';

import Spinner from '../components/Spinner.js';

const FETCHERS = {
    classic: fetchLeaderboard,
    platformer: fetchPlatformerLeaderboard,
    challenge: fetchChallengeLeaderboard,
    impossible: fetchImpossibleLeaderboard,
    verifications: fetchVerificationsLeaderboard,
};

export default {
    components: {
        Spinner,
    },
    data: () => ({
        mode: 'classic', // 'classic', 'platformer', 'challenge', or 'impossible'
        mobileSection: 0, // 0 = board, 1 = player detail
        carouselDir: "fwd", // 'fwd' | 'back' — direção da animação do carrossel mobile
        leaderboard: [],
        loading: true,
        selected: 0,
        err: [],
        categoryMenuOpen: false,
        searchQuery: '',
        filtersOpen: false,
        divisionFilter: 'all', // 'all', 'main', 'extended', 'extendedPlus'
        hidePackBonus: false,
        DIVISION_LABELS_: DIVISION_LABELS,
        MODE_LABELS_: {
            classic: 'Classic',
            platformer: 'Platformer',
            challenge: 'Challenge',
            impossible: 'Impossible',
            verifications: 'Verifications',
        },
    }),
    template: `
        <transition name="tab-fade" mode="out-in">
        <main v-if="loading" key="loading">
            <Spinner></Spinner>
        </main>
        <main v-else key="loaded" class="page-leaderboard-container">
            <div class="page-leaderboard">
                <div class="category-dropdown-wrapper" style="position: relative;">
                    <button
                        class="list-tab"
                        @click="categoryMenuOpen = !categoryMenuOpen"
                        style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 0.65rem 0.9rem;"
                    >
                        <span class="type-label-lg" style="flex: 1; text-align: center;">{{ MODE_LABELS_[mode] }}</span>
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
                            v-for="m in ['classic', 'platformer', 'challenge', 'impossible', 'verifications']"
                            :key="m"
                            @click="switchMode(m); categoryMenuOpen = false;"
                            class="type-label-lg"
                            :style="{
                                display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                border: 'none', cursor: 'pointer',
                                backgroundColor: mode === m ? 'var(--color-primary)' : 'transparent',
                                color: mode === m ? '#ffffff' : 'inherit',
                            }"
                        >{{ MODE_LABELS_[m] }}</button>
                    </div>
                    </transition>
                    <div v-if="categoryMenuOpen" @click="categoryMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                </div>

                <div class="search-filter-bar">
                    <div class="search-input-wrapper">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="7" />
                            <path d="M21 21l-4.3-4.3" />
                        </svg>
                        <input
                            type="text"
                            v-model="searchQuery"
                            placeholder="Search by name..."
                        >
                    </div>
                    <button
                        type="button"
                        class="filters-btn"
                        @click="filtersOpen = true"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                            <path d="M4 6h16M7 12h10M10 18h4" />
                        </svg>
                        <span class="type-label-lg">Filters</span>
                    </button>
                </div>

                <!-- ================= FILTERS POPUP ================= -->
                <transition name="tab-fade">
                <div
                    v-if="filtersOpen"
                    style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;"
                    @click.self="filtersOpen = false"
                >
                    <div style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 420px; max-height: 85vh; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.25rem 0; flex-shrink: 0;">
                            <p class="type-label-lg" style="margin: 0;">Filters</p>
                            <button type="button" @click="filtersOpen = false" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                        </div>
                        <div style="overflow-y: auto; padding: 1.25rem;">
                        <p style="opacity: 0.5; margin: 0; font-size: 0.9rem;" v-if="mode === 'impossible' || mode === 'verifications'">
                            No filters available for this list.
                        </p>
                        <template v-else>
                            <p class="type-label-md" style="opacity: 0.6; margin: 0 0 0.6rem;">Division</p>
                            <p style="opacity: 0.45; font-size: 0.8rem; margin: 0 0 0.6rem;">Filters the Verified/Completed/Progressed lists of the selected player.</p>
                            <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                                <button
                                    v-for="d in ['main', 'extended', 'extendedPlus']"
                                    :key="d"
                                    type="button"
                                    class="list-tab"
                                    :style="{
                                        borderRadius: '8px', border: '1.5px solid rgba(0,0,0,0.4)', padding: '0.55rem 1rem',
                                        backgroundColor: divisionFilter === d ? 'var(--color-primary)' : 'var(--card-bg)',
                                        color: divisionFilter === d ? '#ffffff' : 'inherit',
                                    }"
                                    @click="setDivisionFilter(d)"
                                >{{ DIVISION_LABELS_[d] }}</button>
                            </div>
                        </template>
                        </div>
                    </div>
                </div>
                </transition>
                <div class="mobile-section-nav">
                    <button type="button" @click="carouselDir = 'back'; mobileSection = 0" :disabled="mobileSection === 0" aria-label="Back to leaderboard">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <transition :name="'carousel-' + carouselDir" mode="out-in">
                        <span class="type-label-lg" :key="mobileSection">{{ mobileSection === 0 ? 'Leaderboard' : (entry ? entry.user : 'Player') }}</span>
                    </transition>
                    <button type="button" @click="carouselDir = 'fwd'; mobileSection = 1" :disabled="mobileSection === 1" aria-label="View selected player">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                </div>
                <div class="error-container">
                    <p class="error" v-if="err.length > 0">
                        Leaderboard may be incorrect, as the following levels could not be loaded: {{ err.join(', ') }}
                    </p>
                </div>
                <div class="board-container" :class="{ 'mobile-section-active': mobileSection === 0 }">
                    <div class="board-panel">
                    <table class="board">
                        <transition-group name="row-fade" tag="tbody">
                        <tr v-for="{ entry: ientry, i } in filteredLeaderboard" :key="i">
                            <td class="rank">
                                <p class="type-label-lg">#{{ i + 1 }}</p>
                            </td>
                            <td class="total">
                                <p class="type-label-lg">{{ localize(ientry.total) }}</p>
                            </td>
                            <td class="user" :class="{ 'active': selected == i }">
                                <button @click="selected = i; mobileSection = 1;">
                                    <span class="type-label-lg">{{ ientry.user }}</span>
                                </button>
                                <router-link :to="'/player/' + ientry.user" class="type-label-lg profile-link" @click.stop>
                                    ↗
                                </router-link>
                            </td>
                        </tr>
                        </transition-group>
                    </table>
                    <p v-if="leaderboard.length > 0 && filteredLeaderboard.length === 0" style="opacity: 0.5; text-align: center; padding: 1.5rem 1rem;">
                        No players match your search.
                    </p>
                    </div>
                </div>
                <div class="player-container" :class="{ 'mobile-section-active': mobileSection === 1 }">
                    <p v-if="!entry" style="opacity: 0.5; padding: 1.5rem;">No entries yet.</p>
                    <transition v-else name="tab-fade" mode="out-in">
                    <div class="player" :key="entry.user">
                        <h1 style="text-align: center;">
                            <router-link :to="'/player/' + entry.user" class="profile-link-header">
                                #{{ selected + 1 }} {{ entry.user }}
                            </router-link>
                        </h1>
                        <transition name="tab-fade" mode="out-in">
                        <h3 style="text-align: center;" :key="displayedTotal">{{ displayedTotal }}</h3>
                        </transition>
                        <transition name="alert-fade" mode="out-in">
                        <p v-if="divisionFilter !== 'all'" key="division-note" style="opacity: 0.6; font-size: 0.85rem; margin: -0.5rem 0 0.5rem; text-align: center;">points in {{ DIVISION_LABELS_[divisionFilter] }} (packs excluded)</p>
                        <p v-else-if="entry.packBonus && !hidePackBonus" key="pack-note" style="opacity: 0.6; font-size: 0.85rem; margin: -0.5rem 0 0.5rem; text-align: center;">(+{{ entry.packBonus }} from packs)</p>
                        </transition>
                        <label style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; margin: 0.25rem 0 0.75rem; font-size: 0.8rem; opacity: 0.7; cursor: pointer;">
                            <input type="checkbox" v-model="hidePackBonus">
                            Hide pack points (visual only, for comparison)
                        </label>
                        <h2 v-if="entry.verified.length > 0" style="text-align: center;">Verified ({{ divisionFilteredVerified.length }})</h2>
                        <table class="records">
                            <colgroup>
                                <col style="width: 4.25rem;">
                                <col>
                                <col style="width: 6rem;">
                            </colgroup>
                            <transition-group name="row-fade" tag="tbody">
                            <tr v-for="row in verifiedWithDividers" :key="row.divider ? row.key : row.item.rank">
                                <td v-if="row.divider" colspan="3" style="padding: 0.5rem 1rem; text-align: center; opacity: 0.65; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; background-color: var(--color-background-hover); border-radius: 8px;">{{ row.label }}</td>
                                <template v-else>
                                    <td class="rank">
                                        <p>#{{ row.item.rank }}</p>
                                    </td>
                                    <td class="level">
                                        <a class="type-label-lg" target="_blank" :href="row.item.link">{{ row.item.level }}</a>
                                    </td>
                                    <td class="score">
                                        <p>+{{ localize(row.item.score) }}</p>
                                    </td>
                                </template>
                            </tr>
                            </transition-group>
                        </table>
                        <h2 v-if="entry.completed.length > 0" style="text-align: center;">Completed ({{ divisionFilteredCompleted.length }})</h2>
                        <table class="records">
                            <colgroup>
                                <col style="width: 4.25rem;">
                                <col>
                                <col style="width: 6rem;">
                            </colgroup>
                            <transition-group name="row-fade" tag="tbody">
                            <tr v-for="row in completedWithDividers" :key="row.divider ? row.key : row.item.rank">
                                <td v-if="row.divider" colspan="3" style="padding: 0.5rem 1rem; text-align: center; opacity: 0.65; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; background-color: var(--color-background-hover); border-radius: 8px;">{{ row.label }}</td>
                                <template v-else>
                                    <td class="rank">
                                        <p>#{{ row.item.rank }}</p>
                                    </td>
                                    <td class="level">
                                        <a class="type-label-lg" target="_blank" :href="row.item.link">{{ row.item.level }}</a>
                                    </td>
                                    <td class="score">
                                        <p>+{{ localize(row.item.score) }}</p>
                                    </td>
                                </template>
                            </tr>
                            </transition-group>
                        </table>
                        <h2 v-if="entry.progressed.length > 0">Progressed ({{ divisionFilteredProgressed.length }})</h2>
                        <table class="records">
                            <colgroup>
                                <col style="width: 4.25rem;">
                                <col>
                                <col style="width: 6rem;">
                            </colgroup>
                            <transition-group name="row-fade" tag="tbody">
                            <tr v-for="row in progressedWithDividers" :key="row.divider ? row.key : row.item.rank">
                                <td v-if="row.divider" colspan="3" style="padding: 0.5rem 1rem; text-align: center; opacity: 0.65; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; background-color: var(--color-background-hover); border-radius: 8px;">{{ row.label }}</td>
                                <template v-else>
                                    <td class="rank">
                                        <p>#{{ row.item.rank }}</p>
                                    </td>
                                    <td class="level">
                                        <a class="type-label-lg" target="_blank" :href="row.item.link">{{ row.item.percent }}% {{ row.item.level }}</a>
                                    </td>
                                    <td class="score">
                                        <p>+{{ localize(row.item.score) }}</p>
                                    </td>
                                </template>
                            </tr>
                            </transition-group>
                        </table>
                    </div>
                    </transition>
                </div>
            </div>
        </main>
        </transition>
    `,
    computed: {
        entry() {
            return this.leaderboard[this.selected];
        },
        showDividers() {
            return ['classic', 'platformer', 'challenge'].includes(this.mode);
        },
        divisionFilteredVerified() {
            if (!this.entry) return [];
            return this.filterByDivision(this.entry.verified);
        },
        divisionFilteredCompleted() {
            if (!this.entry) return [];
            return this.filterByDivision(this.entry.completed);
        },
        divisionFilteredProgressed() {
            if (!this.entry) return [];
            return this.filterByDivision(this.entry.progressed);
        },
        displayedTotal() {
            if (this.divisionFilter !== 'all') {
                return this.divisionTotal;
            }
            const base = this.entry.total;
            if (this.hidePackBonus && this.entry.packBonus) {
                return Math.round((base - this.entry.packBonus) * 1000) / 1000;
            }
            return base;
        },
        divisionTotal() {
            const items = [...this.divisionFilteredVerified, ...this.divisionFilteredCompleted, ...this.divisionFilteredProgressed];
            return Math.round(items.reduce((sum, it) => sum + (it.score || 0), 0) * 1000) / 1000;
        },
        verifiedWithDividers() {
            if (!this.entry) return [];
            if (!this.showDividers || this.divisionFilter !== 'all') return this.divisionFilteredVerified.map((item) => ({ divider: false, item }));
            return withDivisionDividers(this.divisionFilteredVerified, (item) => item.rank);
        },
        completedWithDividers() {
            if (!this.entry) return [];
            if (!this.showDividers || this.divisionFilter !== 'all') return this.divisionFilteredCompleted.map((item) => ({ divider: false, item }));
            return withDivisionDividers(this.divisionFilteredCompleted, (item) => item.rank);
        },
        progressedWithDividers() {
            if (!this.entry) return [];
            if (!this.showDividers || this.divisionFilter !== 'all') return this.divisionFilteredProgressed.map((item) => ({ divider: false, item }));
            return withDivisionDividers(this.divisionFilteredProgressed, (item) => item.rank);
        },
        filteredLeaderboard() {
            const q = this.searchQuery.trim().toLowerCase();
            return this.leaderboard
                .map((entry, i) => ({ entry, i }))
                .filter(({ entry }) => !q || (entry.user && entry.user.toLowerCase().includes(q)));
        },
    },
    async mounted() {
        await this.loadLeaderboard();
    },
    methods: {
        localize,
        async loadLeaderboard() {
            this.loading = true;
            this.selected = 0;

            const fetcher = FETCHERS[this.mode];
            const [leaderboard, err] = await fetcher();

            if (['classic', 'platformer', 'challenge'].includes(this.mode)) {
                const { byPlayer } = await computePackBonuses();
                const bonuses = byPlayer[this.mode] || {};
                leaderboard.forEach((entry) => {
                    const bonus = bonuses[entry.user.toLowerCase()] || 0;
                    if (bonus > 0) {
                        entry.packBonus = bonus;
                        entry.total = Math.round((entry.total + bonus) * 1000) / 1000;
                    }
                });
                leaderboard.sort((a, b) => b.total - a.total);
            }

            this.leaderboard = leaderboard;
            this.err = err;

            this.loading = false;
        },
        filterByDivision(items) {
            if (this.divisionFilter === 'all' || !this.showDividers) return items;
            return items.filter((item) => {
                const rank = item.rank;
                if (this.divisionFilter === 'main') return rank <= 75;
                if (this.divisionFilter === 'extended') return rank > 75 && rank <= 150;
                if (this.divisionFilter === 'extendedPlus') return rank > 150;
                return true;
            });
        },
        setDivisionFilter(value) {
            this.divisionFilter = this.divisionFilter === value ? 'all' : value;
        },
        async switchMode(mode) {
            if (this.mode === mode) return;
            this.mode = mode;
            this.mobileSection = 0;
            await this.loadLeaderboard();
        },
    },
};
