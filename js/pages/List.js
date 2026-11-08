import { store } from "../main.js";
import { supabase } from "../supabase.js";
import { embed } from "../util.js";
import { fetchTagGroups } from "../tags.js";
import { withDivisionDividers, DIVISION_LABELS } from "../listDivisions.js";
import { isNew, NEW_BADGE_DAYS, matchesBadgeFilter, BADGE_FILTER_LABELS } from "../newBadge.js";
import { scoreClassic, scorePlatformer, scoreChallenge, scoreImpossible } from "../score.js";
import { fetchEditors, fetchList, fetchPlatformerList, fetchChallengeList, fetchImpossibleList, getImpossibleWR } from "../content.js";

import Spinner from "../components/Spinner.js";
import LevelAuthors from "../components/List/LevelAuthors.js";

const roleIconMap = {
    owner: "crown",
    admin: "user-gear",
    helper: "user-shield",
    dev: "code",
    trial: "user-lock",
};

const DIFFICULTIES = ["easy_demon", "medium_demon", "hard_demon", "insane_demon", "extreme_demon", "silent_demon"];

// Preenchido depois que a primeira leva de preload roda, pra não repetir o
// trabalho toda vez que o componente remonta (troca de categoria, etc).
let difficultyFacesPreloaded = false;

function preloadDifficultyFaces() {
    if (difficultyFacesPreloaded) return;
    difficultyFacesPreloaded = true;

    for (const difficulty of DIFFICULTIES) {
        for (let rating = 1; rating <= 5; rating++) {
            const img = new Image();
            img.src = `/assets/difficulty/${difficulty}_${rating}.png`;
        }
    }
}

// 👈 Mantenha estes valores em sincronia com as constantes LIST_SIZE em score.js
const LIST_SIZES = {
    classic: 150,
    platformer: 15,
    challenge: 75,
    impossible: 50,
};

const FETCHERS = {
    classic: fetchList,
    platformer: fetchPlatformerList,
    challenge: fetchChallengeList,
    impossible: fetchImpossibleList,
};

const SCORERS = {
    classic: scoreClassic,
    platformer: scorePlatformer,
    challenge: scoreChallenge,
};

export default {
    components: { Spinner, LevelAuthors },
    template: `
        <transition name="tab-fade" mode="out-in">
        <main v-if="loading" key="loading">
            <Spinner></Spinner>
        </main>
        <main v-else key="loaded" class="page-list">
            <!-- Navegação entre as 3 seções, só aparece no mobile -->
            <div class="mobile-section-nav">
                <button type="button" @click="carouselDir = 'back'; mobileSection = Math.max(0, mobileSection - 1)" :disabled="mobileSection === 0" aria-label="Previous section">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <transition :name="'carousel-' + carouselDir" mode="out-in">
                    <span class="type-label-lg" :key="mobileSection">{{ ['Levels', level ? level.name : 'Level', 'Info & Credits'][mobileSection] }}</span>
                </transition>
                <button type="button" @click="carouselDir = 'fwd'; mobileSection = Math.min(2, mobileSection + 1)" :disabled="mobileSection === 2" aria-label="Next section">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
            </div>
            <div class="list-container" ref="listContainer" :class="{ 'mobile-section-active': mobileSection === 0 }">
                <div style="display: flex; align-items: center; justify-content: flex-start; gap: 0.5rem;">
                    <div style="position: relative; flex: 1; min-width: 0;">
                        <button
                            class="list-tab"
                            @click="categoryMenuOpen = !categoryMenuOpen"
                            style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 0.65rem 0.9rem;"
                        >
                            <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ MODE_LABELS_[mode] }}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: categoryMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                        <transition name="dropdown-fade">
                        <div
                            v-if="categoryMenuOpen"
                            style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; overflow: hidden; z-index: 20;"
                        >
                            <button
                                v-for="m in ['classic', 'platformer', 'challenge', 'impossible']"
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
                        <span
                            v-if="activeFilterCount > 0"
                            class="filter-count"
                        >{{ activeFilterCount }}</span>
                    </button>
                </div>

                <router-link to="/submit/level" class="suggest-level-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span class="type-label-lg">Suggest a Level</span>
                </router-link>

                <router-link
                    v-if="store.profile && store.profile.role === 'admin'"
                    to="/admin/add-level"
                    class="suggest-level-btn"
                    style="background-image: none; background-color: #767676; margin-top: 0.5rem;"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span class="type-label-lg">Manage Levels</span>
                </router-link>

                <div v-if="store.user" style="margin-top: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                    <button type="button" @click="folderCarouselDir = 'back'; shiftFolder(-1)" aria-label="Previous folder" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; flex-shrink: 0;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <transition :name="'carousel-' + folderCarouselDir" mode="out-in">
                        <span :key="activeFolderId ?? 'all'" class="type-label-lg" style="min-width: 0; text-align: center;">
                            {{ activeFolderId === null ? 'All Levels' : (folders.find(f => f.id === activeFolderId)?.name || '…') }}
                        </span>
                    </transition>
                    <button type="button" @click="folderCarouselDir = 'fwd'; shiftFolder(1)" aria-label="Next folder" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; flex-shrink: 0;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                    <button type="button" @click="openFolderManager" aria-label="Manage folders" style="background: none; border: 1.5px dashed var(--form-border-gray); border-radius: 50%; width: 1.8rem; height: 1.8rem; color: inherit; cursor: pointer; opacity: 0.7; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">+</button>
                </div>

                <div class="list-panel">
                <table class="list" v-if="list">
                    <colgroup>
                        <col style="width: 3.5rem;">
                        <col>
                    </colgroup>
                    <transition-group name="row-fade" tag="tbody">
                    <tr v-for="row in filteredListWithDividers" :key="row.divider ? row.key : row.i">
                        <td v-if="row.divider" colspan="2" style="padding: 0.55rem 1rem; text-align: center; opacity: 0.65; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; background-color: var(--color-background-hover); border-top: 1px solid var(--card-border); border-bottom: 1px solid var(--card-border); border-radius: 8px;">
                            {{ row.label }}
                        </td>
                        <template v-else>
                            <td class="rank">
                                <p class="type-label-lg">#{{ row.i + 1 }}</p>
                            </td>
                            <td class="level" :class="{ 'active': selected == row.i, 'error': !row.entry[0] }">
                                <button @click="selected = row.i; mobileSection = 1;">
                                    <span class="type-label-lg level-name-scroll">{{ row.entry[0]?.name || \`Error (\${row.entry[1]}.json)\` }}</span>
                                    <span v-if="isNewItem(row.entry[0]?.date_added, 'level')" class="new-badge" style="margin-left: 0.6rem; margin-right: 0.3rem; flex-shrink: 0;">New</span>
                                    <span v-else-if="isNewItem(row.entry[0]?.date_updated, 'levelUpdated')" class="updated-badge" style="margin-left: 0.6rem; margin-right: 0.3rem; flex-shrink: 0;">Updated</span>
                                </button>
                                <svg
                                    v-if="isCompleted(row.entry[0])"
                                    width="16" height="16" viewBox="0 0 24 24"
                                    style="flex-shrink: 0; margin-left: 0.4rem; vertical-align: middle;"
                                    title="You beat this level"
                                >
                                    <circle cx="12" cy="12" r="11" fill="#22c55e" />
                                    <path d="M7 12.5 L10.5 16 L17 8.5" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </td>
                        </template>
                    </tr>
                    </transition-group>
                </table>
                <p v-if="list && filteredList.length === 0" style="opacity: 0.5; text-align: center; padding: 1.5rem 1rem;">
                    No levels match your search/filters.
                </p>
                </div>
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
                    <p class="type-label-md" style="opacity: 0.6; margin: 0 0 0.6rem;">Status</p>
                    <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                        <button
                            type="button"
                            class="list-tab"
                            :style="{
                                borderRadius: '8px', border: '1.5px solid rgba(0,0,0,0.4)', padding: '0.55rem 1rem',
                                backgroundColor: statusFilter === 'completed' ? 'var(--color-primary)' : 'var(--card-bg)',
                                color: statusFilter === 'completed' ? '#ffffff' : 'inherit',
                            }"
                            @click="setStatusFilter('completed')"
                        >Completed</button>
                        <button
                            type="button"
                            class="list-tab"
                            :style="{
                                borderRadius: '8px', border: '1.5px solid rgba(0,0,0,0.4)', padding: '0.55rem 1rem',
                                backgroundColor: statusFilter === 'uncompleted' ? 'var(--color-primary)' : 'var(--card-bg)',
                                color: statusFilter === 'uncompleted' ? '#ffffff' : 'inherit',
                            }"
                            @click="setStatusFilter('uncompleted')"
                        >Uncompleted</button>
                    </div>

                    <div v-if="mode !== 'impossible'" style="margin-top: 1.25rem;">
                        <p class="type-label-md" style="opacity: 0.6; margin: 0 0 0.6rem;">Division</p>
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
                    </div>

                    <div style="margin-top: 1.25rem;">
                        <p class="type-label-md" style="opacity: 0.6; margin: 0 0 0.6rem;">Badge</p>
                        <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                            <button
                                v-for="b in ['new', 'updated', 'none']"
                                :key="b"
                                type="button"
                                class="list-tab"
                                :style="{
                                    borderRadius: '8px', border: '1.5px solid rgba(0,0,0,0.4)', padding: '0.55rem 1rem',
                                    backgroundColor: badgeFilter === b ? 'var(--color-primary)' : 'var(--card-bg)',
                                    color: badgeFilter === b ? '#ffffff' : 'inherit',
                                }"
                                @click="setBadgeFilter(b)"
                            >{{ BADGE_FILTER_LABELS_[b] }}</button>
                        </div>
                    </div>

                    <div v-for="group in tagGroups" :key="group.key" style="margin-top: 1.25rem;">
                        <p class="type-label-md" style="opacity: 0.6; margin: 0 0 0.6rem;">{{ group.label }}</p>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button
                                v-for="t in group.tags"
                                :key="t"
                                type="button"
                                :style="{
                                    fontSize: '0.85rem', borderRadius: '8px', border: '1.5px solid rgba(0,0,0,0.4)', padding: '0.5rem 0.85rem', cursor: 'pointer',
                                    backgroundColor: tagFilters.includes(t) ? 'var(--color-primary)' : 'var(--card-bg)',
                                    color: tagFilters.includes(t) ? '#ffffff' : 'inherit',
                                }"
                                @click="toggleTagFilter(t)"
                            >{{ t }}</button>
                        </div>
                    </div>

                    <button
                        type="button"
                        class="login-btn"
                        style="margin-top: 1.5rem;"
                        @click="filtersOpen = false"
                    >Done</button>
                    </div>
                </div>
            </div>
            </transition>
            <div class="level-container" ref="levelContainer" :class="{ 'mobile-section-active': mobileSection === 1 }">
                <transition name="tab-fade" mode="out-in">
                <div class="level" v-if="level" :key="level.path">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 1.25rem; width: 100%;">
                        <img
                            v-if="level.difficulty && level.rating"
                            class="difficulty-face"
                            :src="\`/assets/difficulty/\${level.difficulty}_\${level.rating}.png\`"
                            :alt="level.difficulty"
                            :style="{ height: difficultyFaceSize(level.rating), width: 'auto', flexShrink: 0 }"
                        >
                        <div class="level-title-scroll" ref="titleScroll">
                        <h1 style="text-align: left; margin: 0; width: auto;">{{ level.name }} <span v-if="mode === 'impossible' && impossibleWR(level).verified" style="opacity: 0.6; font-weight: normal;">(Verified)</span> <span v-if="isNewItem(level.date_added, 'level')" class="new-badge new-badge-lg">New</span> <span v-else-if="isNewItem(level.date_updated, 'levelUpdated')" class="updated-badge updated-badge-lg">Updated</span></h1>
                        </div>
                    </div>
                    <div style="position: relative;">
                        <button
                            v-if="store.user"
                            type="button"
                            @click="openBookmarkPicker(level)"
                            :aria-label="isBookmarked(level.path) ? 'Remove bookmark' : 'Add bookmark'"
                            style="position: absolute; top: 0.6rem; right: 0.6rem; z-index: 2; background: none; border: none; cursor: pointer; padding: 0.2rem; line-height: 0;"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" :fill="isBookmarked(level.path) ? 'var(--color-primary)' : 'none'" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
                            </svg>
                        </button>
                        <LevelAuthors v-if="mode !== 'impossible'" :author="level.author" :creators="level.creators" :verifier="level.verifier"></LevelAuthors>
                        <LevelAuthors v-else :author="level.author" :creators="level.creators" :verifier="impossibleWR(level).holder ? impossibleWR(level).holder + ' (' + impossibleWR(level).percent + '%)' : 'No World Record yet'"></LevelAuthors>
                    </div>
                    <div v-if="level.verification || level.showcase" class="slide-tabs" style="margin: 0.75rem 0;">
                        <button
                            type="button"
                            class="slide-tab"
                            :disabled="!level.verification"
                            :style="{ opacity: !level.verification ? 0.35 : 1, cursor: !level.verification ? 'not-allowed' : 'pointer' }"
                            :class="{ active: !toggledShowcase }"
                            @click="level.verification && (toggledShowcase = false)"
                        >{{ mode === 'impossible' ? 'Record' : 'Verification' }}</button>
                        <button
                            type="button"
                            class="slide-tab"
                            :disabled="!level.showcase"
                            :style="{ opacity: !level.showcase ? 0.35 : 1, cursor: !level.showcase ? 'not-allowed' : 'pointer' }"
                            :class="{ active: toggledShowcase }"
                            @click="level.showcase && (toggledShowcase = true)"
                        >Showcase</button>
                        <div class="slide-tab-indicator" :style="{ transform: toggledShowcase ? 'translateX(100%)' : 'translateX(0)' }"></div>
                    </div>
                    <iframe class="video" id="videoframe" :src="video" frameborder="0"></iframe>
                    <p v-if="level.date_added" style="text-align: center; margin: 0.6rem 0 0; font-size: 0.85rem;">
                        <span style="opacity: 0.55;">Added</span> <span style="color: #ffffff;">{{ formatDate(level.date_added) }}</span>
                    </p>
                    <div v-if="level.tags && level.tags.length" style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin-top: 0.4rem;">
                        <span
                            v-for="t in level.tags"
                            :key="t"
                            style="font-size: 0.9rem; padding: 0.45rem 0.9rem; border-radius: 6px; border: 1.5px solid var(--color-primary); opacity: 0.9;"
                        >{{ t }}</span>
                    </div>
                    <div class="level-info-card">
                        <div class="info-col">
                            <div>
                                <div class="type-title-sm" v-if="mode !== 'impossible'">Points</div>
                                <p v-if="mode !== 'impossible'" style="margin-top: 0.5rem;">{{ score(selected + 1, 100, level.percentToQualify) }}</p>
                                <div class="type-title-sm" v-else>Points</div>
                                <p v-if="mode === 'impossible'" style="margin-top: 0.5rem;">{{ impossibleScore(100, true) }}</p>
                            </div>
                            <div>
                                <div class="type-title-sm">ID</div>
                                <p style="margin-top: 0.5rem;">{{ level.id }}</p>
                            </div>
                            <div>
                                <div class="type-title-sm">Password</div>
                                <p style="margin-top: 0.5rem;">{{ level.password || 'Free to Copy' }}</p>
                            </div>
                        </div>
                        <div class="info-divider"></div>
                        <div class="info-col">
                            <div>
                                <div class="type-title-sm">Enjoyment</div>
                                <p v-if="enjoymentAverage(level) !== null" style="margin-top: 0.5rem;">{{ enjoymentAverage(level).toFixed(1) }}</p>
                                <p v-else style="opacity: 0.5; font-size: 0.85rem; margin-top: 0.5rem;">No data yet</p>
                            </div>
                        </div>
                    </div>
                    <h2>Records</h2>
                    <p v-if="mode === 'impossible'">Every attempt is recorded — beating the current World Record earns full points, other submissions earn a bit less.</p>
                    <p v-else><strong>{{ level.percentToQualify }}%</strong> or better to qualify</p>
                    <table class="records">
                        <tr v-for="record in (mode === 'impossible' ? [...level.records].sort((a, b) => b.percent - a.percent) : level.records)" class="record">
                            <td class="percent">
                                <p>{{ record.percent }}%</p>
                            </td>
                            <td class="user">
                                <a :href="record.link" target="_blank" class="type-label-lg">{{ record.user }}</a>
                            </td>
                            <td class="mobile">
                                <img v-if="record.mobile" :src="\`/assets/phone-landscape\${store.dark ? '-dark' : ''}.svg\`" alt="Mobile">
                            </td>
                            <td class="hz">
                                <p>{{ record.hz }}Hz</p>
                            </td>
                        </tr>
                    </table>
                </div>
                <div v-else class="level" key="empty" style="height: 100%; justify-content: center; align-items: center;">
                    <p>(ノಠ益ಠ)ノ彡┻━┻</p>
                </div>
                </transition>
            </div>
            <div class="meta-container" ref="metaContainer" :class="{ 'mobile-section-active': mobileSection === 2 }">
                <div class="meta">
                    <div class="errors" v-show="errors.length > 0">
                        <p class="error" v-for="error of errors">{{ error }}</p>
                    </div>
                    <div class="og">
                        <p class="type-label-md">Website layout made by <a href="https://tsl.pages.dev/" target="_blank">TheShittyList</a></p>
                    </div>
                    <template v-if="editors">
                        <div class="meta-section">
                        <h3>List Editors</h3>
                        <ol class="editors">
                            <li v-for="editor in editors">
                                <img :src="\`/assets/\${roleIconMap[editor.role]}\${store.dark ? '-dark' : ''}.svg\`" :alt="editor.role">
                                <a v-if="editor.link" class="type-label-lg link" target="_blank" :href="editor.link">{{ editor.name }}</a>
                                <p v-else>{{ editor.name }}</p>
                            </li>
                        </ol>
                        </div>
                    </template>
                    <div class="meta-section">
                    <h3>Submission Requirements</h3>
                    <p>
                        1. Achieved the record without using hacks, however CBF and FPS bypass is allowed, up to 720fps
                    </p>
                    <p>
                        2. Achieved the record on the level that is listed on the site - please check the level ID before you submit a record
                    </p>
                    <p>
                        3. Have either source audio or clicks/taps in the video. Edited audio only does not count (some exceptions may be made depending on how trustworthy the player is)
                    </p>
                    <p>
                        4. The recording must have a previous attempt and entire death animation shown before the completion, unless the completion is on the first attempt. (Everyplay and replay mods records are exempt from this)
                    </p>
                    <p>
                        5. The recording must also show the player hit the endwall, or the completion will be invalidated.
                    </p>
                    <p>
                        6. Do not use secret routes or bug routes (if they make the level too easy, if it's something close to a swag route, it will be accepted)
                    </p>
                    <p>
                        7. Do not use easy modes, only a record of the unmodified level qualifies
                    </p>
                    </div>
                    <div class="meta-section">
                    <h3>Credits</h3>
                    <p>
                        This site's design and layout were inspired by <a href="https://aredl.net/" target="_blank" class="link">AREDL</a> and <a href="https://platinumdl.pages.dev/" target="_blank" class="link">PlatinumDL</a> — huge thanks to both lists for the inspiration.
                    </p>
                    </div>
                </div>
            </div>

            <!-- ================= BOOKMARK PICKER POPUP (escolher pastas pra 1 fase) ================= -->
            <transition name="tab-fade">
            <div v-if="bookmarkPickerLevel" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="bookmarkPickerLevel = null">
                <div style="background-color: var(--color-background); border: 1px solid var(--color-background-hover); border-radius: 12px; width: 100%; max-width: 380px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Bookmark — {{ bookmarkPickerLevel.name }}</p>
                        <button @click="bookmarkPickerLevel = null" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>

                    <div style="overflow-y: auto; margin-top: 0.75rem; flex: 1;">
                        <p v-if="folders.length === 0" style="opacity: 0.5; font-size: 0.85rem;">No folders yet — create one below.</p>
                        <label
                            v-for="f in folders"
                            :key="f.id"
                            style="display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.4rem; cursor: pointer;"
                        >
                            <input type="checkbox" :checked="folderHasLevel(f.id, bookmarkPickerLevel.path)" @change="toggleBookmark(f.id, bookmarkPickerLevel)">
                            <span>{{ f.name }}</span>
                        </label>
                    </div>

                    <div style="border-top: 1px solid var(--color-background-hover); margin-top: 0.75rem; padding-top: 0.75rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <input
                                type="text"
                                v-model="newFolderName"
                                placeholder="New folder name"
                                @keyup.enter="createFolderAndBookmark"
                                style="width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); color: var(--color-on-background); flex: 1;"
                            >
                            <button type="button" @click="createFolderAndBookmark" class="nav__cta type-label-lg" style="border: none; border-radius: 8px; cursor: pointer; padding: 0 1rem; white-space: nowrap;">Add</button>
                        </div>
                    </div>
                </div>
            </div>
            </transition>

            <!-- ================= MANAGE FOLDERS POPUP ================= -->
            <transition name="tab-fade">
            <div v-if="folderManagerOpen" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="folderManagerOpen = false">
                <div style="background-color: var(--color-background); border: 1px solid var(--color-background-hover); border-radius: 12px; width: 100%; max-width: 380px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Manage Folders</p>
                        <button @click="folderManagerOpen = false" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>

                    <div style="overflow-y: auto; margin-top: 0.75rem; flex: 1;">
                        <p v-if="folders.length === 0" style="opacity: 0.5; font-size: 0.85rem;">No folders yet.</p>
                        <div v-for="(f, i) in folders" :key="f.id" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0;">
                            <input
                                type="text"
                                :value="f.name"
                                @change="renameFolder(f, $event.target.value)"
                                style="width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); color: var(--color-on-background); flex: 1;"
                            >
                            <button type="button" @click="moveFolder(i, -1)" :disabled="i === 0" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; flex-shrink: 0;">▲</button>
                            <button type="button" @click="moveFolder(i, 1)" :disabled="i === folders.length - 1" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; flex-shrink: 0;">▼</button>
                            <button type="button" @click="deleteFolder(f)" style="background: none; border: none; color: var(--color-error); cursor: pointer; flex-shrink: 0;">✕</button>
                        </div>
                    </div>

                    <div style="border-top: 1px solid var(--color-background-hover); margin-top: 0.75rem; padding-top: 0.75rem; display: flex; gap: 0.5rem;">
                        <input type="text" v-model="newFolderNameManager" placeholder="New folder name" @keyup.enter="createFolder" style="width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); color: var(--color-on-background); flex: 1;">
                        <button type="button" @click="createFolder" class="nav__cta type-label-lg" style="border: none; border-radius: 8px; cursor: pointer; padding: 0 1rem; white-space: nowrap;">Add</button>
                    </div>
                </div>
            </div>
            </transition>
        </main>
        </transition>
    `,
    data: () => ({
        mode: 'classic', // 'classic', 'platformer', 'challenge', or 'impossible'
        mobileSection: 0, // 0 = levels, 1 = level detail, 2 = info/credits
        carouselDir: "fwd", // 'fwd' | 'back' — direção da animação do carrossel mobile
        list: [],
        editors: [],
        loading: true,
        selected: 0,
        errors: [],

        folders: [],
        bookmarkItems: [],
        activeFolderId: null, // null = "All Levels"
        folderCarouselDir: "fwd",
        folderManagerOpen: false,
        newFolderNameManager: "",
        bookmarkPickerLevel: null,
        newFolderName: "",
        roleIconMap,
        toggledShowcase: false,
        categoryMenuOpen: false,
        MODE_LABELS_: {
            classic: 'Classic',
            platformer: 'Platformer',
            challenge: 'Challenge',
            impossible: 'Impossible',
        },
        searchQuery: '',
        filtersOpen: false,
        statusFilter: 'all', // 'all', 'completed', 'uncompleted'
        divisionFilter: 'all', // 'all', 'main', 'extended', 'extendedPlus'
        badgeFilter: 'all', // 'all', 'new', 'updated', 'none'
        tagFilters: [],
        tagGroups: [],
        store
    }),
    computed: {
        level() {
            return this.list[this.selected][0];
        },
        listSize() {
            return LIST_SIZES[this.mode];
        },
        video() {
            if (!this.level.showcase) {
                return embed(this.level.verification);
            }
            // Sem verification (ex: fase Impossible sem WR ainda), sempre mostra o showcase.
            if (!this.level.verification) {
                return embed(this.level.showcase);
            }

            return embed(
                this.toggledShowcase
                    ? this.level.showcase
                    : this.level.verification
            );
        },
        filteredList() {
            const q = this.searchQuery.trim().toLowerCase();
            return this.list
                .map((entry, i) => ({ entry, i }))
                .filter(({ entry: [level], i }) => {
                    if (q && (!level || !level.name.toLowerCase().includes(q))) {
                        return false;
                    }
                    if (this.statusFilter === 'completed' && (!level || !this.isCompleted(level))) {
                        return false;
                    }
                    if (this.statusFilter === 'uncompleted' && (!level || this.isCompleted(level))) {
                        return false;
                    }
                    if (this.tagFilters.length > 0) {
                        const levelTags = (level && level.tags) || [];
                        if (!this.tagFilters.every((t) => levelTags.includes(t))) {
                            return false;
                        }
                    }
                    if (this.activeFolderId !== null) {
                        if (!level || !this.bookmarkedPaths.has(level.path)) return false;
                    }
                    if (this.divisionFilter !== 'all' && this.mode !== 'impossible') {
                        const rank = i + 1;
                        if (this.divisionFilter === 'main' && rank > 75) return false;
                        if (this.divisionFilter === 'extended' && (rank <= 75 || rank > 150)) return false;
                        if (this.divisionFilter === 'extendedPlus' && rank <= 150) return false;
                    }
                    if (this.badgeFilter !== 'all') {
                        const hasNew = level && this.isNewItem(level.date_added, 'level');
                        const hasUpdated = level && this.isNewItem(level.date_updated, 'levelUpdated');
                        if (!matchesBadgeFilter(this.badgeFilter, hasNew, hasUpdated)) return false;
                    }
                    return true;
                });
        },
        // Main List (1-75) / Extended List (76-150) / Extended List+ (151+).
        // Não vale pra Impossible (tem sistema de WR próprio).
        filteredListWithDividers() {
            if (this.mode === 'impossible' || this.divisionFilter !== 'all') {
                return this.filteredList.map((row) => ({ divider: false, ...row }));
            }
            return withDivisionDividers(this.filteredList, (row) => row.i + 1)
                .map((row) => (row.divider ? row : { divider: false, ...row.item }));
        },
        // paths (do mode atual) que estão na pasta ativa
        bookmarkedPaths() {
            if (this.activeFolderId === null) return new Set();
            const items = this.bookmarkItems.filter((it) => it.folder_id === this.activeFolderId && it.list_type === this.mode);
            return new Set(items.map((it) => it.level_path));
        },
        activeFilterCount() {
            return (this.statusFilter === 'all' ? 0 : 1) + (this.divisionFilter === 'all' ? 0 : 1) + (this.badgeFilter === 'all' ? 0 : 1) + this.tagFilters.length;
        },
    },
    watch: {
        async selected() {
            this.toggledShowcase = !this.level.verification && !!this.level.showcase;
            await this.$nextTick();
            if (this.$refs.titleScroll) this.$refs.titleScroll.scrollLeft = 0;
        },
        async mobileSection(section) {
            // Espera o DOM atualizar (a seção nova já com altura/scroll próprios)
            // antes de resetar — senão corre o risco de pegar o elemento ainda
            // na aparência antiga.
            await this.$nextTick();
            const refs = [this.$refs.listContainer, this.$refs.levelContainer, this.$refs.metaContainer];
            const active = refs[section];
            if (active) active.scrollTop = 0;
            // Rede de segurança pra telas onde a seção não vira scroll interno
            // (ex: desktop, ou se a altura calculada não cobrir 100% do caso).
            window.scrollTo({ top: 0, behavior: 'auto' });
        },
    },
    created() {
        this.DIVISION_LABELS_ = DIVISION_LABELS;
        this.BADGE_FILTER_LABELS_ = BADGE_FILTER_LABELS;
    },
    async mounted() {
        this.tagGroups = await fetchTagGroups();
        preloadDifficultyFaces();
        await this.loadList();
        this.editors = await fetchEditors();

        if (store.user) {
            await this.loadFolders();
        }

        if (!this.editors) {
            this.errors.push("Failed to load list editors.");
        }

        this.loading = false;
    },
    methods: {
        setStatusFilter(value) {
            this.statusFilter = this.statusFilter === value ? 'all' : value;
        },
        setDivisionFilter(value) {
            this.divisionFilter = this.divisionFilter === value ? 'all' : value;
        },
        setBadgeFilter(value) {
            this.badgeFilter = this.badgeFilter === value ? 'all' : value;
        },
        toggleTagFilter(tag) {
            const i = this.tagFilters.indexOf(tag);
            if (i === -1) {
                this.tagFilters.push(tag);
            } else {
                this.tagFilters.splice(i, 1);
            }
        },
        isNewItem(dateString, category) {
            return isNew(dateString, NEW_BADGE_DAYS[category]);
        },
        formatDate(dateString) {
            if (!dateString) return '';
            return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        },
        enjoymentAverage(level) {
            if (!level) return null;
            const values = (Array.isArray(level.records) ? level.records : [])
                .filter((r) => r.percent === 100 && typeof r.enjoyment === 'number')
                .map((r) => r.enjoyment);
            if (typeof level.verifier_enjoyment === 'number') {
                values.push(level.verifier_enjoyment);
            }
            if (values.length === 0) return null;
            return values.reduce((sum, v) => sum + v, 0) / values.length;
        },
        isCompleted(level) {
            if (!store.profile || !store.profile.list_name || !level) {
                return false;
            }
            const name = store.profile.list_name.toLowerCase();
            if (level.verifier && level.verifier.toLowerCase() === name) {
                return true;
            }
            if (!level.records) return false;
            return level.records.some((r) => r.percent === 100 && r.user && r.user.toLowerCase() === name);
        },
        embed,
        score(rank, percent, minPercent) {
            return SCORERS[this.mode](rank, percent, minPercent);
        },
        difficultyFaceSize(rating) {
            const sizes = { 1: '3.6rem', 2: '4.1rem', 3: '4.5rem', 4: '4.8rem', 5: '5.2rem' };
            return `calc(${sizes[rating] || '4rem'} * var(--difficulty-scale, 1))`;
        },
        impossibleWR(level) {
            return getImpossibleWR(level);
        },
        impossibleScore(percent, isWorldRecord) {
            return scoreImpossible(percent, isWorldRecord);
        },
        async loadList() {
            this.loading = true;
            this.errors = [];
            this.selected = 0;

            const fetcher = FETCHERS[this.mode];
            this.list = await fetcher();

            if (!this.list) {
                this.errors = [
                    "Failed to load list. Retry in a few minutes or notify list staff.",
                ];
                this.list = [];
            } else {
                this.errors.push(
                    ...this.list
                        .filter(([_, err]) => err)
                        .map(([_, err]) => {
                            return `Failed to load level. (${err}.json)`;
                        })
                );
            }

            this.loading = false;
        },
        async switchMode(mode) {
            if (this.mode === mode) return;
            this.mode = mode;
            this.mobileSection = 0;
            await this.loadList();
        },

        async loadFolders() {
            const { data: folders } = await supabase
                .from("bookmark_folders")
                .select("*")
                .order("sort_order", { ascending: true });
            this.folders = folders || [];
            if (this.folders.length === 0) return;

            const { data: items } = await supabase
                .from("bookmark_items")
                .select("*")
                .in("folder_id", this.folders.map((f) => f.id));
            this.bookmarkItems = items || [];
        },

        shiftFolder(direction) {
            const order = [null, ...this.folders.map((f) => f.id)];
            const idx = order.indexOf(this.activeFolderId);
            const nextIdx = (idx + direction + order.length) % order.length;
            this.activeFolderId = order[nextIdx];
        },

        isBookmarked(path) {
            if (this.folders.length === 0) return false;
            return this.bookmarkItems.some((it) => it.list_type === this.mode && it.level_path === path);
        },
        folderHasLevel(folderId, path) {
            return this.bookmarkItems.some((it) => it.folder_id === folderId && it.list_type === this.mode && it.level_path === path);
        },

        openBookmarkPicker(level) {
            this.bookmarkPickerLevel = level;
            this.newFolderName = "";
        },

        async toggleBookmark(folderId, level) {
            const existing = this.bookmarkItems.find((it) => it.folder_id === folderId && it.list_type === this.mode && it.level_path === level.path);
            if (existing) {
                await supabase.from("bookmark_items").delete().eq("id", existing.id);
                this.bookmarkItems = this.bookmarkItems.filter((it) => it.id !== existing.id);
            } else {
                const { data, error } = await supabase
                    .from("bookmark_items")
                    .insert({ folder_id: folderId, list_type: this.mode, level_path: level.path, level_name: level.name })
                    .select()
                    .single();
                if (!error && data) this.bookmarkItems.push(data);
            }
        },

        async createFolderAndBookmark() {
            const name = this.newFolderName.trim();
            if (!name || !this.bookmarkPickerLevel) return;

            const nextOrder = this.folders.reduce((max, f) => Math.max(max, f.sort_order || 0), 0) + 1;
            const { data: folder, error } = await supabase
                .from("bookmark_folders")
                .insert({ owner_id: store.user.id, name, sort_order: nextOrder })
                .select()
                .single();
            if (error || !folder) return;

            this.folders.push(folder);
            this.newFolderName = "";
            await this.toggleBookmark(folder.id, this.bookmarkPickerLevel);
        },

        openFolderManager() {
            this.folderManagerOpen = true;
            this.newFolderNameManager = "";
        },

        async createFolder() {
            const name = this.newFolderNameManager.trim();
            if (!name) return;
            const nextOrder = this.folders.reduce((max, f) => Math.max(max, f.sort_order || 0), 0) + 1;
            const { data: folder, error } = await supabase
                .from("bookmark_folders")
                .insert({ owner_id: store.user.id, name, sort_order: nextOrder })
                .select()
                .single();
            if (!error && folder) {
                this.folders.push(folder);
                this.newFolderNameManager = "";
            }
        },

        async renameFolder(folder, newName) {
            const name = newName.trim();
            if (!name || name === folder.name) return;
            const { error } = await supabase.from("bookmark_folders").update({ name }).eq("id", folder.id);
            if (!error) folder.name = name;
        },

        async moveFolder(index, direction) {
            const target = index + direction;
            if (target < 0 || target >= this.folders.length) return;
            const a = this.folders[index];
            const b = this.folders[target];
            [a.sort_order, b.sort_order] = [b.sort_order, a.sort_order];
            [this.folders[index], this.folders[target]] = [this.folders[target], this.folders[index]];
            await Promise.all([
                supabase.from("bookmark_folders").update({ sort_order: a.sort_order }).eq("id", a.id),
                supabase.from("bookmark_folders").update({ sort_order: b.sort_order }).eq("id", b.id),
            ]);
        },

        async deleteFolder(folder) {
            if (!window.confirm(`Delete "${folder.name}"? This can't be undone.`)) return;
            const { error } = await supabase.from("bookmark_folders").delete().eq("id", folder.id);
            if (!error) {
                this.folders = this.folders.filter((f) => f.id !== folder.id);
                this.bookmarkItems = this.bookmarkItems.filter((it) => it.folder_id !== folder.id);
                if (this.activeFolderId === folder.id) this.activeFolderId = null;
            }
        },
    },
};
