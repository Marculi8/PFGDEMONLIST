import { store } from "../main.js";
import { supabase, hasRole } from "../supabase.js";
import {
    fetchList,
    fetchPlatformerList,
    fetchChallengeList,
} from "../content.js";
import { scoreClassic, scorePlatformer, scoreChallenge } from "../score.js";

import Spinner from "../components/Spinner.js";
import { computePackBonuses } from "../packScore.js";
import { tierGradientCSS } from "../tierGradient.js";
import { isNew, NEW_BADGE_DAYS, matchesBadgeFilter, BADGE_FILTER_LABELS } from "../newBadge.js";

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

const LIST_LABELS = {
    classic: "Classic",
    platformer: "Platformer",
    challenge: "Challenge",
};

export default {
    components: { Spinner },
    template: `
        <transition name="tab-fade" mode="out-in">
        <main v-if="loading" key="loading">
            <Spinner></Spinner>
        </main>
        <main v-else key="loaded" class="page-list">
            <!-- Navegação entre as 2 seções, só aparece no mobile -->
            <div class="mobile-section-nav">
                <button type="button" @click="carouselDir = 'back'; mobileSection = Math.max(0, mobileSection - 1)" :disabled="mobileSection === 0" aria-label="Previous section">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <transition :name="'carousel-' + carouselDir" mode="out-in">
                    <span class="type-label-lg" :key="mobileSection">{{ mobileSection === 0 ? 'Packs' : (selectedPack ? selectedPack.name : 'Details') }}</span>
                </transition>
                <button type="button" @click="carouselDir = 'fwd'; mobileSection = Math.min(1, mobileSection + 1)" :disabled="mobileSection === 1" aria-label="Next section">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
            </div>

            <!-- ================= LISTA DE PACKS ================= -->
            <div class="list-container" :class="{ 'mobile-section-active': mobileSection === 0 }">
                <h1 style="text-align: center;">Packs</h1>

                <router-link v-if="store.user" to="/packs/suggest" class="suggest-level-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span class="type-label-lg">Suggest Pack</span>
                </router-link>

                <router-link
                    v-if="isStaff"
                    to="/packs/new"
                    class="suggest-level-btn"
                    style="background-image: none; background-color: #767676; margin-top: 0.5rem;"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span class="type-label-lg">New Pack</span>
                </router-link>

                <router-link
                    v-if="isAdmin"
                    to="/admin/manage-packs"
                    class="suggest-level-btn"
                    style="background-image: none; background-color: #767676; margin-top: 0.5rem;"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span class="type-label-lg">Manage Packs</span>
                </router-link>

                <router-link
                    v-if="isStaff"
                    to="/admin/manage-tiers"
                    class="suggest-level-btn"
                    style="background-image: none; background-color: #767676; margin-top: 0.5rem;"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 3a9 9 0 0 1 0 18" />
                    </svg>
                    <span class="type-label-lg">Manage Tiers</span>
                </router-link>

                <button
                    v-if="store.user && claimableCount > 0"
                    type="button"
                    class="suggest-level-btn"
                    style="background-image: none; background-color: #22c55e; margin-top: 0.5rem;"
                    :disabled="collectingRewards"
                    @click="collectAllRewards"
                >
                    <svg v-if="!collectingRewards" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span class="type-label-lg">{{ collectingRewards ? 'Collecting...' : 'Collect Points (' + claimableCount + ')' }}</span>
                </button>

                <transition name="alert-fade">
                <div v-if="collectFeedback" class="login-alert login-alert-success" style="margin-top: 0.6rem;">{{ collectFeedback }}</div>
                </transition>

                <div style="position: relative; margin-top: 0.6rem;">
                    <button
                        type="button"
                        class="list-tab"
                        @click="listTypeMenuOpen = !listTypeMenuOpen"
                        style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 0.65rem 0.9rem;"
                    >
                        <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ listTypeFilter === 'all' ? 'All Lists' : LIST_LABELS_[listTypeFilter] }}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: listTypeMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                            <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </button>
                    <transition name="dropdown-fade">
                    <div
                        v-if="listTypeMenuOpen"
                        style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; overflow: hidden; z-index: 20;"
                    >
                        <button
                            v-for="lt in ['all', 'classic', 'platformer', 'challenge']"
                            :key="lt"
                            type="button"
                            @click="listTypeFilter = lt; listTypeMenuOpen = false;"
                            class="type-label-lg"
                            :style="{
                                display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                border: 'none', cursor: 'pointer',
                                backgroundColor: listTypeFilter === lt ? 'var(--color-primary)' : 'transparent',
                                color: listTypeFilter === lt ? '#ffffff' : 'inherit',
                            }"
                        >{{ lt === 'all' ? 'All Lists' : LIST_LABELS_[lt] }}</button>
                    </div>
                    </transition>
                    <div v-if="listTypeMenuOpen" @click="listTypeMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                </div>

                <div class="search-filter-bar">
                    <div class="search-input-wrapper">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="7" />
                            <path d="M21 21l-4.3-4.3" />
                        </svg>
                        <input type="text" v-model="searchQuery" placeholder="Search...">
                    </div>
                    <button type="button" class="filters-btn" @click="filtersOpen = !filtersOpen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 6h16M7 12h10M10 18h4" />
                        </svg>
                        <span class="type-label-lg">Filters</span>
                        <span v-if="activeTierFilters.length" class="filter-count">{{ activeTierFilters.length }}</span>
                    </button>
                </div>

                <transition name="tab-fade">
                <div v-if="filtersOpen" style="margin-top: 0.6rem; padding: 1rem; border-radius: 10px; background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%); max-height: 320px; overflow-y: auto;">
                    <p class="type-label-md" style="opacity: 0.6; margin: 0 0 0.6rem;">Tiers</p>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button
                            v-for="t in tiers"
                            :key="t.id"
                            type="button"
                            :style="{
                                fontSize: '0.85rem', borderRadius: '8px', border: '1.5px solid rgba(0,0,0,0.4)', padding: '0.5rem 0.85rem', cursor: 'pointer',
                                backgroundColor: activeTierFilters.includes(t.id) ? 'var(--color-primary)' : 'var(--card-bg)',
                                color: activeTierFilters.includes(t.id) ? '#ffffff' : 'inherit',
                            }"
                            @click="toggleTierFilter(t.id)"
                        >{{ t.name }}</button>
                    </div>

                    <p class="type-label-md" style="opacity: 0.6; margin: 1.25rem 0 0.6rem;">Badge</p>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button
                            v-for="b in ['new', 'none']"
                            :key="b"
                            type="button"
                            :style="{
                                fontSize: '0.85rem', borderRadius: '8px', border: '1.5px solid rgba(0,0,0,0.4)', padding: '0.5rem 0.85rem', cursor: 'pointer',
                                backgroundColor: badgeFilter === b ? 'var(--color-primary)' : 'var(--card-bg)',
                                color: badgeFilter === b ? '#ffffff' : 'inherit',
                            }"
                            @click="setBadgeFilter(b)"
                        >{{ BADGE_FILTER_LABELS_[b] }}</button>
                    </div>
                </div>
                </transition>

                <div class="list-panel">
                    <p v-if="visibleTiers.length === 0" style="opacity: 0.5; text-align: center; padding: 2rem 1rem;">
                        No packs match your search/filters.
                    </p>

                    <div v-for="tier in visibleTiers" :key="tier.id" style="margin-top: 1.25rem; border-radius: 12px; padding: 2px; box-sizing: border-box; overflow: hidden; background-size: 100% 400px; background-position: top; background-repeat: no-repeat;" :style="{ backgroundImage: tierGradientCSS_(tier) }">
                        <div style="border-radius: 10px; overflow: hidden;">
                        <div
                            style="padding: 0.85rem 1rem; background-size: 100% 400px; background-position: top; background-repeat: no-repeat;"
                            :style="{ backgroundImage: tierGradientCSS_(tier) }"
                        >
                            <span class="type-label-lg" style="color: #14141a; text-shadow: 0 1px 2px rgba(255,255,255,0.35);">{{ tier.name }} Tier</span>
                        </div>

                        <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; background-color: var(--card-bg); overflow-y: auto; max-height: 340px;">
                            <button
                                v-for="p in tier.packs"
                                :key="p.id"
                                type="button"
                                @click="selectPack(p)"
                                style="display: block; width: 100%; box-sizing: border-box; padding: 0.85rem 1rem; text-align: left; border: none; cursor: pointer; background: none; color: inherit; border-top: 1px solid rgba(255,255,255,0.06);"
                            >
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
                                    <span class="type-label-lg" style="display: flex; align-items: center; gap: 0.4rem;">
                                        <span v-if="p.icon_emoji">{{ p.icon_emoji }}</span>
                                        <img v-else-if="p.icon_image_url" :src="p.icon_image_url" style="width: 1.3rem; height: 1.3rem; border-radius: 50%; object-fit: cover;">
                                        {{ p.name }}
                                        <span v-if="isNewItem(p.created_at, 'pack')" class="new-badge">New</span>
                                    </span>
                                    <span style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0;">
                                        <svg v-if="p.total > 0 && p.completedCount === p.total" width="16" height="16" viewBox="0 0 24 24" style="flex-shrink: 0;">
                                            <circle cx="12" cy="12" r="11" fill="#22c55e" />
                                            <path d="M7 12.5 L10.5 16 L17 8.5" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
                                        </svg>
                                        <span style="opacity: 0.7; font-size: 0.9rem;">{{ p.completedCount }}/{{ p.total }}</span>
                                    </span>
                                </div>
                                <div style="margin-top: 0.5rem; height: 6px; border-radius: 999px; background-color: rgba(255,255,255,0.08); overflow: hidden;">
                                    <div :style="{ width: p.percent + '%', height: '100%', backgroundImage: tierGradientCSS_(tier), transition: 'width 0.3s ease' }"></div>
                                </div>
                            </button>
                        </transition-group>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ================= DETALHE DO PACK ================= -->
            <div class="level-container" style="grid-column: span 2; min-width: 0; box-sizing: border-box;" :class="{ 'mobile-section-active': mobileSection === 1 }">
                <transition name="tab-fade" mode="out-in">
                <div class="level" v-if="selectedPack" :key="selectedPack.id" style="margin-top: 2.5rem; min-width: 0;">
                    <div style="padding: 1.5rem; border-radius: 12px; background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%); box-sizing: border-box;">

                    <div
                        style="border-radius: 12px; padding: 2px; box-sizing: border-box; overflow: hidden; background-size: 100% 400px; background-position: top; background-repeat: no-repeat;"
                        :style="{ backgroundImage: selectedTier ? tierGradientCSS_(selectedTier) : 'none' }"
                    >
                    <div style="text-align: center; border-radius: 10px; padding: 1.25rem 1rem; background-color: var(--card-bg);">
                        <span v-if="selectedPack.icon_emoji" style="font-size: 2.5rem; display: block;">{{ selectedPack.icon_emoji }}</span>
                        <img v-else-if="selectedPack.icon_image_url" :src="selectedPack.icon_image_url" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto;">
                        <h1 class="pack-name-scroll" style="margin: 1rem 0 0;">{{ selectedPack.name }} <span v-if="isNewItem(selectedPack.created_at, 'pack')" class="new-badge" style="vertical-align: middle;">New</span></h1>
                        <p v-if="selectedPack.tagline" style="opacity: 0.7; margin: 1.8rem 0 0;">{{ selectedPack.tagline }}</p>

                        <span
                            v-if="selectedTier"
                            class="type-label-lg"
                            :style="{
                                display: 'inline-block', marginTop: '0.6rem', padding: '0.4rem 1rem', borderRadius: '999px',
                                color: '#14141a', textShadow: '0 1px 2px rgba(255,255,255,0.35)',
                                backgroundImage: tierGradientCSS_(selectedTier),
                            }"
                        >{{ selectedTier.name }} Tier</span>

                        <p v-if="selectedPack.bonusPoints" style="opacity: 0.6; font-size: 0.85rem; margin: 0.6rem 0 0;">Reward: {{ selectedPack.bonusPoints }} points</p>
                    </div>
                    </div>

                    <div v-if="store.user" style="margin-top: 1.25rem; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; flex-wrap: wrap;">
                            <p class="type-label-lg" style="margin: 0;">Progress</p>
                            <span style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0;">
                                <svg v-if="selectedPack.total > 0 && selectedPack.completedCount === selectedPack.total" width="16" height="16" viewBox="0 0 24 24" style="flex-shrink: 0;">
                                    <circle cx="12" cy="12" r="11" fill="#22c55e" />
                                    <path d="M7 12.5 L10.5 16 L17 8.5" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                                <span style="opacity: 0.7;">{{ selectedPack.completedCount }}/{{ selectedPack.total }}</span>
                            </span>
                        </div>
                        <div style="margin-top: 0.5rem; height: 8px; border-radius: 999px; background-color: var(--color-background); overflow: hidden;">
                            <div
                                v-if="selectedTier"
                                :style="{ width: selectedPack.percent + '%', height: '100%', backgroundImage: tierGradientCSS_(selectedTier), transition: 'width 0.3s ease' }"
                            ></div>
                        </div>
                        <p v-if="justCompleted" style="text-align: center; opacity: 0.8; margin-top: 0.6rem; font-size: 0.85rem;">🎉 You just completed this pack!</p>
                    </div>

                    <h2 style="margin-top: 1.75rem;">Levels</h2>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem;">
                        <div
                            v-for="lvl in selectedPack.levels"
                            :key="lvl.id"
                            style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 10px; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%);"
                        >
                            <span style="flex-shrink: 0; opacity: 0.5; font-size: 0.85rem; min-width: 1.8rem;">#{{ lvl.position ?? '?' }}</span>

                            <span style="flex: 1; min-width: 0;">{{ lvl.level_name }}</span>

                            <span style="opacity: 0.7; font-size: 0.85rem; flex-shrink: 0;">{{ lvl.score ?? 0 }} pts</span>

                            <svg v-if="lvl.done" width="20" height="20" viewBox="0 0 24 24" style="flex-shrink: 0;">
                                <circle cx="12" cy="12" r="11" fill="#22c55e" />
                                <path d="M7 12.5 L10.5 16 L17 8.5" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            <span v-else style="flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--card-border); box-sizing: border-box;"></span>
                        </div>
                    </div>

                    <h2 style="margin-top: 1.75rem;">Victors <span style="opacity: 0.5;">({{ victors.length }})</span></h2>
                    <p v-if="victorsLoading" style="opacity: 0.5; margin-top: 0.5rem;">Loading...</p>
                    <p v-else-if="victors.length === 0" style="opacity: 0.5; margin-top: 0.5rem;">Nobody has completed this pack yet.</p>
                    <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem;">
                        <div
                            v-for="v in victors"
                            :key="v.id"
                            style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.65rem 1rem; border-radius: 10px; background-color: var(--color-background); min-width: 0;"
                        >
                            <router-link :to="'/player/' + v.player_name" style="flex: 1 1 0; display: block; color: inherit; text-decoration: none; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'Lexend Deca', sans-serif; font-size: 17.1428571429px; line-height: 20px; font-weight: 500;">{{ v.player_name }}</router-link>
                            <input
                                v-if="isAdmin"
                                type="datetime-local"
                                :value="toDatetimeLocal(v.completed_at)"
                                @change="updateVictorDate(v, $event.target.value)"
                                style="opacity: 0.7; font-size: 0.8rem; flex-shrink: 0; background: none; border: 1px solid var(--card-border); border-radius: 6px; color: inherit; padding: 0.2rem 0.4rem; font-family: inherit;"
                            >
                            <span v-else style="opacity: 0.5; font-size: 0.8rem; flex-shrink: 0;">{{ new Date(v.completed_at).toLocaleString() }}</span>
                        </div>
                    </transition-group>

                    </div>
                </div>
                <div v-else key="empty" style="height: 100%; display: flex; align-items: center; justify-content: center; opacity: 0.5;">
                    <p>Select a pack to see its details.</p>
                </div>
                </transition>
            </div>
        </main>
        </transition>
    `,
    data: () => ({
        store,
        loading: true,
        isStaff: false,
        isAdmin: false,
        tiers: [],
        packs: [],
        searchQuery: "",
        badgeFilter: "all", // "all", "new", "none"
        BADGE_FILTER_LABELS_: BADGE_FILTER_LABELS,
        filtersOpen: false,
        activeTierFilters: [],
        listTypeFilter: "all",
        listTypeMenuOpen: false,
        completionMaps: {}, // list_type -> Map(path -> level)

        selectedId: null,
        victors: [],
        victorsLoading: false,
        justCompleted: false,

        myVictorPackIds: new Set(),
        collectingRewards: false,
        collectFeedback: null,

        mobileSection: 0,
        carouselDir: "fwd",
    }),
    created() {
        this.LIST_LABELS_ = LIST_LABELS;
        this.tierGradientCSS_ = tierGradientCSS;
    },
    async mounted() {
        if (store.user) {
            this.isStaff = await hasRole("mod", "admin");
            this.isAdmin = await hasRole("admin");
        }
        await Promise.all([this.loadTiers(), this.loadPacks()]);
        const { packBonus } = await computePackBonuses();
        this.packs.forEach((p) => { p.bonusPoints = packBonus[p.id] || 0; });
        await this.loadCompletionData();
        if (store.user) {
            await this.loadMyVictories();
        }
        this.loading = false;
    },
    computed: {
        filteredPacks() {
            const q = this.searchQuery.trim().toLowerCase();
            let list = this.packs;
            if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
            if (this.activeTierFilters.length) list = list.filter((p) => this.activeTierFilters.includes(p.tier_id));
            if (this.listTypeFilter !== "all") list = list.filter((p) => p.list_type === this.listTypeFilter);
            if (this.badgeFilter !== "all") {
                list = list.filter((p) => {
                    const hasNew = this.isNewItem(p.created_at, "pack");
                    return matchesBadgeFilter(this.badgeFilter, hasNew, false);
                });
            }
            return list;
        },
        visibleTiers() {
            return this.tiers
                .map((tier) => ({
                    ...tier,
                    packs: this.filteredPacks.filter((p) => p.tier_id === tier.id),
                }))
                .filter((tier) => tier.packs.length > 0);
        },
        selectedPack() {
            return this.packs.find((p) => p.id === this.selectedId) || null;
        },
        selectedTier() {
            return this.selectedPack ? this.tiers.find((t) => t.id === this.selectedPack.tier_id) || null : null;
        },
        claimableCount() {
            return this.packs.filter((p) => p.total > 0 && p.completedCount === p.total && !this.myVictorPackIds.has(p.id)).length;
        },
    },
    watch: {
        async selectedId(newId, oldId) {
            if (newId === oldId) return;
            this.justCompleted = false;
            await this.loadVictors();
        },
    },
    methods: {
        setBadgeFilter(value) {
            this.badgeFilter = this.badgeFilter === value ? "all" : value;
        },
        isNewItem(dateString, category) {
            return isNew(dateString, NEW_BADGE_DAYS[category]);
        },
        toggleTierFilter(id) {
            const i = this.activeTierFilters.indexOf(id);
            if (i === -1) {
                this.activeTierFilters.push(id);
            } else {
                this.activeTierFilters.splice(i, 1);
            }
        },
        selectPack(p) {
            this.selectedId = p.id;
            this.mobileSection = 1;
        },
        async loadTiers() {
            const { data } = await supabase.from("pack_tiers").select("*").order("sort_order", { ascending: true });
            this.tiers = data || [];
        },
        async loadPacks() {
            const { data: packs } = await supabase
                .from("packs")
                .select("*")
                .eq("status", "approved")
                .order("sort_order", { ascending: true });

            if (!packs || packs.length === 0) {
                this.packs = [];
                return;
            }

            const { data: levels } = await supabase
                .from("pack_levels")
                .select("*")
                .in("pack_id", packs.map((p) => p.id))
                .order("sort_order", { ascending: true });

            this.packs = packs.map((p) => {
                const packLevels = (levels || []).filter((l) => l.pack_id === p.id).map((l) => ({ ...l, done: false }));
                return {
                    ...p,
                    levels: packLevels,
                    total: packLevels.length,
                    completedCount: 0,
                    percent: 0,
                };
            });
        },
        async loadCompletionData() {
            const results = await Promise.all(Object.values(LIST_FETCHERS).map((fetcher) => fetcher()));
            const listTypes = Object.keys(LIST_FETCHERS);

            const positionMaps = {}; // list_type -> Map(path -> index (0-based))
            listTypes.forEach((type, i) => {
                const map = new Map();
                const posMap = new Map();
                (results[i] || []).forEach(([level], idx) => {
                    if (level) {
                        map.set(level.path, level);
                        posMap.set(level.path, idx);
                    }
                });
                this.completionMaps[type] = map;
                positionMaps[type] = posMap;
            });

            // Posição e pontuação de cada fase — independem de estar logado.
            this.packs.forEach((p) => {
                p.levels.forEach((pl) => {
                    const level = this.completionMaps[pl.list_type]?.get(pl.level_path);
                    const idx = positionMaps[pl.list_type]?.get(pl.level_path);
                    if (level === undefined || idx === undefined) return;
                    pl.position = idx + 1;
                    const scoreFn = SCORE_FNS[pl.list_type];
                    pl.score = scoreFn ? scoreFn(idx + 1, 100, level.percentToQualify) : 0;
                });
            });

            const myName = (store.profile?.list_name || store.profile?.username || "").toLowerCase();
            if (!myName) return;

            this.packs.forEach((p) => {
                let completed = 0;
                p.levels.forEach((pl) => {
                    const level = this.completionMaps[pl.list_type]?.get(pl.level_path);
                    if (!level) return;
                    const isVerifier = level.verifier && level.verifier.toLowerCase() === myName;
                    const hasFullRecord = (level.records || []).some((r) => r.percent === 100 && r.user && r.user.toLowerCase() === myName);
                    if (isVerifier || hasFullRecord) {
                        pl.done = true;
                        completed += 1;
                    }
                });
                p.completedCount = completed;
                p.percent = p.total > 0 ? Math.round((completed / p.total) * 100) : 0;
            });
        },

        async loadVictors() {
            if (!this.selectedPack) {
                this.victors = [];
                return;
            }
            this.victorsLoading = true;
            const { data } = await supabase
                .from("pack_victors")
                .select("*")
                .eq("pack_id", this.selectedId)
                .order("completed_at", { ascending: true });

            this.victors = data || [];
            this.victorsLoading = false;

            await this.maybeRegisterVictory();
        },

        toDatetimeLocal(dateString) {
            if (!dateString) return '';
            const d = new Date(dateString);
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },
        async updateVictorDate(victor, newValue) {
            if (!newValue) return;
            const isoDate = new Date(newValue).toISOString();
            const { error } = await supabase.from("pack_victors").update({ completed_at: isoDate }).eq("id", victor.id);
            if (!error) {
                victor.completed_at = isoDate;
            }
        },

        async maybeRegisterVictory() {
            const pack = this.selectedPack;
            if (!pack || !store.user || pack.total === 0) return;
            if (pack.completedCount < pack.total) return;

            const displayName = store.profile.list_name || store.profile.username;
            if (!displayName) return;

            const alreadyVictor = this.victors.some((v) => v.player_name.toLowerCase() === displayName.toLowerCase());
            if (alreadyVictor) return;

            const { data: inserted, error } = await supabase
                .from("pack_victors")
                .insert({ pack_id: pack.id, player_name: displayName })
                .select()
                .single();

            if (!error && inserted) {
                this.victors.push(inserted);
                this.justCompleted = true;
                this.myVictorPackIds.add(pack.id);
            }
        },

        async loadMyVictories() {
            const displayName = store.profile?.list_name || store.profile?.username;
            if (!displayName) return;

            const { data } = await supabase
                .from("pack_victors")
                .select("pack_id")
                .eq("player_name", displayName);

            this.myVictorPackIds = new Set((data || []).map((v) => v.pack_id));
        },

        async collectAllRewards() {
            const displayName = store.profile?.list_name || store.profile?.username;
            if (!displayName) return;

            const claimable = this.packs.filter((p) => p.total > 0 && p.completedCount === p.total && !this.myVictorPackIds.has(p.id));
            if (claimable.length === 0) return;

            this.collectingRewards = true;
            this.collectFeedback = null;

            const results = await Promise.all(claimable.map((p) =>
                supabase.from("pack_victors").insert({ pack_id: p.id, player_name: displayName }).select().single()
            ));

            let collected = 0;
            results.forEach((res, i) => {
                if (!res.error && res.data) {
                    this.myVictorPackIds.add(claimable[i].id);
                    if (this.selectedId === claimable[i].id) {
                        this.victors.push(res.data);
                        this.justCompleted = true;
                    }
                    collected += 1;
                }
            });

            this.collectingRewards = false;
            this.collectFeedback = collected > 0
                ? `Collected rewards from ${collected} pack${collected === 1 ? '' : 's'}!`
                : 'Nothing new to collect.';
            clearTimeout(this._collectFeedbackTimeout);
            this._collectFeedbackTimeout = setTimeout(() => { this.collectFeedback = null; }, 5000);
        },
    },
};
