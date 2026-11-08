import { store } from "../main.js";
import { supabase } from "../supabase.js";
import { embed, getYoutubeIdFromUrl } from "../util.js";
import { isNew, NEW_BADGE_DAYS, matchesBadgeFilter, BADGE_FILTER_LABELS } from "../newBadge.js";
import {
    fetchList,
    fetchPlatformerList,
    fetchChallengeList,
    fetchImpossibleList,
} from "../content.js";

import Spinner from "../components/Spinner.js";
import ImageCropper from "../components/ImageCropper.js";

const LIST_FETCHERS = {
    classic: fetchList,
    platformer: fetchPlatformerList,
    challenge: fetchChallengeList,
    impossible: fetchImpossibleList,
};

const TARGET_LABELS = {
    classic: "Classic",
    platformer: "Platformer",
    challenge: "Challenge",
    impossible: "Impossible",
};

const STATUS_LABELS = {
    all: "All Statuses",
    in_work: "In Work",
    finished: "Finished",
};

// Larguras responsivas: um teto no desktop, mas nunca estoura a tela no mobile
// (min() escolhe o menor entre o teto e 100% do card).
const IMAGE_SIZE_CSS = {
    smaller: "min(120px, 100%)",
    small: "min(180px, 100%)",
    medium: "min(240px, 100%)",
    large: "min(400px, 100%)",
    full: "100%",
};
const VIDEO_SIZE_CSS = {
    small: "min(260px, 100%)",
    medium: "min(420px, 100%)",
    large: "min(600px, 100%)",
    full: "100%",
};
const IMAGE_SIZE_OPTIONS = ["smaller", "small", "medium", "large", "full"];
const VIDEO_SIZE_OPTIONS = ["small", "medium", "large", "full"];

export default {
    components: { Spinner, ImageCropper },
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
                    <span class="type-label-lg" :key="mobileSection">{{ mobileSection === 0 ? 'Projects' : (project ? project.name : 'Album') }}</span>
                </transition>
                <button type="button" @click="carouselDir = 'fwd'; mobileSection = Math.min(1, mobileSection + 1)" :disabled="mobileSection === 1" aria-label="Next section">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
            </div>

            <!-- ================= LISTA DE PROJECTS ================= -->
            <div class="list-container" :class="{ 'mobile-section-active': mobileSection === 0 }">
                <div style="position: relative;">
                    <button
                        type="button"
                        class="list-tab"
                        @click="targetMenuOpen = !targetMenuOpen"
                        style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 0.65rem 0.9rem;"
                    >
                        <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ targetFilter === 'all' ? 'All Projects' : TARGET_LABELS_[targetFilter] }}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: targetMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                            <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </button>
                    <transition name="dropdown-fade">
                    <div
                        v-if="targetMenuOpen"
                        style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; overflow: hidden; z-index: 20;"
                    >
                        <button
                            v-for="t in ['all', 'classic', 'platformer', 'challenge', 'impossible']"
                            :key="t"
                            @click="targetFilter = t; selected = 0; targetMenuOpen = false;"
                            class="type-label-lg"
                            :style="{
                                display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                border: 'none', cursor: 'pointer',
                                backgroundColor: targetFilter === t ? 'var(--color-primary)' : 'transparent',
                                color: targetFilter === t ? '#ffffff' : 'inherit',
                            }"
                        >{{ t === 'all' ? 'All Projects' : TARGET_LABELS_[t] }}</button>
                    </div>
                    </transition>
                    <div v-if="targetMenuOpen" @click="targetMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                </div>

                <div style="position: relative; margin-top: 0.6rem;">
                    <button
                        type="button"
                        class="list-tab"
                        @click="statusMenuOpen = !statusMenuOpen"
                        style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 0.65rem 0.9rem;"
                    >
                        <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ STATUS_LABELS_[statusFilter] }}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: statusMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                            <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </button>
                    <transition name="dropdown-fade">
                    <div
                        v-if="statusMenuOpen"
                        style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; overflow: hidden; z-index: 20;"
                    >
                        <button
                            v-for="s in ['all', 'in_work', 'finished']"
                            :key="s"
                            @click="statusFilter = s; selected = 0; statusMenuOpen = false;"
                            class="type-label-lg"
                            :style="{
                                display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                border: 'none', cursor: 'pointer',
                                backgroundColor: statusFilter === s ? 'var(--color-primary)' : 'transparent',
                                color: statusFilter === s ? '#ffffff' : 'inherit',
                            }"
                        >{{ STATUS_LABELS_[s] }}</button>
                    </div>
                    </transition>
                    <div v-if="statusMenuOpen" @click="statusMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                </div>

                <div class="search-filter-bar">
                    <div class="search-input-wrapper">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="7" />
                            <path d="M21 21l-4.3-4.3" />
                        </svg>
                        <input type="text" v-model="searchQuery" placeholder="Search by name...">
                    </div>
                    <button type="button" class="filters-btn" @click="filtersOpen = !filtersOpen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 6h16M7 12h10M10 18h4" />
                        </svg>
                        <span class="type-label-lg">Filters</span>
                        <span v-if="badgeFilter !== 'all'" class="filter-count">1</span>
                    </button>
                </div>

                <transition name="tab-fade">
                <div v-if="filtersOpen" style="margin-top: 0.6rem; padding: 1rem; border-radius: 10px; background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%); max-height: 320px; overflow-y: auto;">
                    <p class="type-label-md" style="opacity: 0.6; margin: 0 0 0.6rem;">Badge</p>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button
                            v-for="b in ['new', 'updated', 'none']"
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

                <router-link v-if="store.user" to="/projects/new" class="suggest-level-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span class="type-label-lg">New Project</span>
                </router-link>

                <router-link
                    v-if="store.user"
                    to="/admin/manage-projects"
                    class="suggest-level-btn"
                    style="background-image: none; background-color: #767676; margin-top: 0.5rem;"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span class="type-label-lg">Manage Projects</span>
                </router-link>

                <div class="list-panel">
                <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; gap: 0.6rem;">
                    <button
                        v-for="(p, i) in filteredProjects"
                        :key="p.id"
                        type="button"
                        @click="selectProject(i)"
                        style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.2rem; width: 100%; box-sizing: border-box; text-align: left; padding: 0.75rem 0.9rem; border-radius: 10px; border: none; cursor: pointer; background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%);"
                        :style="{ outline: selected === i ? '2px solid var(--color-primary)' : 'none', outlineOffset: '-2px' }"
                    >
                        <span class="type-label-lg" style="display: flex; align-items: center; gap: 0.4rem;">
                            {{ p.name }}
                            <span v-if="isNewItem(p.created_at, 'project')" class="new-badge">New</span>
                            <span v-else-if="isNewItem(p.updated_at, 'projectUpdated')" class="updated-badge">Updated</span>
                        </span>
                        <span style="opacity: 0.6; font-size: 0.8rem;">{{ p.host_name }} · {{ TARGET_LABELS_[p.target_list_type] }}{{ p.finished ? ' · Finished' : '' }}</span>
                    </button>
                </transition-group>
                <p v-if="!loadingProjects && filteredProjects.length === 0" style="opacity: 0.5; text-align: center; padding: 1.5rem 1rem;">
                    No projects match your search/filter.
                </p>
                </div>
            </div>

            <!-- ================= ÁLBUM DO PROJETO ================= -->
            <div class="level-container" style="grid-column: span 2;" :class="{ 'mobile-section-active': mobileSection === 1 }">
                <transition name="tab-fade" mode="out-in">
                <div class="level" v-if="project" :key="project.id" style="margin-top: 1.5rem;">
                    <div style="text-align: center;">
                        <h1 style="margin: 0; width: auto;">{{ project.name }} <span v-if="isNewItem(project.created_at, 'project')" class="new-badge" style="vertical-align: middle;">New</span> <span v-else-if="isNewItem(project.updated_at, 'projectUpdated')" class="updated-badge" style="vertical-align: middle;">Updated</span></h1>
                        <p style="opacity: 0.7; margin: 1.25rem 0 0;">
                            Hosted by <strong>{{ project.host_name }}</strong>
                            <span v-if="project.creators && project.creators.length"> · with {{ project.creators.join(', ') }}</span>
                        </p>
                        <p style="opacity: 0.5; font-size: 0.85rem; margin: 0.75rem 0 0;">
                            Destination: {{ TARGET_LABELS_[project.target_list_type] }}
                            <span v-if="project.finished"> · Finished</span>
                        </p>
                    </div>

                    <div v-if="project.description" style="margin-top: 0.75rem; padding: 1rem; border-radius: 10px; background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%); text-align: center;">
                        <p style="margin: 0; opacity: 0.85;">{{ project.description }}</p>
                    </div>

                    <!-- ===== Vídeo principal do projeto (showcase atual / progress report em destaque) ===== -->
                    <div v-if="project.main_video_url || canManage" style="margin-top: 1.25rem; padding: 1rem; border-radius: 10px; background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%); text-align: center;">
                        <p class="type-label-lg" style="margin: 0 0 0.6rem;">Main Video</p>

                        <transition name="tab-fade" mode="out-in">
                            <div v-if="project.main_video_url" key="video" class="video-preview-box">
                                <iframe :src="embed(project.main_video_url)" frameborder="0" allowfullscreen></iframe>
                            </div>
                            <p v-else-if="!editingMainVideo" key="empty" style="opacity: 0.5; font-size: 0.85rem; margin: 0;">No main video set yet.</p>
                        </transition>

                        <template v-if="canManage">
                            <transition name="tab-fade" mode="out-in">
                            <button
                                v-if="!editingMainVideo"
                                key="btn"
                                type="button"
                                @click="editingMainVideo = true; mainVideoDraft = project.main_video_url || '';"
                                style="background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; font-size: 0.8rem; margin-top: 0.6rem;"
                            >{{ project.main_video_url ? 'Change video' : '+ Set main video' }}</button>

                            <div v-else key="form" style="margin-top: 0.6rem; text-align: left;">
                                <input
                                    type="text"
                                    v-model="mainVideoDraft"
                                    placeholder="https://youtu.be/..."
                                    style="width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background); color: var(--color-on-background);"
                                >
                                <transition name="collapse-fade">
                                    <div v-if="getYoutubeIdFromUrl(mainVideoDraft)" class="video-preview-box" style="margin-top: 0.5rem;">
                                        <iframe :src="embed(mainVideoDraft)" frameborder="0" allowfullscreen></iframe>
                                    </div>
                                </transition>
                                <div style="display: flex; gap: 0.5rem; margin-top: 0.6rem; justify-content: center;">
                                    <button type="button" @click="saveMainVideo" class="login-btn" style="width: auto; padding: 0.5rem 1rem; margin: 0;" :disabled="savingMainVideo">
                                        {{ savingMainVideo ? 'Saving...' : 'Save' }}
                                    </button>
                                    <button type="button" @click="editingMainVideo = false" style="background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; font-size: 0.85rem;">Cancel</button>
                                    <button v-if="project.main_video_url" type="button" @click="removeMainVideo" style="background: none; border: none; color: var(--color-error); opacity: 0.8; cursor: pointer; font-size: 0.85rem;">Remove</button>
                                </div>
                            </div>
                            </transition>
                        </template>
                    </div>

                    <button
                        v-if="canManage && !project.finished"
                        type="button"
                        @click="openFinish"
                        style="display: block; margin: 1.25rem auto 0; padding: 0.6rem 1.1rem; border-radius: 8px; border: 1.5px solid var(--color-error); background: none; color: var(--color-error); cursor: pointer; font-weight: 600;"
                    >Finish Project</button>

                    <!-- ===== Gerenciar o projeto (Creators + Visibilidade/Acesso) — só o Host ===== -->
                    <div v-if="canManage" style="margin-top: 1.25rem; padding: 1rem; border-radius: 10px; background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%);">
                        <button
                            type="button"
                            @click="toggleManagePanel"
                            style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; width: 100%; background: none; border: none; cursor: pointer; color: inherit; padding: 0; font: inherit;"
                        >
                            <p class="type-label-lg" style="margin: 0;">Manage Project</p>
                            <svg width="14" height="14" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: manageOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </button>

                        <transition name="collapse-fade">
                        <div v-if="manageOpen" style="margin-top: 1rem; text-align: center;">
                            <transition name="alert-fade"><div v-if="manageError" class="login-alert login-alert-error" style="margin: 0 0 0.6rem;">{{ manageError }}</div></transition>

                            <label>Creators</label>
                            <transition-group name="creator-row-fade" tag="div" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
                                <div v-for="(c, i) in editCreators" :key="c.id" style="display: flex; gap: 0.5rem; align-items: center;">
                                    <input type="text" :value="c.name" readonly @click="openManagePicker('creators', i)" style="flex: 1; box-sizing: border-box; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background); color: var(--color-on-background); cursor: pointer;">
                                    <button type="button" @click="editCreators.splice(i, 1)" class="creator-slot-btn" aria-label="Remove creator">−</button>
                                </div>
                                <button key="add-manage-creator-btn" type="button" @click="openManagePicker('creators', editCreators.length)" class="creator-add-btn">+ Add creator</button>
                            </transition-group>

                            <label style="display: block; margin-top: 1.25rem;">Visibility</label>
                            <div style="display: flex; gap: 0.4rem; margin-top: 0.4rem; flex-wrap: wrap; justify-content: center;">
                                <button
                                    v-for="v in ['public', 'private', 'restricted']"
                                    :key="v"
                                    type="button"
                                    @click="editVisibility = v"
                                    :style="{
                                        fontSize: '0.8rem', padding: '0.4rem 0.85rem', borderRadius: '999px', cursor: 'pointer',
                                        border: '1px solid var(--card-border)',
                                        backgroundColor: editVisibility === v ? 'var(--color-primary)' : 'transparent',
                                        color: editVisibility === v ? 'white' : 'inherit',
                                    }"
                                >{{ v }}</button>
                            </div>
                            <p style="opacity: 0.5; font-size: 0.8rem; margin: 0.4rem 0 0;">
                                {{ editVisibility === 'public' ? 'Anyone can see this project.'
                                    : editVisibility === 'private' ? 'Only you, the creators, and staff can see it.'
                                    : 'Only you, the creators, staff, and the players you pick below can see it.' }}
                            </p>

                            <transition name="collapse-fade">
                            <div v-if="editVisibility === 'restricted'" style="margin-top: 1rem;">
                                <label>Who else can see it</label>
                                <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">Host and creators already have access — no need to add them here.</p>
                                <transition-group name="creator-row-fade" tag="div" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
                                    <div v-for="(n, i) in editAccessNames" :key="n.id" style="display: flex; gap: 0.5rem; align-items: center;">
                                        <input type="text" :value="n.name" readonly @click="openManagePicker('accessNames', i)" style="flex: 1; box-sizing: border-box; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background); color: var(--color-on-background); cursor: pointer;">
                                        <button type="button" @click="editAccessNames.splice(i, 1)" class="creator-slot-btn" aria-label="Remove access">−</button>
                                    </div>
                                    <button key="add-access-btn" type="button" @click="openManagePicker('accessNames', editAccessNames.length)" class="creator-add-btn">+ Add player</button>
                                </transition-group>
                            </div>
                            </transition>

                            <button
                                type="button"
                                @click="saveManage"
                                class="login-btn"
                                style="width: auto; padding: 0.55rem 1.1rem; margin: 1rem 0 0;"
                                :disabled="savingManage"
                            >{{ savingManage ? 'Saving...' : 'Save changes' }}</button>
                        </div>
                        </transition>
                    </div>

                    <!-- ===== Postar / editar um progress report (só Host e Creators, projeto não finalizado) ===== -->
                    <div v-if="canPost" style="margin-top: 1.25rem; padding: 1rem; border-radius: 10px; background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%);">
                        <p class="type-label-lg" style="margin: 0 0 0.6rem;">{{ editingUpdateId ? 'Edit report' : 'Post a progress report' }}</p>

                        <transition name="alert-fade"><div v-if="updateError" class="login-alert login-alert-error" style="margin: 0 0 0.6rem;">{{ updateError }}</div></transition>

                        <textarea
                            v-model="newUpdateText"
                            rows="3"
                            placeholder="What did you work on?"
                            style="width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background); color: var(--color-on-background); font: inherit; resize: vertical;"
                        ></textarea>

                        <!-- Vídeos do YouTube (múltiplos, cada um com um tamanho de exibição) -->
                        <transition-group name="creator-row-fade" tag="div" style="margin-top: 0.6rem; display: flex; flex-direction: column; gap: 0.6rem; position: relative;">
                            <div v-for="v in newUpdateVideos" :key="v.id" style="text-align: left;">
                                <div style="display: flex; gap: 0.5rem; align-items: center;">
                                    <input
                                        type="text"
                                        v-model="v.url"
                                        placeholder="YouTube link"
                                        style="flex: 1; box-sizing: border-box; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background); color: var(--color-on-background);"
                                    >
                                    <button type="button" @click="removeVideoField(v.id)" class="creator-slot-btn" aria-label="Remove video">−</button>
                                </div>
                                <transition name="collapse-fade">
                                    <div v-if="getYoutubeIdFromUrl(v.url)">
                                        <div class="video-preview-box" :style="{ width: VIDEO_SIZE_CSS_[v.size], margin: '0.5rem auto 0' }">
                                            <iframe :src="embed(v.url)" frameborder="0" allowfullscreen></iframe>
                                        </div>
                                        <div style="display: flex; gap: 0.35rem; margin-top: 0.4rem;">
                                            <button
                                                v-for="s in VIDEO_SIZE_OPTIONS_"
                                                :key="s"
                                                type="button"
                                                @click="v.size = s"
                                                :style="{
                                                    fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderRadius: '999px', cursor: 'pointer',
                                                    border: '1px solid var(--card-border)',
                                                    backgroundColor: v.size === s ? 'var(--color-primary)' : 'transparent',
                                                    color: v.size === s ? 'white' : 'inherit',
                                                }"
                                            >{{ s }}</button>
                                        </div>
                                    </div>
                                </transition>
                            </div>
                            <button key="add-video-btn" type="button" @click="addVideoField" class="creator-add-btn">+ Add YouTube link</button>
                        </transition-group>

                        <!-- Imagens (recortadas com o cropper, cada uma com um tamanho de exibição) -->
                        <div style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.75rem; margin-top: 0.75rem; justify-content: center;">
                            <div v-for="img in pendingImages" :key="img.id" style="text-align: center;">
                                <div :style="{ position: 'relative', display: 'inline-block', width: IMAGE_SIZE_CSS_[img.size], lineHeight: 0 }">
                                    <img :src="img.url" style="width: 100%; height: auto; border-radius: 8px; display: block;">
                                    <button
                                        type="button"
                                        @click="removeImage(img.id)"
                                        style="position: absolute; top: -6px; right: -6px; width: 1.4rem; height: 1.4rem; border-radius: 50%; border: none; background-color: var(--color-error); color: white; cursor: pointer; font-size: 0.85rem; line-height: 1;"
                                    >×</button>
                                </div>
                                <div style="display: flex; gap: 0.35rem; margin-top: 0.4rem; justify-content: center;">
                                    <button
                                        v-for="s in IMAGE_SIZE_OPTIONS_"
                                        :key="s"
                                        type="button"
                                        @click="img.size = s"
                                        :style="{
                                            fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderRadius: '999px', cursor: 'pointer',
                                            border: '1px solid var(--card-border)',
                                            backgroundColor: img.size === s ? 'var(--color-primary)' : 'transparent',
                                            color: img.size === s ? 'white' : 'inherit',
                                        }"
                                    >{{ s }}</button>
                                </div>
                            </div>
                            <label
                                style="width: 80px; height: 80px; border-radius: 8px; border: 1.5px dashed var(--card-border); display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0.7; font-size: 0.75rem; text-align: center;"
                            >
                                {{ uploadingImage ? '...' : '+ Image' }}
                                <input type="file" accept="image/*" multiple @change="handleFileSelect" style="display: none;" :disabled="uploadingImage">
                            </label>
                        </div>

                        <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; justify-content: center;">
                            <button
                                type="button"
                                @click="postUpdate"
                                class="login-btn"
                                style="width: auto; padding: 0.55rem 1.1rem; margin: 0;"
                                :disabled="posting"
                            >{{ posting ? 'Posting...' : (editingUpdateId ? 'Save changes' : 'Post report') }}</button>
                            <button
                                v-if="editingUpdateId"
                                type="button"
                                @click="cancelEdit"
                                style="background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; font-size: 0.85rem;"
                            >Cancel</button>
                        </div>
                    </div>

                    <h2 style="margin-top: 1.5rem;">Progress Reports</h2>

                    <p v-if="updatesLoading" style="opacity: 0.6;">Loading...</p>
                    <p v-else-if="updates.length === 0" style="opacity: 0.5;">Nothing posted yet.</p>

                    <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
                        <div
                            v-for="u in updates"
                            :key="u.id"
                            style="background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%); border-radius: 12px; padding: 1rem;"
                        >
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
                                <span class="type-label-lg">{{ authorNames[u.author_id] || '...' }}</span>
                                <span style="opacity: 0.5; font-size: 0.8rem;">{{ new Date(u.created_at).toLocaleString() }}</span>
                            </div>
                            <div v-if="u.text" style="padding: 0.75rem 0.85rem; border-radius: 8px; border: 1px solid var(--card-border); background-color: var(--color-background-hover);">
                                <p style="margin: 0;">{{ u.text }}</p>
                            </div>
                            <div v-for="(v, idx) in (u.videos || [])" :key="'v' + idx" class="video-preview-box" :style="{ width: VIDEO_SIZE_CSS_[v.size], margin: '0.6rem auto 0' }">
                                <iframe :src="embed(v.url)" frameborder="0" allowfullscreen></iframe>
                            </div>

                            <div v-if="(u.videos || []).length && u.images && u.images.length" style="border-top: 1px solid rgba(255,255,255,0.12); margin: 0.85rem 0;"></div>

                            <div v-if="u.images && u.images.length === 1" style="margin-top: 0.6rem; text-align: center;">
                                <img
                                    :src="u.images[0].url"
                                    @click="openLightbox(u.images, 0)"
                                    :style="{ width: IMAGE_SIZE_CSS_[u.images[0].size], height: 'auto', borderRadius: '8px', display: 'block', margin: '0 auto', cursor: 'pointer' }"
                                >
                            </div>
                            <template v-else-if="u.images && u.images.length > 1">
                                <transition name="tab-fade" mode="out-in">
                                <div v-if="!u.showAllImages" key="album" style="margin-top: 0.6rem; text-align: center;">
                                    <div
                                        :style="{ position: 'relative', display: 'inline-block', width: IMAGE_SIZE_CSS_.small, cursor: 'pointer', lineHeight: 0 }"
                                        @click="openLightbox(u.images, 0)"
                                    >
                                        <img :src="u.images[0].url" style="width: 100%; height: auto; border-radius: 8px; display: block; filter: brightness(0.7);">
                                        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 0.35rem; color: white;">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>
                                            <span class="type-label-lg">+{{ u.images.length - 1 }}</span>
                                        </div>
                                    </div>
                                </div>
                                <div v-else key="all" style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.5rem; margin-top: 0.6rem; justify-content: center;">
                                    <img
                                        v-for="(img, idx) in u.images"
                                        :key="idx"
                                        :src="img.url"
                                        @click="openLightbox(u.images, idx)"
                                        :style="{ width: IMAGE_SIZE_CSS_[img.size], height: 'auto', borderRadius: '8px', display: 'block', cursor: 'pointer', flexShrink: 0 }"
                                    >
                                </div>
                                </transition>
                                <div style="text-align: center; margin-top: 0.5rem;">
                                    <button
                                        type="button"
                                        @click="u.showAllImages = !u.showAllImages"
                                        style="background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; font-size: 0.8rem; text-decoration: underline;"
                                    >{{ u.showAllImages ? 'Show as album' : 'Show all images' }}</button>
                                </div>
                            </template>
                            <div v-if="u.author_id === store.user?.id || canManage || isStaff" style="display: flex; gap: 0.9rem; margin-top: 0.6rem;">
                                <button
                                    v-if="u.author_id === store.user?.id"
                                    type="button"
                                    @click="startEdit(u)"
                                    style="background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; font-size: 0.8rem;"
                                >Edit</button>
                                <button
                                    type="button"
                                    @click="deleteUpdate(u)"
                                    style="background: none; border: none; color: var(--color-error); opacity: 0.8; cursor: pointer; font-size: 0.8rem;"
                                >Delete</button>
                            </div>
                        </div>
                    </transition-group>
                </div>
                <div v-else key="empty" style="height: 100%; display: flex; align-items: center; justify-content: center; opacity: 0.5;">
                    <p>Select a project to see its album.</p>
                </div>
                </transition>
            </div>

            <!-- ================= NAME PICKER POPUP (Manage Project) ================= -->
            <transition name="tab-fade">
            <div v-if="managePicker.field" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="closeManagePicker">
                <div style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Pick a name for {{ managePickerLabel }}</p>
                        <button @click="closeManagePicker" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>

                    <input
                        type="text"
                        v-model="managePicker.search"
                        placeholder="Search..."
                        style="width: 100%; box-sizing: border-box; margin-top: 0.75rem; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background-hover); color: var(--color-on-background);"
                    >

                    <div style="overflow-y: auto; margin-top: 0.75rem; padding-top: 0.2rem; flex: 1;">
                        <p class="type-label-md" style="opacity: 0.6; margin: 0 0 0.4rem;">Static Accounts <span style="opacity: 0.6;">(from level files)</span></p>
                        <p v-if="namesLoading" style="opacity: 0.5; font-size: 0.85rem;">Loading...</p>
                        <button
                            v-for="n in filteredManageStatic"
                            :key="'s-' + n"
                            type="button"
                            @click="selectManageName(n)"
                            style="display: block; width: 100%; text-align: left; padding: 0.4rem 0.5rem; border: none; background: none; color: inherit; cursor: pointer; border-radius: 6px;"
                            onmouseover="this.style.backgroundColor='var(--color-background-hover)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                        >{{ n }}</button>
                        <p v-if="!namesLoading && filteredManageStatic.length === 0" style="opacity: 0.4; font-size: 0.85rem;">No matches.</p>

                        <p class="type-label-md" style="opacity: 0.6; margin: 1rem 0 0.4rem;">Registered Accounts</p>
                        <button
                            v-for="n in filteredManageRegistered"
                            :key="'r-' + n"
                            type="button"
                            @click="selectManageName(n)"
                            style="display: block; width: 100%; text-align: left; padding: 0.4rem 0.5rem; border: none; background: none; color: inherit; cursor: pointer; border-radius: 6px;"
                            onmouseover="this.style.backgroundColor='var(--color-background-hover)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                        >{{ n }}</button>
                        <p v-if="!namesLoading && filteredManageRegistered.length === 0" style="opacity: 0.4; font-size: 0.85rem;">No matches.</p>
                    </div>

                    <div style="border-top: 1px solid var(--card-border); margin-top: 0.75rem; padding-top: 0.75rem;">
                        <label style="font-size: 0.85rem; opacity: 0.7;">Not listed? Add a new name:</label>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem; align-items: stretch;">
                            <input
                                type="text"
                                v-model="managePicker.newName"
                                placeholder="New name"
                                @keyup.enter="confirmManageNewName"
                                style="flex: 1; box-sizing: border-box; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background-hover); color: var(--color-on-background);"
                            >
                            <button
                                type="button"
                                @click="confirmManageNewName"
                                class="nav__cta type-label-lg"
                                style="border: none; border-radius: 8px; cursor: pointer; padding: 0 1rem; white-space: nowrap;"
                            >Add</button>
                        </div>
                    </div>
                </div>
            </div>
            </transition>

            <ImageCropper
                v-if="cropperOpen"
                :image-src="rawImageSrc"
                @cropped="handleCropped"
                @cancel="handleCropperCancel"
            ></ImageCropper>

                        <!-- ================= FINISH PROJECT POPUP ================= -->
            <transition name="tab-fade">
            <div v-if="finishOpen" style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 1rem;" @click.self="closeFinish">
                <div style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 14px; width: 100%; max-width: 480px; max-height: 88vh; overflow-y: auto; padding: 1.5rem;">

                    <template v-if="finishStep === 'confirm'">
                        <p class="type-label-lg" style="margin: 0 0 0.75rem;">Finish "{{ project.name }}"?</p>
                        <p style="opacity: 0.8; margin: 0;">
                            This sends the project to be added to the
                            <strong>{{ project.target_list_type === 'impossible' ? 'Impossible List' : 'Verifications' }}</strong>
                            queue for review. <strong>This can't be undone</strong> — once finished, no more progress reports can be posted here.
                        </p>
                        <div style="display: flex; gap: 0.5rem; margin-top: 1.25rem; justify-content: center;">
                            <button type="button" @click="closeFinish" style="background: none; border: 1px solid var(--card-border); color: inherit; border-radius: 8px; padding: 0.55rem 1.1rem; cursor: pointer;">Cancel</button>
                            <button type="button" @click="finishStep = 'form'" class="login-btn" style="width: auto; padding: 0.55rem 1.1rem; margin: 0; background-color: var(--color-error); background-image: var(--error-gradient);">I understand, continue</button>
                        </div>
                    </template>

                    <template v-else>
                        <p class="type-label-lg" style="margin: 0 0 0.75rem; text-align: center;">Finishing "{{ project.name }}"</p>

                        <transition name="alert-fade"><div v-if="finishError" class="login-alert login-alert-error" style="margin: 0 0 0.6rem;">{{ finishError }}</div></transition>

                        <div style="text-align: center;">
                            <label>Path</label>
                            <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">file slug, must be unique</p>
                            <input type="text" v-model="finishPath" @input="finishPathTouched = true" style="width: 100%; box-sizing: border-box; margin-top: 0.4rem; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background-hover); color: var(--color-on-background);">

                            <div v-if="project.target_list_type === 'impossible'" style="margin-top: 1rem;">
                                <label>Level ID</label>
                                <input type="number" v-model="finishLevelId" required style="width: 100%; box-sizing: border-box; margin-top: 0.4rem; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background-hover); color: var(--color-on-background);">
                            </div>

                            <div v-else style="margin-top: 1rem;">
                                <label>Verifier</label>
                                <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">Who will verify this level.</p>
                                <input type="text" v-model="finishVerifier" style="width: 100%; box-sizing: border-box; margin-top: 0.4rem; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background-hover); color: var(--color-on-background);">
                            </div>

                            <div style="margin-top: 1rem;">
                                <label>{{ project.target_list_type === 'impossible' ? 'Showcase Video Link' : 'Showcase Video Link (optional)' }}</label>
                                <input type="text" v-model="finishLink" placeholder="https://youtu.be/..." style="width: 100%; box-sizing: border-box; margin-top: 0.4rem; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background-hover); color: var(--color-on-background);">
                                <transition name="collapse-fade">
                                    <div v-if="getYoutubeIdFromUrl(finishLink)" class="video-preview-box" style="margin-top: 0.5rem;">
                                        <iframe :src="embed(finishLink)" frameborder="0" allowfullscreen></iframe>
                                    </div>
                                </transition>
                            </div>

                            <div v-if="project.target_list_type !== 'impossible'" style="margin-top: 1rem;">
                                <label>% To Qualify</label>
                                <input type="number" v-model.number="finishPercent" min="1" max="100" style="width: 100%; box-sizing: border-box; margin-top: 0.4rem; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background-hover); color: var(--color-on-background);">
                            </div>

                            <div style="margin-top: 1rem;">
                                <label>Password</label>
                                <input type="text" v-model="finishPassword" style="width: 100%; box-sizing: border-box; margin-top: 0.4rem; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background-hover); color: var(--color-on-background);">
                            </div>

                            <div style="margin-top: 1rem;">
                                <label>Notes for the reviewer (optional)</label>
                                <textarea v-model="finishNotes" rows="3" style="width: 100%; box-sizing: border-box; margin-top: 0.4rem; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background-hover); color: var(--color-on-background); font: inherit; resize: vertical;"></textarea>
                            </div>
                        </div>

                        <div style="display: flex; gap: 0.5rem; margin-top: 1.25rem; justify-content: center;">
                            <button type="button" @click="closeFinish" style="background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer;">Cancel</button>
                            <button type="button" @click="submitFinish" class="login-btn" style="width: auto; padding: 0.6rem 1.25rem; margin: 0;" :disabled="finishSubmitting">
                                {{ finishSubmitting ? 'Sending...' : 'Send to review' }}
                            </button>
                        </div>
                    </template>
                </div>
            </div>
            </transition>

            <!-- ================= LIGHTBOX DE IMAGENS (álbum de um report) ================= -->
            <transition name="tab-fade">
            <div
                v-if="lightboxOpen"
                style="position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 3000; padding: 1rem;"
                @click.self="closeLightbox"
            >
                <button
                    @click="closeLightbox"
                    style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: white; font-size: 1.8rem; cursor: pointer; opacity: 0.8; line-height: 1;"
                >×</button>

                <button
                    v-if="lightboxImages.length > 1"
                    @click.stop="lightboxPrev"
                    style="position: absolute; left: 0.5rem; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.4); border: none; color: white; width: 2.6rem; height: 2.6rem; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>

                <img
                    v-if="lightboxImages[lightboxIndex]"
                    :src="lightboxImages[lightboxIndex].url"
                    style="max-width: 100%; max-height: 85vh; object-fit: contain; border-radius: 8px;"
                    @click.stop
                >

                <button
                    v-if="lightboxImages.length > 1"
                    @click.stop="lightboxNext"
                    style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.4); border: none; color: white; width: 2.6rem; height: 2.6rem; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>

                <span
                    v-if="lightboxImages.length > 1"
                    style="position: absolute; bottom: 1rem; left: 50%; transform: translateX(-50%); color: white; opacity: 0.7; font-size: 0.85rem;"
                >{{ lightboxIndex + 1 }} / {{ lightboxImages.length }}</span>
            </div>
            </transition>
        </main>
        </transition>
    `,
    data: () => ({
        store,
        loading: true,
        loadingProjects: true,
        projects: [],

        selected: 0,
        targetFilter: "all",
        targetMenuOpen: false,
        statusFilter: "all",
        statusMenuOpen: false,
        searchQuery: "",
        filtersOpen: false,
        badgeFilter: "all", // "all", "new", "updated", "none"
        BADGE_FILTER_LABELS_: BADGE_FILTER_LABELS,

        mobileSection: 0,
        carouselDir: "fwd",

        updates: [],
        updatesLoading: false,
        authorNames: {},

        newUpdateText: "",
        newUpdateVideos: [],
        videoIdSeed: 1,
        pendingImages: [],
        imageIdSeed: 1,
        uploadingImage: false,
        posting: false,
        editingUpdateId: null,
        updateError: null,

        cropperOpen: false,
        rawImageSrc: null,
        fileQueue: [],

        editingMainVideo: false,
        mainVideoDraft: "",
        savingMainVideo: false,

        lightboxOpen: false,
        lightboxImages: [],
        lightboxIndex: 0,

        manageOpen: false,
        manageError: null,
        savingManage: false,
        editCreators: [],
        editVisibility: "public",
        editAccessNames: [],
        manageIdSeed: 1,

        staticNames: [],
        registeredNames: [],
        namesLoading: false,
        managePicker: {
            field: null, // 'creators' | 'accessNames' | null
            index: null,
            search: "",
            newName: "",
        },

        finishOpen: false,
        finishStep: "confirm", // 'confirm' | 'form'
        finishPath: "",
        finishPathTouched: false,
        finishLevelId: "",
        finishVerifier: "",
        finishLink: "",
        finishPercent: 100,
        finishPassword: "Copyable",
        finishNotes: "",
        finishSubmitting: false,
        finishError: null,
    }),
    created() {
        this.TARGET_LABELS_ = TARGET_LABELS;
        this.STATUS_LABELS_ = STATUS_LABELS;
        this.IMAGE_SIZE_CSS_ = IMAGE_SIZE_CSS;
        this.VIDEO_SIZE_CSS_ = VIDEO_SIZE_CSS;
        this.IMAGE_SIZE_OPTIONS_ = IMAGE_SIZE_OPTIONS;
        this.VIDEO_SIZE_OPTIONS_ = VIDEO_SIZE_OPTIONS;
        this.embed = embed;
        this.getYoutubeIdFromUrl = getYoutubeIdFromUrl;
    },
    async mounted() {
        await this.loadProjects();
        this.loading = false;
        if (this.project) await this.loadUpdates(this.project.id);

        window.addEventListener("keydown", this.onLightboxKeydown);
    },
    beforeUnmount() {
        window.removeEventListener("keydown", this.onLightboxKeydown);
    },
    computed: {
        filteredProjects() {
            let list = this.projects;
            if (this.targetFilter !== "all") {
                list = list.filter((p) => p.target_list_type === this.targetFilter);
            }
            if (this.statusFilter !== "all") {
                list = list.filter((p) => (this.statusFilter === "finished" ? p.finished : !p.finished));
            }
            const q = this.searchQuery.trim().toLowerCase();
            if (q) {
                list = list.filter((p) => p.name.toLowerCase().includes(q));
            }
            if (this.badgeFilter !== "all") {
                list = list.filter((p) => {
                    const hasNew = this.isNewItem(p.created_at, "project");
                    const hasUpdated = this.isNewItem(p.updated_at, "projectUpdated");
                    return matchesBadgeFilter(this.badgeFilter, hasNew, hasUpdated);
                });
            }
            return list;
        },
        project() {
            return this.filteredProjects[this.selected] || null;
        },
        isStaff() {
            return store.profile && (store.profile.role === "mod" || store.profile.role === "admin");
        },
        canManage() {
            if (!this.project || !store.profile) return false;
            const myName = store.profile.list_name || store.profile.username;
            return !!myName && myName === this.project.host_name;
        },
        isCreator() {
            if (!this.project || !store.profile) return false;
            const myName = store.profile.list_name || store.profile.username;
            return !!myName && (this.project.creators || []).includes(myName);
        },
        canPost() {
            return this.project && !this.project.finished && (this.canManage || this.isCreator);
        },
        managePickerLabel() {
            const labels = { creators: "Creators", accessNames: "Access" };
            return labels[this.managePicker.field] || "";
        },
        // Exclui o Host e os Creators já escolhidos (eles já têm acesso de qualquer jeito)
        managePickerExcluded() {
            const names = new Set([this.project?.host_name].filter(Boolean));
            this.editCreators.forEach((c) => c.name && names.add(c.name));
            return names;
        },
        filteredManageStatic() {
            const q = this.managePicker.search.trim().toLowerCase();
            let list = this.staticNames;
            if (this.managePicker.field === "accessNames") {
                list = list.filter((n) => !this.managePickerExcluded.has(n));
            }
            if (q) list = list.filter((n) => n.toLowerCase().includes(q));
            return list.slice(0, 100);
        },
        filteredManageRegistered() {
            const q = this.managePicker.search.trim().toLowerCase();
            let list = this.registeredNames;
            if (this.managePicker.field === "accessNames") {
                list = list.filter((n) => !this.managePickerExcluded.has(n));
            }
            if (q) list = list.filter((n) => n.toLowerCase().includes(q));
            return list.slice(0, 100);
        },
    },
    watch: {
        async project(newProject, oldProject) {
            if (!newProject || newProject.id === oldProject?.id) return;
            this.resetUpdateForm();
            this.editingMainVideo = false;
            this.mainVideoDraft = "";
            this.manageOpen = false;
            this.manageError = null;
            await this.loadUpdates(newProject.id);
        },
    },
    methods: {
        setBadgeFilter(value) {
            this.badgeFilter = this.badgeFilter === value ? "all" : value;
        },
        isNewItem(dateString, category) {
            return isNew(dateString, NEW_BADGE_DAYS[category]);
        },
        async loadProjects() {
            this.loadingProjects = true;
            const { data, error } = await supabase
                .from("projects")
                .select("*")
                .eq("status", "approved")
                .order("created_at", { ascending: false });

            if (!error) {
                this.projects = data || [];
            }
            this.loadingProjects = false;
        },
        selectProject(i) {
            this.selected = i;
            this.mobileSection = 1;
        },
        async loadUpdates(projectId) {
            this.updatesLoading = true;
            this.updates = [];

            const { data, error } = await supabase
                .from("project_updates")
                .select("*")
                .eq("project_id", projectId)
                .order("created_at", { ascending: false });

            if (!error && data) {
                this.updates = data.map((u) => ({ ...u, showAllImages: false }));

                const userIds = [...new Set(data.map((u) => u.author_id))];
                const missing = userIds.filter((id) => !this.authorNames[id]);
                if (missing.length > 0) {
                    const { data: profiles } = await supabase
                        .from("profiles")
                        .select("id, username, list_name")
                        .in("id", missing);

                    (profiles || []).forEach((p) => {
                        this.authorNames[p.id] = p.list_name || p.username;
                    });
                }
            }
            this.updatesLoading = false;
        },

        handleFileSelect(event) {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (files.length === 0) return;

            this.fileQueue.push(...files);
            if (!this.cropperOpen) this.processNextFile();
        },

        processNextFile() {
            if (this.fileQueue.length === 0) return;
            const file = this.fileQueue.shift();
            const reader = new FileReader();
            reader.onload = () => {
                this.rawImageSrc = reader.result;
                this.cropperOpen = true;
            };
            reader.readAsDataURL(file);
        },

        async handleCropped(blob) {
            this.cropperOpen = false;
            this.rawImageSrc = null;
            this.uploadingImage = true;

            try {
                const filePath = `${this.project.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

                const { error: uploadError } = await supabase.storage
                    .from("project-images")
                    .upload(filePath, blob, { contentType: "image/png" });

                if (uploadError) {
                    this.updateError = "Failed to upload an image. Try again.";
                } else {
                    const { data: publicUrlData } = supabase.storage
                        .from("project-images")
                        .getPublicUrl(filePath);

                    this.pendingImages.push({ id: this.imageIdSeed++, url: publicUrlData.publicUrl, size: "medium" });
                }
            } catch (err) {
                console.error("Image upload error:", err);
                this.updateError = "Something went wrong uploading an image.";
            }

            this.uploadingImage = false;
            this.processNextFile();
        },

        handleCropperCancel() {
            this.cropperOpen = false;
            this.rawImageSrc = null;
            this.processNextFile();
        },

        removeImage(id) {
            this.pendingImages = this.pendingImages.filter((img) => img.id !== id);
        },

        addVideoField() {
            this.newUpdateVideos.push({ id: this.videoIdSeed++, url: "", size: "medium" });
        },

        removeVideoField(id) {
            this.newUpdateVideos = this.newUpdateVideos.filter((v) => v.id !== id);
        },

        resetUpdateForm() {
            this.newUpdateText = "";
            this.newUpdateVideos = [];
            this.pendingImages = [];
            this.editingUpdateId = null;
            this.updateError = null;
            this.fileQueue = [];
            this.cropperOpen = false;
            this.rawImageSrc = null;
        },

        startEdit(u) {
            this.editingUpdateId = u.id;
            this.newUpdateText = u.text || "";
            this.newUpdateVideos = (u.videos || []).map((v) => ({ id: this.videoIdSeed++, url: v.url, size: v.size || "medium" }));
            this.pendingImages = (u.images || []).map((img) => ({ id: this.imageIdSeed++, url: img.url, size: img.size || "medium" }));
            this.updateError = null;
        },

        cancelEdit() {
            this.resetUpdateForm();
        },

        async postUpdate() {
            this.updateError = null;

            const videos = this.newUpdateVideos
                .filter((v) => v.url.trim())
                .map((v) => ({ url: v.url.trim(), size: v.size }));
            const images = this.pendingImages.map((img) => ({ url: img.url, size: img.size }));

            if (!this.newUpdateText.trim() && videos.length === 0 && images.length === 0) {
                this.updateError = "Add some text, a video link, or an image before posting.";
                return;
            }

            this.posting = true;
            try {
                const payload = {
                    text: this.newUpdateText.trim() || null,
                    videos,
                    images,
                };

                if (this.editingUpdateId) {
                    const { error } = await supabase
                        .from("project_updates")
                        .update(payload)
                        .eq("id", this.editingUpdateId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase
                        .from("project_updates")
                        .insert({ ...payload, project_id: this.project.id, author_id: store.user.id });
                    if (error) throw error;
                }

                this.resetUpdateForm();
                await this.loadUpdates(this.project.id);
            } catch (err) {
                this.updateError = err.message || "Something went wrong posting this report.";
            } finally {
                this.posting = false;
            }
        },

        async deleteUpdate(u) {
            if (!window.confirm("Delete this progress report? This can't be undone.")) return;

            const { error } = await supabase.from("project_updates").delete().eq("id", u.id);
            if (!error) {
                await this.loadUpdates(this.project.id);
            }
        },

        async saveMainVideo() {
            this.savingMainVideo = true;
            const value = this.mainVideoDraft.trim() || null;

            const { error } = await supabase
                .from("projects")
                .update({ main_video_url: value, updated_at: new Date().toISOString() })
                .eq("id", this.project.id);

            if (!error) {
                this.project.main_video_url = value;
                this.editingMainVideo = false;
            }
            this.savingMainVideo = false;
        },

        async removeMainVideo() {
            if (!window.confirm("Remove the main video?")) return;
            this.mainVideoDraft = "";
            await this.saveMainVideo();
        },

        openLightbox(images, startIndex) {
            this.lightboxImages = images;
            this.lightboxIndex = startIndex;
            this.lightboxOpen = true;
        },
        closeLightbox() {
            this.lightboxOpen = false;
        },
        lightboxPrev() {
            this.lightboxIndex = (this.lightboxIndex - 1 + this.lightboxImages.length) % this.lightboxImages.length;
        },
        lightboxNext() {
            this.lightboxIndex = (this.lightboxIndex + 1) % this.lightboxImages.length;
        },
        onLightboxKeydown(e) {
            if (!this.lightboxOpen) return;
            if (e.key === "Escape") this.closeLightbox();
            if (e.key === "ArrowLeft") this.lightboxPrev();
            if (e.key === "ArrowRight") this.lightboxNext();
        },

        toggleManagePanel() {
            if (!this.manageOpen) {
                // Carrega uma cópia editável do estado atual do projeto, só quando abre.
                this.editCreators = (this.project.creators || []).map((name) => ({ id: this.manageIdSeed++, name }));
                this.editVisibility = this.project.visibility || "public";
                this.editAccessNames = (this.project.access_names || []).map((name) => ({ id: this.manageIdSeed++, name }));
                this.manageError = null;
            }
            this.manageOpen = !this.manageOpen;
        },

        async loadAllNames() {
            if (this.staticNames.length > 0 || this.registeredNames.length > 0) return;
            this.namesLoading = true;
            try {
                const registeredSet = new Set();
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("username, list_name");
                (profiles || []).forEach((p) => {
                    const name = p.list_name || p.username;
                    if (name) registeredSet.add(name);
                });

                const staticSet = new Set();
                const allLists = await Promise.all(
                    Object.values(LIST_FETCHERS).map((fetcher) => fetcher()),
                );
                allLists.forEach((result) => {
                    (result || []).forEach(([level]) => {
                        if (!level) return;
                        if (level.author) staticSet.add(level.author);
                        (level.creators || []).forEach((c) => staticSet.add(c));
                        if (level.verifier) staticSet.add(level.verifier);
                        (level.records || []).forEach((r) => {
                            if (r.user) staticSet.add(r.user);
                        });
                    });
                });
                registeredSet.forEach((n) => staticSet.delete(n));

                this.registeredNames = Array.from(registeredSet).sort((a, b) => a.localeCompare(b));
                this.staticNames = Array.from(staticSet).sort((a, b) => a.localeCompare(b));
            } finally {
                this.namesLoading = false;
            }
        },

        openManagePicker(field, index = null) {
            this.managePicker.field = field;
            this.managePicker.index = index;
            this.managePicker.search = "";
            this.managePicker.newName = "";
            this.loadAllNames();
        },
        closeManagePicker() {
            this.managePicker.field = null;
            this.managePicker.index = null;
        },
        selectManageName(name) {
            this.applyManageName(name);
            this.closeManagePicker();
        },
        confirmManageNewName() {
            const name = this.managePicker.newName.trim();
            if (!name) return;
            this.applyManageName(name);
            this.managePicker.newName = "";
            this.closeManagePicker();
        },
        applyManageName(name) {
            const target = this.managePicker.field === "creators" ? this.editCreators : this.editAccessNames;
            const idx = this.managePicker.index;
            if (idx === null || idx === undefined || idx >= target.length) {
                if (!target.some((c) => c.name === name)) {
                    target.push({ id: this.manageIdSeed++, name });
                }
            } else {
                target[idx].name = name;
            }
        },

        async saveManage() {
            this.manageError = null;
            this.savingManage = true;

            try {
                const creators = this.editCreators.map((c) => c.name.trim()).filter(Boolean);
                const accessNames = this.editAccessNames.map((n) => n.name.trim()).filter(Boolean);

                const { error } = await supabase
                    .from("projects")
                    .update({
                        creators,
                        visibility: this.editVisibility,
                        access_names: this.editVisibility === "restricted" ? accessNames : [],
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", this.project.id);

                if (error) throw error;

                this.project.creators = creators;
                this.project.visibility = this.editVisibility;
                this.project.access_names = this.editVisibility === "restricted" ? accessNames : [];
                this.manageOpen = false;
            } catch (err) {
                this.manageError = err.message || "Something went wrong saving these changes.";
            } finally {
                this.savingManage = false;
            }
        },

        openFinish() {
            this.finishStep = "confirm";
            this.finishPath = this.project.name.trim().replace(/\s+/g, "_");
            this.finishPathTouched = false;
            this.finishLevelId = "";
            this.finishVerifier = this.project.host_name;
            this.finishLink = "";
            this.finishPercent = 100;
            this.finishPassword = "Copyable";
            this.finishNotes = "";
            this.finishError = null;
            this.finishOpen = true;
        },
        closeFinish() {
            this.finishOpen = false;
        },
        async submitFinish() {
            this.finishError = null;

            const isImpossible = this.project.target_list_type === "impossible";

            if (!this.finishPath.trim()) {
                this.finishError = "Please provide a path.";
                return;
            }
            if (isImpossible && !this.finishLevelId) {
                this.finishError = "Please provide a Level ID.";
                return;
            }
            if (isImpossible && !this.finishLink.trim()) {
                this.finishError = "Please provide a showcase video link.";
                return;
            }
            if (!isImpossible && !this.finishVerifier.trim()) {
                this.finishError = "Please provide a verifier.";
                return;
            }

            this.finishSubmitting = true;
            try {
                const { error: insertError } = await supabase
                    .from("level_suggestions")
                    .insert({
                        user_id: store.user.id,
                        list_type: isImpossible ? "impossible" : "verifications",
                        name: this.project.name,
                        path: this.finishPath.trim(),
                        level_id: isImpossible ? this.finishLevelId : null,
                        author: this.project.host_name,
                        creators: this.project.creators && this.project.creators.length ? this.project.creators : [this.project.host_name],
                        verifier: isImpossible ? null : this.finishVerifier.trim(),
                        verification_status: isImpossible ? null : "set_verifier",
                        category: isImpossible ? null : this.project.target_list_type,
                        verification_link: null,
                        showcase_link: this.finishLink.trim() || null,
                        percent_to_qualify: isImpossible ? null : this.finishPercent,
                        password: this.finishPassword.trim() || "Copyable",
                        suggested_position: null,
                        notes: this.finishNotes.trim() || null,
                    });

                if (insertError) throw insertError;

                const { error: updateError } = await supabase
                    .from("projects")
                    .update({ finished: true, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                    .eq("id", this.project.id);

                if (updateError) throw updateError;

                this.project.finished = true;
                this.finishOpen = false;
            } catch (err) {
                this.finishError = err.message || "Something went wrong finishing this project.";
            } finally {
                this.finishSubmitting = false;
            }
        },
    },
};
