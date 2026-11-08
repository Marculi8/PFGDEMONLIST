import { store } from "../main.js";
import { supabase } from "../supabase.js";
import { fetchVerificationsList } from "../content.js";
import { embed } from "../util.js";
import { isNew, NEW_BADGE_DAYS, matchesBadgeFilter, BADGE_FILTER_LABELS } from "../newBadge.js";

import Spinner from "../components/Spinner.js";

const SUB_TABS = [
    { key: "set_verifier", label: "Set Verifier" },
    { key: "open_verification", label: "Open Verification" },
    { key: "verified", label: "Verified" },
];

export default {
    components: { Spinner },
    template: `
        <main class="page-list" :class="{ dark: store.dark }">
            <div style="grid-column: span 3; padding: 2rem; max-width: 1000px; margin: 0 auto;">
                <h1 style="text-align: center; margin-bottom: 1.5rem;">Verifications</h1>

                <div style="display: flex; justify-content: center;">
                    <router-link to="/submit/verification" class="login-btn" style="width: auto; padding: 0.65rem 1.25rem; text-decoration: none; display: inline-block;">
                        Submit a Verification
                    </router-link>
                </div>

                <transition name="alert-fade"><div v-if="feedback" :class="['login-alert', feedback.ok ? 'login-alert-success' : 'login-alert-error']" style="margin-top: 1rem;">{{ feedback.message }}</div></transition>

                <!-- ================= PENDING REVIEWS (mod/admin) ================= -->
                <template v-if="isStaff">
                    <h2 style="margin-top: 1.75rem; font-size: 1.1rem;">Pending Reviews <span style="opacity: 0.5;">({{ pending.length }})</span></h2>
                    <p v-if="pendingLoading" style="opacity: 0.5;">Loading...</p>
                    <p v-else-if="pending.length === 0" style="opacity: 0.5;">Nothing to review right now.</p>
                    <div v-else style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.75rem;">
                        <div
                            v-for="rec in pending"
                            :key="rec.id"
                            style="background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%); border: 1.5px solid var(--card-border); border-radius: 10px; padding: 1rem 1.25rem;"
                        >
                            <p style="margin: 0;"><strong>{{ rec.username }}</strong> reported <strong>{{ rec.percent }}%</strong> on <strong>{{ levelName(rec.level_path) }}</strong></p>
                            <p style="margin: 0.25rem 0 0;"><a :href="rec.video_link" target="_blank" style="color: var(--color-primary);">{{ rec.video_link }}</a></p>
                            <p style="margin: 0.15rem 0 0; opacity: 0.5; font-size: 0.8rem;">{{ formatDate(rec.created_at) }}</p>
                            <div style="display: flex; gap: 0.6rem; margin-top: 0.75rem;">
                                <button class="btn type-label-lg" style="border: none; cursor: pointer; padding: 0.5rem 1rem;" :disabled="reviewing === rec.id" @click="review(rec, 'approve')">Approve</button>
                                <button class="btn type-label-lg" style="border: none; cursor: pointer; padding: 0.5rem 1rem; background-color: var(--color-error); background-image: var(--error-gradient);" :disabled="reviewing === rec.id" @click="promptReject(rec)">Reject</button>
                            </div>
                        </div>
                    </div>
                    <div class="nav-profile-popup-divider" style="margin: 1.5rem 0;"></div>

                    <h2 style="font-size: 1.1rem;">Verifier Requests <span style="opacity: 0.5;">({{ verifierRequests.length }})</span></h2>
                    <p v-if="verifierRequestsLoading" style="opacity: 0.5;">Loading...</p>
                    <p v-else-if="verifierRequests.length === 0" style="opacity: 0.5;">Nothing to review right now.</p>
                    <div v-else style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.75rem;">
                        <div
                            v-for="req in verifierRequests"
                            :key="req.id"
                            style="background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%); border: 1.5px solid var(--card-border); border-radius: 10px; padding: 1rem 1.25rem;"
                        >
                            <p style="margin: 0;"><strong>{{ req.username }}</strong> wants to become the Set Verifier for <strong>{{ levelName(req.level_path) }}</strong></p>
                            <p style="margin: 0.35rem 0 0; opacity: 0.8;">"{{ req.reason }}"</p>
                            <p style="margin: 0.15rem 0 0; opacity: 0.5; font-size: 0.8rem;">{{ formatDate(req.created_at) }}</p>
                            <div style="display: flex; gap: 0.6rem; margin-top: 0.75rem;">
                                <button class="btn type-label-lg" style="border: none; cursor: pointer; padding: 0.5rem 1rem;" :disabled="reviewingRequest === req.id" @click="reviewVerifierRequest(req, 'approve')">Approve</button>
                                <button class="btn type-label-lg" style="border: none; cursor: pointer; padding: 0.5rem 1rem; background-color: var(--color-error); background-image: var(--error-gradient);" :disabled="reviewingRequest === req.id" @click="promptRejectRequest(req)">Reject</button>
                            </div>
                        </div>
                    </div>
                    <div class="nav-profile-popup-divider" style="margin: 1.5rem 0;"></div>
                </template>

                <div class="verif-mobile-nav">
                    <button type="button" @click="carouselDir = 'back'; view = 'list'" :disabled="view === 'list'" aria-label="List">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <transition :name="'carousel-' + carouselDir" mode="out-in">
                        <span class="type-label-lg" :key="view">{{ view === 'list' ? 'List' : 'Public Videos' }}</span>
                    </transition>
                    <button type="button" @click="carouselDir = 'fwd'; view = 'videos'" :disabled="view === 'videos'" aria-label="Public Videos">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                </div>

                <router-link
                    v-if="store.profile && store.profile.role === 'admin'"
                    to="/admin/manage-verifications"
                    class="suggest-level-btn"
                    style="background-image: none; background-color: #767676; margin-top: 0.5rem; margin-bottom: 0.75rem;"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span class="type-label-lg">Manage Verifications</span>
                </router-link>

                <div class="verif-subtab-row">
                    <div class="verif-subtab-dropdown-wrap" style="position: relative; width: 100%; min-width: 0; max-width: 460px;">
                        <button
                            type="button"
                            class="list-tab"
                            @click="subTabMenuOpen = !subTabMenuOpen"
                            style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 0.65rem 0.9rem;"
                        >
                            <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ tabs.find(t => t.key === subTab).label }}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: subTabMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>
                        <transition name="dropdown-fade">
                        <div
                            v-if="subTabMenuOpen"
                            style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; overflow: hidden; z-index: 20;"
                        >
                            <button
                                type="button"
                                v-for="tab in tabs"
                                :key="tab.key"
                                @click="subTab = tab.key; subTabMenuOpen = false;"
                                class="type-label-lg"
                                :style="{
                                    display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                    border: 'none', cursor: 'pointer',
                                    backgroundColor: subTab === tab.key ? 'var(--color-primary)' : 'transparent',
                                    color: subTab === tab.key ? '#ffffff' : 'inherit',
                                }"
                            >{{ tab.label }}</button>
                        </div>
                        </transition>
                        <div v-if="subTabMenuOpen" @click="subTabMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
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
                        v-if="false"
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
                        <div style="margin-top: 0;">
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
                        </div>
                    </div>
                </div>
                </transition>

                <Spinner v-if="loading"></Spinner>

                <template v-else-if="view === 'list'">
                    <p v-if="filteredLevels.length === 0" style="opacity: 0.5; margin-top: 1.5rem;">
                        No levels here yet.
                    </p>

                    <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.25rem;">
                        <div
                            v-for="level in filteredLevels"
                            :key="subTab + '-' + level.path"
                            style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%); border: 1.5px solid var(--card-border); border-radius: 10px; padding: 1rem 1.25rem;"
                        >
                            <div style="min-width: 0;">
                                <p class="type-label-lg" style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                                    {{ level.name }}
                                    <span v-if="isNewItem(level.date_added, 'verification')" class="new-badge">New</span>
                                    <span v-else-if="isNewItem(level.date_updated, 'levelUpdated')" class="updated-badge">Updated</span>
                                    <a
                                        v-if="level.showcase || featuredVideos[level.path]"
                                        :href="level.showcase || featuredVideos[level.path]"
                                        target="_blank"
                                        title="Watch video"
                                        style="color: var(--color-primary); text-decoration: none; font-size: 1.1rem; line-height: 1;"
                                    >➤</a>
                                </p>
                                <p style="margin: 0.15rem 0 0; opacity: 0.6; font-size: 0.85rem;">
                                    by {{ level.creators && level.creators.length ? level.creators.join(', ') : level.author }}
                                </p>
                                <p v-if="level.id" style="margin: 0.1rem 0 0; opacity: 0.4; font-size: 0.8rem;">ID: {{ level.id }}</p>
                            </div>

                            <div style="flex-shrink: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1rem;">
                                <template v-if="subTab === 'verified'">
                                    <div style="text-align: left;">
                                        <p style="margin: 0; opacity: 0.7; font-size: 0.85rem;">Verified by</p>
                                        <p style="margin: 0.15rem 0 0;">{{ level.verifier }}</p>
                                        <p v-if="level.verified_date" style="margin: 0.15rem 0 0; opacity: 0.5; font-size: 0.8rem;">{{ formatDate(level.verified_date) }}</p>
                                        <p v-if="level.addedToList" style="margin: 0.3rem 0 0; opacity: 0.5; font-size: 0.8rem;">✓ Added to {{ level.category || 'classic' }}</p>
                                    </div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 0.6rem; flex-basis: 100%; justify-content: flex-start;">
                                        <button
                                            v-if="canSeeVideos(level)"
                                            type="button"
                                            style="background: none; border: 1.5px solid var(--color-primary); color: inherit; border-radius: 8px; cursor: pointer; padding: 0.5rem 0.9rem; white-space: nowrap;"
                                            @click="openVideos(level)"
                                        >Videos</button>
                                        <button
                                            v-if="isStaff && !level.addedToList"
                                            type="button"
                                            class="btn type-label-lg"
                                            style="border: none; cursor: pointer; padding: 0.5rem 0.9rem; white-space: nowrap;"
                                            @click="openAddToListForm(level)"
                                        >Add to List</button>
                                        <button
                                            v-if="!isStaff && !level.addedToList && (level.verifier || '').toLowerCase() === myName"
                                            type="button"
                                            style="background: none; border: 1.5px solid var(--color-primary); color: inherit; border-radius: 8px; cursor: pointer; padding: 0.5rem 0.9rem; white-space: nowrap;"
                                            :disabled="!!level.listAddRequest"
                                            @click="openRequestListAddForm(level)"
                                        >{{ level.listAddRequest ? 'Requested — #' + level.listAddRequest.position : 'Request to be Added' }}</button>
                                    </div>
                                </template>
                                <template v-else>
                                    <div style="text-align: left;">
                                        <p style="margin: 0; opacity: 0.7; font-size: 0.85rem;">{{ subTab === 'set_verifier' ? 'Verifier' : 'Current %' }}</p>
                                        <p style="margin: 0.15rem 0 0;">
                                            <template v-if="subTab === 'set_verifier'">{{ level.verifier }} — {{ level.percent || 0 }}%</template>
                                            <template v-else>{{ level.percent || 0 }}%</template>
                                        </p>
                                    </div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 0.6rem; flex-basis: 100%; justify-content: flex-start;">
                                        <button
                                            v-if="canReport(level)"
                                            class="btn type-label-lg"
                                            style="border: none; cursor: pointer; padding: 0.5rem 0.9rem; white-space: nowrap;"
                                            @click="openReportForm(level)"
                                        >Report %</button>
                                        <button
                                            v-if="canSeeVideos(level)"
                                            type="button"
                                            style="background: none; border: 1.5px solid var(--color-primary); color: inherit; border-radius: 8px; cursor: pointer; padding: 0.5rem 0.9rem; white-space: nowrap;"
                                            @click="openVideos(level)"
                                        >Videos</button>
                                        <button
                                            v-if="subTab === 'open_verification' && store.user"
                                            type="button"
                                            style="background: none; border: 1.5px solid var(--color-primary); color: inherit; border-radius: 8px; cursor: pointer; padding: 0.5rem 0.9rem; white-space: nowrap;"
                                            @click="openBecomeVerifierForm(level)"
                                        >Request to be Verifier</button>
                                        <button
                                            v-if="subTab === 'set_verifier' && canReport(level)"
                                            type="button"
                                            style="background: none; border: 1.5px solid var(--color-error); color: var(--color-error); border-radius: 8px; cursor: pointer; padding: 0.5rem 0.9rem; white-space: nowrap;"
                                            @click="openGiveUpForm(level)"
                                        >Give Up</button>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </transition-group>
                </template>

                <!-- ================= PUBLIC VIDEOS (showcase, ou destaque da % mais alta) ================= -->
                <template v-else>
                    <p v-if="publicVideoLevels.length === 0" style="opacity: 0.5; margin-top: 1.5rem;">
                        No public videos for {{ tabs.find(t => t.key === subTab).label }} yet.
                    </p>
                    <transition-group name="row-fade" tag="div" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; margin-top: 1.25rem;">
                        <div
                            v-for="entry in publicVideoLevels"
                            :key="subTab + '-' + entry.level.path"
                            style="background-color: var(--card-bg); border: 1.5px solid var(--card-border); border-radius: 10px; overflow: hidden;"
                        >
                            <div class="slide-tabs" style="margin: 0.5rem 0.5rem 0;">
                                <button
                                    type="button"
                                    class="slide-tab"
                                    :disabled="!entry.record"
                                    :style="{ padding: '0.5rem 0.35rem', fontSize: '0.85rem', opacity: !entry.record ? 0.35 : 1, cursor: !entry.record ? 'not-allowed' : 'pointer' }"
                                    :class="{ active: (videoToggle[entry.level.path] || (entry.showcase ? 'showcase' : 'record')) === 'record' }"
                                    @click="entry.record && (videoToggle = { ...videoToggle, [entry.level.path]: 'record' })"
                                >{{ subTab === 'verified' ? 'Verification' : 'Current %' }}</button>
                                <button
                                    type="button"
                                    class="slide-tab"
                                    :disabled="!entry.showcase"
                                    :style="{ padding: '0.5rem 0.35rem', fontSize: '0.85rem', opacity: !entry.showcase ? 0.35 : 1, cursor: !entry.showcase ? 'not-allowed' : 'pointer' }"
                                    :class="{ active: (videoToggle[entry.level.path] || (entry.showcase ? 'showcase' : 'record')) === 'showcase' }"
                                    @click="entry.showcase && (videoToggle = { ...videoToggle, [entry.level.path]: 'showcase' })"
                                >Showcase</button>
                                <div class="slide-tab-indicator" :style="{ transform: (videoToggle[entry.level.path] || (entry.showcase ? 'showcase' : 'record')) === 'showcase' ? 'translateX(100%)' : 'translateX(0)' }"></div>
                            </div>
                            <transition name="tab-fade" mode="out-in">
                            <a :href="pickVideo(entry)" target="_blank" style="display: block;" :key="pickVideo(entry)">
                                <iframe :src="embed(pickVideo(entry))" style="width: 100%; aspect-ratio: 16/9; border: none; pointer-events: none;"></iframe>
                            </a>
                            </transition>
                            <div style="padding: 0.75rem 1rem;">
                                <p class="type-label-lg" style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                                    {{ entry.level.name }}
                                    <span v-if="isNewItem(entry.level.date_added, 'verification')" class="new-badge">New</span>
                                    <span v-else-if="isNewItem(entry.level.date_updated, 'levelUpdated')" class="updated-badge">Updated</span>
                                </p>
                                <p style="margin: 0.2rem 0 0; opacity: 0.6; font-size: 0.85rem;">
                                    {{ entry.level.status === 'verified' ? ('Verified — ' + entry.level.verifier) : ((entry.level.percent || 0) + '%') }}
                                </p>
                            </div>
                        </div>
                    </transition-group>
                </template>
            </div>

            <!-- ================= REPORT % POPUP ================= -->
            <transition name="tab-fade">
            <div v-if="reportLevel" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="closeReportForm">
                <form @submit.prevent="submitReport" style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 420px; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Report % — {{ reportLevel.name }}</p>
                        <button type="button" @click="closeReportForm" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>

                    <p style="opacity: 0.6; font-size: 0.85rem; margin-top: 0.5rem;">
                        Current: {{ reportLevel.percent || 0 }}%. Every update needs a video/raw footage — only you and mods/admins can see it.
                        {{ reportPercent === 100 ? 'Reaching 100% always needs admin review before it counts.' : '' }}
                    </p>

                    <transition name="alert-fade"><div v-if="reportError" class="login-alert login-alert-error" style="margin-top: 0.75rem;">{{ reportError }}</div></transition>

                    <div style="margin-top: 0.75rem;">
                        <label for="reportPercent">New Percent</label><br>
                        <input id="reportPercent" type="number" v-model.number="reportPercent" min="1" max="100" required class="login-input">
                    </div>

                    <div style="margin-top: 0.75rem;">
                        <label for="reportVideo">Video / Raw Footage Link</label><br>
                        <input id="reportVideo" type="text" v-model="reportVideo" required placeholder="https://youtu.be/... or Drive/Mega link" class="login-input">
                    </div>

                    <button
                        type="submit"
                        class="btn type-label-lg"
                        :disabled="reporting"
                        style="margin-top: 1rem; width: 100%; padding: 0.75rem; border: none; cursor: pointer;"
                    >{{ reporting ? 'Sending...' : 'Send' }}</button>
                </form>
            </div>
            </transition>
            <!-- ================= VIDEOS POPUP (histórico privado) ================= -->
            <transition name="tab-fade">
            <div v-if="videosLevel" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="closeVideos">
                <div style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 480px; max-height: 80vh; min-width: 0; overflow-x: hidden; display: flex; flex-direction: column; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Videos — {{ videosLevel.name }}</p>
                        <button type="button" @click="closeVideos" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>
                    <p style="opacity: 0.5; font-size: 0.8rem; margin-top: 0.3rem;">Private — only visible to the verifier and mods/admins.</p>

                    <div style="overflow-y: auto; margin-top: 0.75rem; flex: 1;">
                        <p v-if="videosLoading" style="opacity: 0.5;">Loading...</p>
                        <p v-else-if="videoRecords.length === 0" style="opacity: 0.5;">No records yet.</p>
                        <div
                            v-for="rec in videoRecords"
                            :key="rec.id"
                            style="background-color: var(--color-background-hover); border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 0.6rem; overflow-wrap: break-word;"
                        >
                            <p style="margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem;">
                                <strong style="font-size: 1.05rem;">{{ rec.percent }}%</strong>
                                <span v-if="isStaff" style="opacity: 0.8;">— {{ rec.username }}</span>
                                <span :style="{ opacity: 0.65, fontSize: '0.8rem', color: rec.status === 'approved' ? 'var(--color-primary)' : (rec.status === 'rejected' ? 'var(--color-error)' : 'inherit') }">
                                    ({{ rec.status }})
                                </span>
                            </p>
                            <p style="margin: 0.5rem 0 0;"><a :href="rec.video_link" target="_blank" style="color: var(--color-primary); word-break: break-all;">{{ rec.video_link }}</a></p>
                            <p style="margin: 0.5rem 0 0; opacity: 0.5; font-size: 0.8rem;">{{ formatDate(rec.created_at) }}</p>
                            <p v-if="rec.status === 'rejected' && rec.reject_reason" style="margin: 0.35rem 0 0; opacity: 0.6; font-size: 0.8rem;">Reason: {{ rec.reject_reason }}</p>
                            <button
                                v-if="isStaff && rec.status === 'approved'"
                                type="button"
                                :disabled="reverting === rec.id"
                                @click="revertRecord(rec)"
                                style="margin-top: 0.65rem; background: none; border: 1px solid var(--color-error); color: var(--color-error); border-radius: 6px; cursor: pointer; padding: 0.35rem 0.7rem; font-size: 0.8rem;"
                            >{{ reverting === rec.id ? 'Reverting...' : 'Revert' }}</button>
                        </div>
                    </div>
                </div>
            </div>
            </transition>

        <!-- ================= REQUEST TO BE VERIFIER POPUP ================= -->
        <transition name="tab-fade">
        <div v-if="becomeVerifierLevel" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="closeBecomeVerifierForm">
            <form @submit.prevent="submitBecomeVerifier" style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 420px; padding: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <p class="type-label-lg" style="margin: 0;">Request to be Verifier — {{ becomeVerifierLevel.name }}</p>
                    <button type="button" @click="closeBecomeVerifierForm" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                </div>
                <p style="opacity: 0.6; font-size: 0.85rem; margin-top: 0.5rem;">
                    A mod/admin will review this. If approved, this level becomes Set Verifier with you as the verifier.
                </p>

                <transition name="alert-fade"><div v-if="becomeVerifierError" class="login-alert login-alert-error" style="margin-top: 0.75rem;">{{ becomeVerifierError }}</div></transition>

                <div style="margin-top: 0.75rem;">
                    <label for="becomeVerifierReason">Why should you be the verifier?</label><br>
                    <textarea id="becomeVerifierReason" v-model="becomeVerifierReason" required rows="4" class="login-input"></textarea>
                </div>

                <button
                    type="submit"
                    class="btn type-label-lg"
                    :disabled="submittingBecomeVerifier"
                    style="margin-top: 1rem; width: 100%; padding: 0.75rem; border: none; cursor: pointer;"
                >{{ submittingBecomeVerifier ? 'Sending...' : 'Send Request' }}</button>
            </form>
        </div>
        </transition>

        <!-- ================= GIVE UP POPUP ================= -->
        <transition name="tab-fade">
        <div v-if="giveUpLevel" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="closeGiveUpForm">
            <form @submit.prevent="submitGiveUp" style="background-color: var(--color-background); border: 1px solid var(--color-error); border-radius: 12px; width: 100%; max-width: 420px; padding: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <p class="type-label-lg" style="margin: 0; color: var(--color-error);">Give Up — {{ giveUpLevel.name }}</p>
                    <button type="button" @click="closeGiveUpForm" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                </div>
                <p style="opacity: 0.7; font-size: 0.85rem; margin-top: 0.5rem;">
                    Are you sure? This level will go back to Open Verification, open for anyone to attempt. This can't be undone.
                </p>

                <transition name="alert-fade"><div v-if="giveUpError" class="login-alert login-alert-error" style="margin-top: 0.75rem;">{{ giveUpError }}</div></transition>

                <div style="margin-top: 0.75rem;">
                    <label for="giveUpReason">Why are you giving up?</label><br>
                    <textarea id="giveUpReason" v-model="giveUpReason" required rows="4" class="login-input"></textarea>
                </div>

                <button
                    type="submit"
                    :disabled="submittingGiveUp"
                    style="margin-top: 1rem; width: 100%; padding: 0.75rem; border: none; border-radius: 8px; cursor: pointer; background-color: var(--color-error); background-image: var(--error-gradient); color: white; font-weight: 700;"
                >{{ submittingGiveUp ? 'Sending...' : 'Yes, give up' }}</button>
            </form>
        </div>
        </transition>
        <!-- ================= REQUEST LIST ADD POPUP (verifier) ================= -->
        <transition name="tab-fade">
        <div v-if="requestListAddLevel" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="closeRequestListAddForm">
            <form @submit.prevent="submitRequestListAdd" style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 380px; padding: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <p class="type-label-lg" style="margin: 0;">Request to be Added — {{ requestListAddLevel.name }}</p>
                    <button type="button" @click="closeRequestListAddForm" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                </div>
                <p style="opacity: 0.6; font-size: 0.85rem; margin-top: 0.5rem;">
                    An admin will review this. They can change the position when adding it.
                </p>

                <transition name="alert-fade"><div v-if="requestListAddError" class="login-alert login-alert-error" style="margin-top: 0.75rem;">{{ requestListAddError }}</div></transition>

                <div style="margin-top: 0.75rem;">
                    <label for="requestListAddPosition">Desired position on the {{ requestListAddLevel.category || 'classic' }} list</label><br>
                    <input id="requestListAddPosition" type="number" v-model.number="requestListAddPosition" min="1" required class="login-input">
                </div>

                <button
                    type="submit"
                    class="btn type-label-lg"
                    :disabled="submittingRequestListAdd"
                    style="margin-top: 1rem; width: 100%; padding: 0.75rem; border: none; cursor: pointer;"
                >{{ submittingRequestListAdd ? 'Sending...' : 'Send Request' }}</button>
            </form>
        </div>
        </transition>

        <!-- ================= ADMIN: ADD TO LIST POPUP ================= -->
        <transition name="tab-fade">
        <div v-if="addToListLevel" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; overflow-y: auto;" @click.self="closeAddToListForm">
            <form @submit.prevent="submitAddToList" style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 460px; padding: 1.25rem; margin: 2rem 0;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <p class="type-label-lg" style="margin: 0;">Add to List — {{ addToListLevel.name }}</p>
                    <button type="button" @click="closeAddToListForm" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                </div>
                <p v-if="addToListLevel.listAddRequest" style="opacity: 0.6; font-size: 0.85rem; margin-top: 0.5rem;">
                    {{ addToListLevel.listAddRequest.requestedBy }} requested position #{{ addToListLevel.listAddRequest.position }}.
                </p>

                <transition name="alert-fade"><div v-if="addToListError" class="login-alert login-alert-error" style="margin-top: 0.75rem;">{{ addToListError }}</div></transition>

                <div style="margin-top: 0.75rem;">
                    <label>Target List</label><br>
                    <div class="list-tabs" style="margin-top: 0.4rem;">
                        <button type="button" class="list-tab" :class="{ active: addToListForm.targetList === 'classic' }" @click="addToListForm.targetList = 'classic'">Classic</button>
                        <button type="button" class="list-tab" :class="{ active: addToListForm.targetList === 'platformer' }" @click="addToListForm.targetList = 'platformer'">Platformer</button>
                        <button type="button" class="list-tab" :class="{ active: addToListForm.targetList === 'challenge' }" @click="addToListForm.targetList = 'challenge'">Challenge</button>
                    </div>
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 1.25rem; margin-top: 0.75rem;">
                    <div style="flex: 1 1 130px; min-width: 0;">
                        <label for="atlName">Level Name</label><br>
                        <input id="atlName" type="text" v-model="addToListForm.name" required class="login-input">
                    </div>
                    <div style="flex: 1 1 130px; min-width: 0;">
                        <label for="atlPath">Path</label><br>
                        <input id="atlPath" type="text" v-model="addToListForm.path" required class="login-input">
                    </div>
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 1.25rem; margin-top: 0.75rem;">
                    <div style="flex: 1 1 130px; min-width: 0;">
                        <label for="atlId">Level ID</label><br>
                        <input id="atlId" type="number" v-model="addToListForm.id" required class="login-input">
                    </div>
                    <div style="flex: 1 1 130px; min-width: 0;">
                        <label for="atlPosition">Position</label><br>
                        <input id="atlPosition" type="number" v-model.number="addToListForm.position" min="1" required class="login-input">
                    </div>
                </div>

                <div style="margin-top: 0.75rem;">
                    <label for="atlAuthor">Author</label><br>
                    <input id="atlAuthor" type="text" v-model="addToListForm.author" required class="login-input">
                </div>

                <div style="margin-top: 0.75rem;">
                    <label for="atlCreators">Creators <span style="opacity: 0.5;">(comma-separated)</span></label><br>
                    <input id="atlCreators" type="text" v-model="addToListForm.creators" class="login-input">
                </div>

                <div style="margin-top: 0.75rem;">
                    <label for="atlVerifier">Verifier</label><br>
                    <input id="atlVerifier" type="text" v-model="addToListForm.verifier" required class="login-input">
                </div>

                <div style="margin-top: 0.75rem;">
                    <label for="atlVerification">Verification Video Link</label><br>
                    <input id="atlVerification" type="text" v-model="addToListForm.verification" required class="login-input">
                </div>

                <div style="margin-top: 0.75rem;">
                    <label for="atlShowcase">Showcase Video Link (optional)</label><br>
                    <input id="atlShowcase" type="text" v-model="addToListForm.showcase" class="login-input">
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 1.25rem; margin-top: 0.75rem;">
                    <div style="flex: 1 1 130px; min-width: 0;">
                        <label for="atlPercent">% To Qualify</label><br>
                        <input id="atlPercent" type="number" v-model.number="addToListForm.percentToQualify" min="1" max="100" required class="login-input">
                    </div>
                    <div style="flex: 1 1 130px; min-width: 0;">
                        <label for="atlPassword">Password</label><br>
                        <input id="atlPassword" type="text" v-model="addToListForm.password" class="login-input">
                    </div>
                </div>

                <button
                    type="submit"
                    class="btn type-label-lg"
                    :disabled="submittingAddToList"
                    style="margin-top: 1rem; width: 100%; padding: 0.75rem; border: none; cursor: pointer;"
                >{{ submittingAddToList ? 'Adding...' : 'Add to List' }}</button>
            </form>
        </div>
        </transition>
        </main>
    `,
    data: () => ({
        store,
        tabs: SUB_TABS,
        subTab: "set_verifier",
        subTabMenuOpen: false,
        searchQuery: "",
        filtersOpen: false,
        badgeFilter: 'all', // 'all', 'new', 'updated', 'none'
        BADGE_FILTER_LABELS_: BADGE_FILTER_LABELS,
        view: "list", // 'list' | 'videos'
        carouselDir: "fwd", // 'fwd' | 'back' — direção da animação do carrossel List/Public Videos
        featuredVideos: {}, // { level_path: video_link } — a % mais alta aprovada de cada fase
        videoToggle: {}, // { level_path: 'showcase' | 'record' } — qual vídeo mostrar no card
        loading: true,
        levels: [],
        errors: [],
        feedback: null,

        pending: [],
        pendingLoading: false,
        reviewing: null,

        reportLevel: null,
        reportPercent: 100,
        reportVideo: "",
        reportError: null,
        reporting: false,

        videosLevel: null,
        videoRecords: [],
        videosLoading: false,
        reverting: null,

        verifierRequests: [],
        verifierRequestsLoading: false,
        reviewingRequest: null,

        becomeVerifierLevel: null,
        becomeVerifierReason: "",
        becomeVerifierError: null,
        submittingBecomeVerifier: false,

        giveUpLevel: null,
        giveUpReason: "",
        giveUpError: null,
        submittingGiveUp: false,

        requestListAddLevel: null,
        requestListAddPosition: 1,
        requestListAddError: null,
        submittingRequestListAdd: false,

        addToListLevel: null,
        addToListForm: {
            targetList: "classic",
            name: "", path: "", id: "", position: 1,
            author: "", creators: "", verifier: "", verification: "",
            showcase: "", percentToQualify: 100, password: "Copyable",
        },
        addToListError: null,
        submittingAddToList: false,
    }),
    computed: {
        isStaff() {
            return store.profile && (store.profile.role === "mod" || store.profile.role === "admin");
        },
        myName() {
            return (store.profile?.list_name || store.profile?.username || "").toLowerCase();
        },
        filteredLevels() {
            let filtered = this.levels.filter((l) => l.status === this.subTab);
            if (this.subTab === "verified") {
                filtered = filtered.sort((a, b) => new Date(b.verified_date || 0) - new Date(a.verified_date || 0));
            }
            const q = this.searchQuery.trim().toLowerCase();
            if (q) {
                filtered = filtered.filter((l) => l.name && l.name.toLowerCase().includes(q));
            }
            if (this.badgeFilter !== 'all') {
                filtered = filtered.filter((l) => {
                    const hasNew = this.isNewItem(l.date_added, 'verification');
                    const hasUpdated = this.isNewItem(l.date_updated, 'levelUpdated');
                    return matchesBadgeFilter(this.badgeFilter, hasNew, hasUpdated);
                });
            }
            return filtered;
        },
        publicVideoLevels() {
            return this.filteredLevels
                .map((level) => ({
                    level,
                    showcase: level.showcase || null,
                    record: this.featuredVideos[level.path] || null,
                }))
                .filter((entry) => entry.showcase || entry.record);
        },
    },
    methods: {
        setBadgeFilter(value) {
            this.badgeFilter = this.badgeFilter === value ? 'all' : value;
        },
        isNewItem(dateString, category) {
            return isNew(dateString, NEW_BADGE_DAYS[category]);
        },
        pickVideo(entry) {
            const choice = this.videoToggle[entry.level.path] || (entry.showcase ? 'showcase' : 'record');
            return choice === 'record'
                ? (entry.record || entry.showcase)
                : (entry.showcase || entry.record);
        },
        embed(url) {
            return embed(url);
        },
        canSeeVideos(level) {
            if (!store.user) return false;
            if (this.isStaff) return true;
            if (this.subTab === "open_verification") return true; // pode ver o próprio histórico (RLS já limita)
            return (level.verifier || "").toLowerCase() === this.myName;
        },
        async openVideos(level) {
            this.videosLevel = level;
            this.videoRecords = [];
            this.videosLoading = true;
            try {
                const { data } = await supabase
                    .from('verification_records')
                    .select('*')
                    .eq('level_path', level.path)
                    .order('created_at', { ascending: false });
                this.videoRecords = data || [];
            } finally {
                this.videosLoading = false;
            }
        },
        closeVideos() {
            this.videosLevel = null;
        },
        async revertRecord(rec) {
            if (!confirm(`Revert ${rec.username}'s ${rec.percent}% record? This will recalculate the level's public %.`)) return;
            this.reverting = rec.id;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/revert-verification-record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ recordId: rec.id }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to revert.');

                this.feedback = { ok: true, message: result.unverified ? 'Reverted — level is no longer Verified.' : 'Reverted.' };
                await this.openVideos(this.videosLevel);
                await Promise.all([this.loadLevels(), this.loadFeaturedVideos()]);
            } catch (err) {
                this.feedback = { ok: false, message: err.message || 'Something went wrong.' };
            } finally {
                this.reverting = null;
            }
        },
        canReport(level) {
            if (!store.user || !this.myName) return false;
            if (this.subTab === "set_verifier") {
                return (level.verifier || "").toLowerCase() === this.myName;
            }
            if (this.subTab === "open_verification") {
                return true; // qualquer jogador logado pode tentar
            }
            return false;
        },
        levelName(path) {
            return this.levels.find((l) => l.path === path)?.name || path;
        },
        formatDate(iso) {
            try {
                return new Date(iso).toLocaleDateString();
            } catch {
                return "";
            }
        },
        openReportForm(level) {
            this.reportLevel = level;
            this.reportPercent = Math.min(100, (level.percent || 0) + 1);
            this.reportVideo = "";
            this.reportError = null;
        },
        closeReportForm() {
            this.reportLevel = null;
        },
        async submitReport() {
            this.reportError = null;
            if (!this.reportVideo.trim()) {
                this.reportError = "Please provide a video/raw footage link.";
                return;
            }
            this.reporting = true;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/submit-verification-progress', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({
                        levelPath: this.reportLevel.path,
                        percent: this.reportPercent,
                        videoLink: this.reportVideo.trim(),
                    }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to send report.');

                this.feedback = {
                    ok: true,
                    message: result.autoApplied
                        ? `Applied! ${this.reportLevel.name} is now at ${this.reportPercent}%.`
                        : `Sent for review — a mod/admin will check the footage soon.`,
                };
                this.closeReportForm();
                await Promise.all([this.loadLevels(), this.loadFeaturedVideos()]);
            } catch (err) {
                this.reportError = err.message || 'Something went wrong.';
            } finally {
                this.reporting = false;
            }
        },
        promptReject(rec) {
            const reason = prompt('Reason for rejecting this record (optional):') || '';
            this.review(rec, 'reject', reason);
        },
        async review(rec, action, rejectReason) {
            this.reviewing = rec.id;
            this.feedback = null;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/review-verification-record', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ recordId: rec.id, action, rejectReason }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to review.');

                this.feedback = { ok: true, message: action === 'approve' ? 'Approved!' : 'Rejected.' };
                await Promise.all([this.loadPending(), this.loadLevels(), this.loadFeaturedVideos()]);
            } catch (err) {
                this.feedback = { ok: false, message: err.message || 'Something went wrong.' };
            } finally {
                this.reviewing = null;
            }
        },
        openRequestListAddForm(level) {
            this.requestListAddLevel = level;
            this.requestListAddPosition = 1;
            this.requestListAddError = null;
        },
        closeRequestListAddForm() {
            this.requestListAddLevel = null;
        },
        async submitRequestListAdd() {
            this.requestListAddError = null;
            this.submittingRequestListAdd = true;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/request-list-add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({
                        levelPath: this.requestListAddLevel.path,
                        position: this.requestListAddPosition,
                    }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to send request.');

                this.feedback = { ok: true, message: 'Request sent! An admin will review it soon.' };
                this.closeRequestListAddForm();
                await this.loadLevels();
            } catch (err) {
                this.requestListAddError = err.message || 'Something went wrong.';
            } finally {
                this.submittingRequestListAdd = false;
            }
        },
        openAddToListForm(level) {
            this.addToListLevel = level;
            this.addToListError = null;
            this.addToListForm = {
                targetList: level.category || 'classic',
                name: level.name || '',
                path: level.path || '',
                id: level.id || '',
                position: level.listAddRequest?.position || 1,
                author: level.author || '',
                creators: (level.creators || []).join(', '),
                verifier: level.verifier || '',
                verification: level.showcase || this.featuredVideos[level.path] || '',
                showcase: level.showcase || '',
                percentToQualify: 100,
                password: level.password || 'Copyable',
            };
        },
        closeAddToListForm() {
            this.addToListLevel = null;
        },
        async submitAddToList() {
            this.addToListError = null;
            this.submittingAddToList = true;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const creatorsArr = this.addToListForm.creators.split(',').map((c) => c.trim()).filter(Boolean);
                const res = await fetch('/api/add-verified-to-list', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({
                        verificationPath: this.addToListLevel.path,
                        targetList: this.addToListForm.targetList,
                        position: this.addToListForm.position,
                        path: this.addToListForm.path.trim(),
                        id: this.addToListForm.id,
                        name: this.addToListForm.name.trim(),
                        author: this.addToListForm.author.trim(),
                        creators: creatorsArr,
                        verifier: this.addToListForm.verifier.trim(),
                        verification: this.addToListForm.verification.trim(),
                        showcase: this.addToListForm.showcase.trim(),
                        percentToQualify: this.addToListForm.percentToQualify,
                        password: this.addToListForm.password.trim(),
                    }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to add to list.');

                this.feedback = { ok: true, message: `"${this.addToListForm.name}" was added to the ${this.addToListForm.targetList} list!` };
                this.closeAddToListForm();
                await this.loadLevels();
            } catch (err) {
                this.addToListError = err.message || 'Something went wrong.';
            } finally {
                this.submittingAddToList = false;
            }
        },
        openBecomeVerifierForm(level) {
            this.becomeVerifierLevel = level;
            this.becomeVerifierReason = "";
            this.becomeVerifierError = null;
        },
        closeBecomeVerifierForm() {
            this.becomeVerifierLevel = null;
        },
        async submitBecomeVerifier() {
            this.becomeVerifierError = null;
            if (!this.becomeVerifierReason.trim()) {
                this.becomeVerifierError = "Please explain why you should be the verifier.";
                return;
            }
            this.submittingBecomeVerifier = true;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/request-become-verifier', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({
                        levelPath: this.becomeVerifierLevel.path,
                        reason: this.becomeVerifierReason.trim(),
                    }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to send request.');

                this.feedback = { ok: true, message: 'Request sent! A mod/admin will review it soon.' };
                this.closeBecomeVerifierForm();
            } catch (err) {
                this.becomeVerifierError = err.message || 'Something went wrong.';
            } finally {
                this.submittingBecomeVerifier = false;
            }
        },
        openGiveUpForm(level) {
            this.giveUpLevel = level;
            this.giveUpReason = "";
            this.giveUpError = null;
        },
        closeGiveUpForm() {
            this.giveUpLevel = null;
        },
        async submitGiveUp() {
            this.giveUpError = null;
            if (!this.giveUpReason.trim()) {
                this.giveUpError = "Please explain why you're giving up.";
                return;
            }
            this.submittingGiveUp = true;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/give-up-verifier', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({
                        levelPath: this.giveUpLevel.path,
                        reason: this.giveUpReason.trim(),
                    }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to give up.');

                this.feedback = { ok: true, message: `You gave up verifying "${this.giveUpLevel.name}". It's Open Verification now.` };
                this.closeGiveUpForm();
                await this.loadLevels();
            } catch (err) {
                this.giveUpError = err.message || 'Something went wrong.';
            } finally {
                this.submittingGiveUp = false;
            }
        },
        promptRejectRequest(req) {
            const reason = prompt('Reason for rejecting this request (optional):') || '';
            this.reviewVerifierRequest(req, 'reject', reason);
        },
        async reviewVerifierRequest(req, action, rejectReason) {
            this.reviewingRequest = req.id;
            this.feedback = null;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('/api/review-verifier-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ requestId: req.id, action, rejectReason }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to review.');

                this.feedback = { ok: true, message: action === 'approve' ? 'Approved!' : 'Rejected.' };
                await Promise.all([this.loadVerifierRequests(), this.loadLevels()]);
            } catch (err) {
                this.feedback = { ok: false, message: err.message || 'Something went wrong.' };
            } finally {
                this.reviewingRequest = null;
            }
        },
        async loadVerifierRequests() {
            if (!this.isStaff) return;
            this.verifierRequestsLoading = true;
            try {
                const { data } = await supabase
                    .from('verifier_requests')
                    .select('*')
                    .eq('request_type', 'become_verifier')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: true });
                this.verifierRequests = data || [];
            } finally {
                this.verifierRequestsLoading = false;
            }
        },
        async loadPending() {
            if (!this.isStaff) return;
            this.pendingLoading = true;
            try {
                const { data } = await supabase
                    .from('verification_records')
                    .select('*')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: true });
                this.pending = data || [];
            } finally {
                this.pendingLoading = false;
            }
        },
        async loadFeaturedVideos() {
            try {
                const res = await fetch('/api/featured-videos');
                if (res.ok) {
                    this.featuredVideos = await res.json();
                }
            } catch {
                // não é crítico — a seta/galeria só usa showcase se isso falhar
            }
        },
        async loadLevels() {
            const result = await fetchVerificationsList();
            if (result) {
                this.levels = result.filter(([level]) => level).map(([level]) => level);
                this.errors = result.filter(([, err]) => err).map(([, err]) => err);
            }
        },
    },
    async mounted() {
        await Promise.all([this.loadLevels(), this.loadFeaturedVideos()]);
        this.loading = false;
        this.loadPending();
        this.loadVerifierRequests();
    },
};
