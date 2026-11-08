import { supabase, hasRole } from '../supabase.js';
import { embed, getYoutubeIdFromUrl } from '../util.js';
import { fetchTagGroups, addTagCategory, addTagToCategory } from '../tags.js';
import { NEW_BADGE_DAYS } from '../newBadge.js';
import {
    fetchList,
    fetchPlatformerList,
    fetchChallengeList,
    fetchImpossibleList,
    fetchVerificationsList,
} from '../content.js';

const LIST_LABELS = {
    classic: 'Classic',
    platformer: 'Platformer',
    challenge: 'Challenge',
    impossible: 'Impossible',
    verifications: 'Verifications',
};

const MODE_LABELS = {
    add: 'Add Level',
    edit: 'Edit Level',
    reorder: 'Reorder',
    records: 'Records',
    remove: 'Remove Level',
    move: 'Move List',
};
const MODE_ORDER = ['add', 'edit', 'reorder', 'records', 'remove', 'move'];

const CATEGORY_LABELS = {
    classic: 'Classic',
    platformer: 'Platformer',
    challenge: 'Challenge',
};

const LIST_FETCHERS = {
    classic: fetchList,
    platformer: fetchPlatformerList,
    challenge: fetchChallengeList,
    impossible: fetchImpossibleList,
    verifications: fetchVerificationsList,
};

const DIFFICULTY_LABELS = {
    easy_demon: 'Easy Demon',
    medium_demon: 'Medium Demon',
    hard_demon: 'Hard Demon',
    insane_demon: 'Insane Demon',
    extreme_demon: 'Extreme Demon',
    silent_demon: 'Silent Demon',
};

const DIR_URL_BY_LIST_TYPE = {
    classic: '/data',
    platformer: '/data/platformer',
    challenge: '/data/challenge',
    impossible: '/data/impossible',
    verifications: '/data/verifications',
};

export default {
    props: {
        lockedListType: { type: String, default: null },
    },
    data() {
        return {
        loading: true,
        authorized: false,

        mode: 'add', // 'add' | 'edit' | 'remove'
        modeMenuOpen: false,
        typeMenuOpen: false,
        listType: this.lockedListType || 'classic',

        levels: [],
        levelsLoading: false,
        levelsCache: {},

        staticNames: [],
        registeredNames: [],
        namesLoading: false,

        picker: {
            field: null, // 'author' | 'creators' | 'verifier' | 'edit:author' | 'edit:creators' | 'edit:verifier' | null
            index: null, // índice do creator sendo editado (null = adicionando um novo)
            search: '',
            newName: '',
        },
        creatorIdSeed: 1, // id estável pra cada linha de creator, pra animação de entrada/saída funcionar certo
        recordIdSeed: 1, // idem, pra cada card de record
        boxHeights: { author: 'auto', editAuthor: 'auto', name: 'auto', video: 'auto', difficulty: 'auto', editVideo: 'auto', editDifficulty: 'auto', moveInfo: 'auto', categoryInfo: 'auto', editCategoryInfo: 'auto' },

        // --- campos do modo "Add" ---
        position: 1,
        path: '',
        pathTouched: false,
        pathExpanded: false,
        showcaseExpanded: false,
        editShowcaseExpanded: false,
        moveInfoExpanded: false,
        moveTargetMenuOpen: false,
        categoryMenuOpen: false,
        statusMenuOpen: false,
        categoryInfoExpanded: false,
        passwordInfoExpanded: false,
        editCategoryMenuOpen: false,
        editCategoryInfoExpanded: false,
        editPasswordInfoExpanded: false,
        id: '',
        name: '',
        author: '',
        creators: [],
        verifier: '',
        verification: '',
        showcase: '',
        percentToQualify: 100,
        password: 'Copyable',
        verifierEnjoyment: null,
        difficulty: '', // '' | 'easy_demon' | 'medium_demon' | 'hard_demon' | 'insane_demon' | 'extreme_demon' | 'silent_demon'
        rating: 1, // 1-5
        status: 'open_verification', // 'set_verifier' | 'open_verification' — só usado quando listType === 'verifications'
        category: 'classic', // só usado quando listType === 'verifications'

        // --- campos do modo "Edit" ---
        editPath: '',

        levelPickerOpen: false,
        levelPickerFor: null, // 'edit' | 'reorder' | 'records' | 'remove' | 'move'
        levelPickerSearch: '',
        editLoading: false,
        tagGroups: [],
        newCategoryOpen: false,
        newCategoryLabel: '',
        newTagOpenFor: null, // id da categoria com o campo "+ New Tag" aberto
        newTagName: '',
        tagsError: null,

        editForm: {
            id: '',
            name: '',
            author: '',
            creators: [],
            verifier: '',
            verification: '',
            showcase: '',
            percentToQualify: 100,
            password: '',
            verifierEnjoyment: null,
            difficulty: '',
            rating: 1,
            tags: [],
            resetNewBadge: false,
            newBadgeDays: 14,
        },

        // --- campo do modo "Remove" ---
        removePath: '',
        movePath: '',
        moveTarget: 'platformer',
        movePosition: 1,
        moveTargetLevels: [],
        moveTargetLevelsLoading: false,

        // --- campos do modo "Reorder" ---
        reorderPath: '',
        reorderPosition: 1,

        // --- campos do modo "Records" ---
        recordsPath: '',
        recordsLoading: false,
        recordsList: [],
        recordsSaving: false,

        submitting: false,
        feedback: null,
        };
    },
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 600px; margin: 0 auto;">

                <h1 style="text-align: center;">{{ lockedListType ? 'Manage ' + LIST_LABELS_[lockedListType] : 'Manage Levels' }}</h1>

                <template v-if="loading">
                    <p>Loading...</p>
                </template>

                <template v-else-if="!authorized">
                    <div class="login-alert login-alert-error">
                        You don't have permission to view this page.
                    </div>
                </template>

                <template v-else>
                    <transition name="alert-fade"><div v-if="feedback" :class="['login-alert', feedback.ok ? 'login-alert-success' : 'login-alert-error']">{{ feedback.message }}</div></transition>

                    <div class="add-level-form-card">
                    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem;">
                        <div style="position: relative; flex: 1; min-width: 12rem;">
                            <button
                                type="button"
                                class="list-tab"
                                @click="modeMenuOpen = !modeMenuOpen"
                                style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.5), transparent 60%); border: 1.5px solid var(--form-border-gray); border-radius: 8px; padding: 0.65rem 0.9rem;"
                            >
                                <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ MODE_LABELS_[mode] }}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: modeMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                    <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </button>
                            <transition name="dropdown-fade">
                            <div
                                v-if="modeMenuOpen"
                                style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.5), transparent 60%); border: 1.5px solid var(--form-border-gray); border-radius: 8px; overflow: hidden; z-index: 20;"
                            >
                                <button
                                    type="button"
                                    v-for="m in availableModes"
                                    :key="m"
                                    @click="switchMode(m); modeMenuOpen = false;"
                                    class="type-label-lg"
                                    :style="{
                                        display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                        border: 'none', cursor: 'pointer',
                                        backgroundColor: mode === m ? 'var(--form-border-gray)' : 'transparent',
                                        color: mode === m ? '#ffffff' : 'inherit',
                                    }"
                                >{{ MODE_LABELS_[m] }}</button>
                            </div>
                            </transition>
                            <div v-if="modeMenuOpen" @click="modeMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                        </div>

                        <div v-if="!lockedListType" style="position: relative; flex: 1; min-width: 12rem;">
                            <button
                                type="button"
                                class="list-tab"
                                @click="typeMenuOpen = !typeMenuOpen"
                                style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.5), transparent 60%); border: 1.5px solid var(--form-border-gray); border-radius: 8px; padding: 0.65rem 0.9rem;"
                            >
                                <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ LIST_LABELS_[listType] }}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: typeMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                    <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </button>
                            <transition name="dropdown-fade">
                            <div
                                v-if="typeMenuOpen"
                                style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.5), transparent 60%); border: 1.5px solid var(--form-border-gray); border-radius: 8px; overflow: hidden; z-index: 20;"
                            >
                                <button
                                    type="button"
                                    v-for="type in availableListTypes"
                                    :key="type"
                                    @click="selectListType(type); typeMenuOpen = false;"
                                    class="type-label-lg"
                                    :style="{
                                        display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                        border: 'none', cursor: 'pointer',
                                        backgroundColor: listType === type ? 'var(--form-border-gray)' : 'transparent',
                                        color: listType === type ? '#ffffff' : 'inherit',
                                    }"
                                >{{ LIST_LABELS_[type] }}</button>
                            </div>
                            </transition>
                            <div v-if="typeMenuOpen" @click="typeMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                        </div>
                    </div>

                    <transition name="tab-fade" mode="out-in">
                    <!-- ================= ADD MODE ================= -->
                    <form v-if="mode === 'add'" key="add" @submit.prevent="submitAdd">
                        <div ref="nameBoxAdd" style="margin-top: 1.5rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box; position: relative;" :style="{ height: boxHeights.name, overflow: boxHeights.name === 'auto' ? 'visible' : 'hidden', transition: 'height 0.3s ease' }">
                            <label for="name">Level Name</label><br>
                            <input id="name" type="text" v-model="name" @input="autoFillPath" required :style="inputStyle">

                            <button
                                type="button"
                                @click="togglePath('nameBoxAdd')"
                                style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; width: 100%; background: none; border: none; cursor: pointer; color: inherit; padding: 0; margin-top: 1.25rem; font: inherit;"
                            >
                                <label style="cursor: pointer;">Path</label>
                                <svg width="14" height="14" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: pathExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                    <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </button>
                            <transition name="collapse-fade">
                            <div v-if="pathExpanded" style="box-sizing: border-box;">
                                <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.3rem 0 0;">file slug, must be unique</p>
                                <input
                                    id="path"
                                    type="text"
                                    v-model="path"
                                    @input="pathTouched = true"
                                    :style="inputStyle + ' margin-top: 0.4rem;'"
                                >
                            </div>
                            </transition>
                            <p v-if="!pathExpanded" style="opacity: 0.5; font-size: 0.8rem; margin: 0.3rem 0 0;">{{ path || 'Auto-filled from the level name' }}</p>
                        </div>

                        <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center;" v-if="listType !== 'verifications'">
                            <div style="display: flex; flex-wrap: wrap; gap: 1.25rem;">
                                <div style="flex: 1 1 130px; min-width: 0;">
                                    <label for="id">Level ID</label><br>
                                    <input id="id" type="number" v-model="id" required :style="inputStyle">
                                </div>
                                <div style="flex: 1 1 130px; min-width: 0;">
                                    <label for="position">Position</label><br>
                                    <input id="position" type="number" v-model.number="position" min="1" required :style="inputStyle">
                                </div>
                            </div>

                            <!-- Lista de referência: mostra a lista atual com as posições, só como apoio visual -->
                            <div style="margin-top: 0.85rem; max-height: 180px; overflow-y: auto; border-top: 1px solid var(--form-border-gray); padding-top: 0.6rem; text-align: left;">
                                <p v-if="levelsLoading" style="opacity: 0.6; margin: 0;">Loading current list...</p>
                                <div
                                    v-for="(lvl, i) in levels"
                                    :key="lvl.path"
                                    style="display: flex; gap: 0.5rem; padding: 0.15rem 0; font-size: 0.85rem;"
                                    :style="{ fontWeight: (i + 1) === position ? '700' : '400', color: (i + 1) === position ? 'var(--color-primary)' : 'inherit' }"
                                >
                                    <span style="opacity: 0.6; min-width: 2rem; flex-shrink: 0;">#{{ i + 1 }}</span>
                                    <span style="min-width: 0; overflow-wrap: break-word;">{{ lvl.name }}</span>
                                </div>
                            </div>
                        </div>

                        <div style="margin-top: 1.25rem;" v-if="listType === 'verifications'">
                            <button
                                type="button"
                                @click="animateBoxHeight('categoryInfo', 'categoryInfoBox', () => { categoryInfoExpanded = !categoryInfoExpanded; })"
                                style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; width: 100%; background: none; border: none; cursor: pointer; color: inherit; padding: 0; font: inherit;"
                            >
                                <span style="font-size: 0.8rem; opacity: 0.6;">What is Category?</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: categoryInfoExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                    <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </button>
                            <div ref="categoryInfoBox" :style="{ height: boxHeights.categoryInfo, overflow: boxHeights.categoryInfo === 'auto' ? 'visible' : 'hidden', transition: 'height 0.3s ease', position: 'relative' }">
                                <transition name="collapse-fade">
                                    <p v-if="categoryInfoExpanded" style="opacity: 0.5; font-size: 0.75rem; margin: 0.3rem 0 0;">Which list this joins once fully verified.</p>
                                </transition>
                            </div>

                            <label style="display: block; margin-top: 0.4rem;">Category</label>
                            <div style="position: relative; margin-top: 0.4rem;">
                                <button
                                    type="button"
                                    class="list-tab"
                                    @click="categoryMenuOpen = !categoryMenuOpen"
                                    style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); border: 1.5px solid var(--form-border-gray); border-radius: 8px; padding: 0.65rem 0.9rem;"
                                >
                                    <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ CATEGORY_LABELS_[category] }}</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: categoryMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                        <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </button>
                                <transition name="dropdown-fade">
                                <div
                                    v-if="categoryMenuOpen"
                                    style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); border: 1.5px solid var(--form-border-gray); border-radius: 8px; overflow: hidden; z-index: 20;"
                                >
                                    <button
                                        type="button"
                                        v-for="c in ['classic', 'platformer', 'challenge']"
                                        :key="c"
                                        @click="category = c; categoryMenuOpen = false;"
                                        class="type-label-lg"
                                        :style="{
                                            display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                            border: 'none', cursor: 'pointer',
                                            backgroundColor: category === c ? 'var(--form-border-gray)' : 'transparent',
                                            color: 'inherit',
                                        }"
                                    >{{ CATEGORY_LABELS_[c] }}</button>
                                </div>
                                </transition>
                                <div v-if="categoryMenuOpen" @click="categoryMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                            </div>
                        </div>

                        <div style="margin-top: 1.25rem;" v-if="listType === 'verifications'">
                            <label>Verification Type</label>
                            <div style="position: relative; margin-top: 0.4rem;">
                                <button
                                    type="button"
                                    class="list-tab"
                                    @click="statusMenuOpen = !statusMenuOpen"
                                    style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); border: 1.5px solid var(--form-border-gray); border-radius: 8px; padding: 0.65rem 0.9rem;"
                                >
                                    <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ status === 'set_verifier' ? 'Set Verifier' : 'Open Verification' }}</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: statusMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                        <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </button>
                                <transition name="dropdown-fade">
                                <div
                                    v-if="statusMenuOpen"
                                    style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); border: 1.5px solid var(--form-border-gray); border-radius: 8px; overflow: hidden; z-index: 20;"
                                >
                                    <button
                                        type="button"
                                        v-for="s in ['set_verifier', 'open_verification']"
                                        :key="s"
                                        @click="status = s; statusMenuOpen = false;"
                                        class="type-label-lg"
                                        :style="{
                                            display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                            border: 'none', cursor: 'pointer',
                                            backgroundColor: status === s ? 'var(--form-border-gray)' : 'transparent',
                                            color: 'inherit',
                                        }"
                                    >{{ s === 'set_verifier' ? 'Set Verifier' : 'Open Verification' }}</button>
                                </div>
                                </transition>
                                <div v-if="statusMenuOpen" @click="statusMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                            </div>
                        </div>

                        <div style="margin-top: 1.25rem;" v-if="listType === 'verifications' && status === 'open_verification'">
                            <label for="id">Level ID</label><br>
                            <input id="id" type="number" v-model="id" required :style="inputStyle">
                        </div>

                        <div ref="authorBoxAdd" style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;" :style="{ height: boxHeights.author, overflow: boxHeights.author === 'auto' ? 'visible' : 'hidden', transition: 'height 0.3s ease' }">
                            <label for="author">Author</label><br>
                            <input id="author" type="text" v-model="author" @click="openPicker('author')" readonly required :style="inputStyle + ' cursor: pointer;'">

                            <label style="display: block; margin-top: 1.25rem;">Creators</label>
                            <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">leave empty to just use Author</p>

                            <transition-group name="creator-row-fade" tag="div" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
                                <div v-for="(c, i) in creators" :key="c.id" style="display: flex; gap: 0.5rem; align-items: center;">
                                    <input type="text" :value="c.name" @click="openPicker('creators', i)" readonly :style="inputStyle + ' cursor: pointer; flex: 1; margin-top: 0;'">
                                    <button type="button" @click="animateBoxHeight('author', 'authorBoxAdd', () => creators.splice(i, 1))" class="creator-slot-btn" aria-label="Remove creator">−</button>
                                </div>
                                <button key="add-creator-btn" type="button" @click="openPicker('creators', creators.length)" class="creator-add-btn">+ Add creator</button>
                            </transition-group>

                            <div v-if="listType !== 'impossible' && (listType !== 'verifications' || status === 'set_verifier')" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--form-border-gray);">
                                <label for="verifier">Verifier</label><br>
                                <input id="verifier" type="text" v-model="verifier" @click="openPicker('verifier')" readonly required :style="inputStyle + ' cursor: pointer;'">
                            </div>
                        </div>

                        <div ref="videoBoxAdd" style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box; position: relative;" :style="{ height: boxHeights.video, overflow: boxHeights.video === 'auto' ? 'visible' : 'hidden', transition: 'height 0.3s ease' }">
                            <div v-if="listType !== 'impossible' && listType !== 'verifications'">
                                <label for="verification">Verification Video Link</label><br>
                                <input id="verification" type="text" v-model="verification" required :style="inputStyle">
                                <transition name="collapse-fade">
                                    <div v-if="getYoutubeIdFromUrl(verification)" class="video-preview-box" style="margin-top: 0.5rem;">
                                        <iframe :src="embed(verification)" frameborder="0" allowfullscreen></iframe>
                                    </div>
                                </transition>
                            </div>

                            <!-- Showcase: obrigatório e sempre visível pra Impossible e pro Manage Verifications; opcional e expansível pros demais -->
                            <div v-if="listType === 'impossible' || lockedListType === 'verifications'">
                                <label for="showcase">Showcase Video Link</label><br>
                                <input
                                    id="showcase"
                                    type="text"
                                    v-model="showcase"
                                    placeholder="https://youtu.be/... — shown on the level page (no Verifier yet)"
                                    required
                                    :style="inputStyle"
                                >
                                <transition name="collapse-fade">
                                    <div v-if="getYoutubeIdFromUrl(showcase)" class="video-preview-box" style="margin-top: 0.5rem;">
                                        <iframe :src="embed(showcase)" frameborder="0" allowfullscreen></iframe>
                                    </div>
                                </transition>
                            </div>

                            <div v-else :style="{ marginTop: (listType !== 'verifications') ? '1rem' : '0', paddingTop: (listType !== 'verifications') ? '1rem' : '0', borderTop: (listType !== 'verifications') ? '1px solid var(--form-border-gray)' : 'none' }">
                                <button
                                    type="button"
                                    @click="toggleShowcase('videoBoxAdd')"
                                    style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; width: 100%; background: none; border: none; cursor: pointer; color: inherit; padding: 0; font: inherit;"
                                >
                                    <label style="cursor: pointer;">Showcase Video (optional)</label>
                                    <svg width="14" height="14" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: showcaseExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                        <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </button>
                                <transition name="collapse-fade">
                                    <div v-if="showcaseExpanded">
                                        <input
                                            id="showcase"
                                            type="text"
                                            v-model="showcase"
                                            placeholder="https://youtu.be/... — a trailer/showcase, viewers can toggle to see it"
                                            :style="inputStyle + ' margin-top: 0.4rem;'"
                                        >
                                        <transition name="collapse-fade">
                                            <div v-if="getYoutubeIdFromUrl(showcase)" class="video-preview-box" style="margin-top: 0.5rem;">
                                                <iframe :src="embed(showcase)" frameborder="0" allowfullscreen></iframe>
                                            </div>
                                        </transition>
                                    </div>
                                </transition>
                                <p v-if="!showcaseExpanded" style="opacity: 0.5; font-size: 0.8rem; margin: 0.3rem 0 0;">{{ showcase || 'Not set' }}</p>
                            </div>

                            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--form-border-gray);">
                                <div style="display: flex; flex-wrap: wrap; gap: 1.25rem;" v-if="listType !== 'impossible' && listType !== 'verifications'">
                                    <div style="flex: 1 1 130px; min-width: 0;">
                                        <label for="percentToQualify">% To Qualify</label><br>
                                        <input id="percentToQualify" type="number" v-model.number="percentToQualify" min="1" max="100" required :style="inputStyle">
                                    </div>
                                    <div style="flex: 1 1 130px; min-width: 0;">
                                        <label for="password">Password</label><br>
                                        <input id="password" type="text" v-model="password" :style="inputStyle">
                                    </div>
                                    <div style="flex: 1 1 130px; min-width: 0;">
                                        <label for="verifierEnjoyment">Verifier Enjoyment <span style="opacity: 0.5;">(optional)</span></label><br>
                                        <input id="verifierEnjoyment" type="number" v-model.number="verifierEnjoyment" min="0" max="100" :style="inputStyle">
                                    </div>
                                </div>

                                <div v-else>
                                    <label for="password">Password</label><br>
                                    <input id="password" type="text" v-model="password" :style="inputStyle">
                                    <template v-if="listType === 'verifications'">
                                        <button
                                            type="button"
                                            @click="animateBoxHeight('video', 'videoBoxAdd', () => { passwordInfoExpanded = !passwordInfoExpanded; })"
                                            style="display: flex; align-items: center; justify-content: center; gap: 0.3rem; width: 100%; background: none; border: none; cursor: pointer; color: inherit; padding: 0; margin-top: 0.4rem; font: inherit;"
                                        >
                                            <span style="font-size: 0.75rem; opacity: 0.6;">Why can't players see this yet?</span>
                                            <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: passwordInfoExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                                <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                            </svg>
                                        </button>
                                        <transition name="collapse-fade">
                                            <p v-if="passwordInfoExpanded" style="opacity: 0.45; font-size: 0.75rem; margin: 0.3rem 0 0;">The password will only be shown once this level is verified and added to its respective list.</p>
                                        </transition>
                                    </template>
                                </div>
                            </div>
                        </div>

                        <div ref="difficultyBoxAdd" style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); box-sizing: border-box; text-align: center; position: relative;" :style="{ height: boxHeights.difficulty, overflow: boxHeights.difficulty === 'auto' ? 'visible' : 'hidden', transition: 'height 0.3s ease' }" v-if="listType === 'classic' || listType === 'platformer' || listType === 'challenge'">
                            <label>Difficulty Face <span style="opacity: 0.5;">(optional)</span></label>

                            <div style="display: flex; gap: 1rem; margin-top: 0.6rem; align-items: stretch; justify-content: center; flex-wrap: wrap;">
                                <div style="flex: 1 1 180px; min-width: 0; display: flex; flex-direction: column; gap: 0.6rem;">
                                    <select v-model="difficulty" @change="animateBoxHeight('difficulty', 'difficultyBoxAdd', () => {})" :style="inputStyle + ' margin-top: 0;'">
                                        <option value="">No face</option>
                                        <option v-for="(label, key) in DIFFICULTY_LABELS_" :key="key" :value="key">{{ label }}</option>
                                    </select>
                                    <transition name="collapse-fade">
                                    <select v-if="difficulty" v-model.number="rating" :style="inputStyle + ' margin-top: 0;'">
                                        <option :value="1">Rate</option>
                                        <option :value="2">Featured</option>
                                        <option :value="3">Epic</option>
                                        <option :value="4">Legendary</option>
                                        <option :value="5">Mythic</option>
                                    </select>
                                    </transition>
                                </div>

                                <div style="flex: 0 0 96px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background); min-height: 96px; position: relative;">
                                    <transition name="collapse-fade" mode="out-in">
                                        <img
                                            v-if="difficulty"
                                            key="face"
                                            :src="\`/assets/difficulty/\${difficulty}_\${rating}.png\`"
                                            alt="Difficulty face preview"
                                            style="width: 72px; height: 72px; object-fit: contain;"
                                        >
                                        <span v-else key="empty" style="opacity: 0.4; font-size: 0.7rem; padding: 0 0.4rem;">No face selected</span>
                                    </transition>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            class="nav__cta type-label-lg"
                            :disabled="submitting"
                            style="margin-top: 1.75rem; width: 100%; padding: 0.85rem; border: none; border-radius: 8px; cursor: pointer; background-color: #767676;"
                        >{{ submitting ? 'Adding...' : 'Add Level' }}</button>
                    </form>

                    <!-- ================= EDIT MODE ================= -->
                    <form v-else-if="mode === 'edit'" key="edit" @submit.prevent="submitEdit">
                        <div style="margin-top: 1.5rem;">
                            <label for="editLevel">Level to edit</label><br>
                            <button
                                id="editLevel"
                                type="button"
                                class="list-tab"
                                @click="openGenericLevelPicker('edit')"
                                :style="inputStyle + ' display: flex; align-items: center; cursor: pointer; text-align: left;'"
                            >
                                <span style="flex: 1;">{{ editPath ? levelLabel(editPath) : (levelsLoading ? 'Loading levels...' : 'Select a level') }}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                            </button>
                        </div>

                        <template v-if="editPath">
                            <p v-if="editLoading" style="opacity: 0.6; margin-top: 1rem;">Loading level data...</p>

                            <template v-else>
                                <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;">
                                    <label for="editName">Level Name</label><br>
                                    <input id="editName" type="text" v-model="editForm.name" required :style="inputStyle">

                                    <div v-if="listType !== 'verifications' || editForm.id" style="margin-top: 1.25rem;">
                                        <label for="editId">Level ID{{ listType === 'verifications' ? ' (Open Verification only)' : '' }}</label><br>
                                        <input id="editId" type="number" v-model="editForm.id" :required="listType !== 'verifications'" :style="inputStyle">
                                    </div>
                                </div>

                                <div ref="editAuthorBox" style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;" :style="{ height: boxHeights.editAuthor, overflow: boxHeights.editAuthor === 'auto' ? 'visible' : 'hidden', transition: 'height 0.3s ease' }">
                                    <label for="editAuthor">Author</label><br>
                                    <input id="editAuthor" type="text" v-model="editForm.author" @click="openPicker('edit:author')" readonly required :style="inputStyle + ' cursor: pointer;'">

                                    <label style="display: block; margin-top: 1.25rem;">Creators</label>
                                    <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">leave empty to just use Author</p>

                                    <transition-group name="creator-row-fade" tag="div" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
                                        <div v-for="(c, i) in editForm.creators" :key="c.id" style="display: flex; gap: 0.5rem; align-items: center;">
                                            <input type="text" :value="c.name" @click="openPicker('edit:creators', i)" readonly :style="inputStyle + ' cursor: pointer; flex: 1; margin-top: 0;'">
                                            <button type="button" @click="animateBoxHeight('editAuthor', 'editAuthorBox', () => editForm.creators.splice(i, 1))" class="creator-slot-btn" aria-label="Remove creator">−</button>
                                        </div>
                                        <button key="edit-add-creator-btn" type="button" @click="openPicker('edit:creators', editForm.creators.length)" class="creator-add-btn">+ Add creator</button>
                                    </transition-group>

                                    <div v-if="listType !== 'impossible' && listType !== 'verifications'" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--form-border-gray);">
                                        <label for="editVerifier">Verifier</label><br>
                                        <input id="editVerifier" type="text" v-model="editForm.verifier" @click="openPicker('edit:verifier')" readonly required :style="inputStyle + ' cursor: pointer;'">
                                    </div>
                                </div>

                                <div style="margin-top: 1.25rem;" v-if="listType === 'verifications'">
                                    <button
                                        type="button"
                                        @click="animateBoxHeight('editCategoryInfo', 'editCategoryInfoBox', () => { editCategoryInfoExpanded = !editCategoryInfoExpanded; })"
                                        style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; width: 100%; background: none; border: none; cursor: pointer; color: inherit; padding: 0; font: inherit;"
                                    >
                                        <span style="font-size: 0.8rem; opacity: 0.6;">What is Category?</span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: editCategoryInfoExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                            <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                        </svg>
                                    </button>
                                    <div ref="editCategoryInfoBox" :style="{ height: boxHeights.editCategoryInfo, overflow: boxHeights.editCategoryInfo === 'auto' ? 'visible' : 'hidden', transition: 'height 0.3s ease', position: 'relative' }">
                                        <transition name="collapse-fade">
                                            <p v-if="editCategoryInfoExpanded" style="opacity: 0.5; font-size: 0.75rem; margin: 0.3rem 0 0;">Which list this joins once fully verified.</p>
                                        </transition>
                                    </div>

                                    <label style="display: block; margin-top: 0.4rem;">Category</label>
                                    <div style="position: relative; margin-top: 0.4rem;">
                                        <button
                                            type="button"
                                            class="list-tab"
                                            @click="editCategoryMenuOpen = !editCategoryMenuOpen"
                                            style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); border: 1.5px solid var(--form-border-gray); border-radius: 8px; padding: 0.65rem 0.9rem;"
                                        >
                                            <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ CATEGORY_LABELS_[editForm.category] }}</span>
                                            <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: editCategoryMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                                <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                            </svg>
                                        </button>
                                        <transition name="dropdown-fade">
                                        <div
                                            v-if="editCategoryMenuOpen"
                                            style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); border: 1.5px solid var(--form-border-gray); border-radius: 8px; overflow: hidden; z-index: 20;"
                                        >
                                            <button
                                                type="button"
                                                v-for="c in ['classic', 'platformer', 'challenge']"
                                                :key="c"
                                                @click="editForm.category = c; editCategoryMenuOpen = false;"
                                                class="type-label-lg"
                                                :style="{
                                                    display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                                    border: 'none', cursor: 'pointer',
                                                    backgroundColor: editForm.category === c ? 'var(--form-border-gray)' : 'transparent',
                                                    color: 'inherit',
                                                }"
                                            >{{ CATEGORY_LABELS_[c] }}</button>
                                        </div>
                                        </transition>
                                        <div v-if="editCategoryMenuOpen" @click="editCategoryMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                                    </div>
                                </div>

                                <div ref="editVideoBox" style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box; position: relative;" :style="{ height: boxHeights.editVideo, overflow: boxHeights.editVideo === 'auto' ? 'visible' : 'hidden', transition: 'height 0.3s ease' }">
                                    <div v-if="listType !== 'impossible' && listType !== 'verifications'">
                                        <label for="editVerification">Verification Video Link</label><br>
                                        <input id="editVerification" type="text" v-model="editForm.verification" required :style="inputStyle">
                                        <transition name="collapse-fade">
                                            <div v-if="getYoutubeIdFromUrl(editForm.verification)" class="video-preview-box" style="margin-top: 0.5rem;">
                                                <iframe :src="embed(editForm.verification)" frameborder="0" allowfullscreen></iframe>
                                            </div>
                                        </transition>
                                    </div>

                                    <div v-if="listType === 'impossible' || lockedListType === 'verifications'">
                                        <label for="editShowcase">Showcase Video Link</label><br>
                                        <input id="editShowcase" type="text" v-model="editForm.showcase" required :style="inputStyle">
                                        <transition name="collapse-fade">
                                            <div v-if="getYoutubeIdFromUrl(editForm.showcase)" class="video-preview-box" style="margin-top: 0.5rem;">
                                                <iframe :src="embed(editForm.showcase)" frameborder="0" allowfullscreen></iframe>
                                            </div>
                                        </transition>
                                    </div>

                                    <div v-else :style="{ marginTop: (listType !== 'verifications') ? '1rem' : '0', paddingTop: (listType !== 'verifications') ? '1rem' : '0', borderTop: (listType !== 'verifications') ? '1px solid var(--form-border-gray)' : 'none' }">
                                        <button
                                            type="button"
                                            @click="toggleEditShowcase('editVideoBox')"
                                            style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; width: 100%; background: none; border: none; cursor: pointer; color: inherit; padding: 0; font: inherit;"
                                        >
                                            <label style="cursor: pointer;">Showcase Video (optional)</label>
                                            <svg width="14" height="14" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: editShowcaseExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                                <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                            </svg>
                                        </button>
                                        <transition name="collapse-fade">
                                            <div v-if="editShowcaseExpanded">
                                                <input id="editShowcase" type="text" v-model="editForm.showcase" :style="inputStyle + ' margin-top: 0.4rem;'">
                                                <transition name="collapse-fade">
                                                    <div v-if="getYoutubeIdFromUrl(editForm.showcase)" class="video-preview-box" style="margin-top: 0.5rem;">
                                                        <iframe :src="embed(editForm.showcase)" frameborder="0" allowfullscreen></iframe>
                                                    </div>
                                                </transition>
                                            </div>
                                        </transition>
                                        <p v-if="!editShowcaseExpanded" style="opacity: 0.5; font-size: 0.8rem; margin: 0.3rem 0 0;">{{ editForm.showcase || 'Not set' }}</p>
                                    </div>

                                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--form-border-gray);">
                                        <div style="display: flex; flex-wrap: wrap; gap: 1.25rem;" v-if="listType !== 'impossible' && listType !== 'verifications'">
                                            <div style="flex: 1 1 130px; min-width: 0;">
                                                <label for="editPercent">% To Qualify</label><br>
                                                <input id="editPercent" type="number" v-model.number="editForm.percentToQualify" min="1" max="100" required :style="inputStyle">
                                            </div>
                                            <div style="flex: 1 1 130px; min-width: 0;">
                                                <label for="editPassword">Password</label><br>
                                                <input id="editPassword" type="text" v-model="editForm.password" :style="inputStyle">
                                            </div>
                                            <div style="flex: 1 1 130px; min-width: 0;">
                                                <label for="editVerifierEnjoyment">Verifier Enjoyment <span style="opacity: 0.5;">(optional)</span></label><br>
                                                <input id="editVerifierEnjoyment" type="number" v-model.number="editForm.verifierEnjoyment" min="0" max="100" :style="inputStyle">
                                            </div>
                                        </div>

                                        <div v-else>
                                            <label for="editPassword">Password</label><br>
                                            <input id="editPassword" type="text" v-model="editForm.password" :style="inputStyle">
                                            <template v-if="listType === 'verifications'">
                                                <button
                                                    type="button"
                                                    @click="animateBoxHeight('editVideo', 'editVideoBox', () => { editPasswordInfoExpanded = !editPasswordInfoExpanded; })"
                                                    style="display: flex; align-items: center; justify-content: center; gap: 0.3rem; width: 100%; background: none; border: none; cursor: pointer; color: inherit; padding: 0; margin-top: 0.4rem; font: inherit;"
                                                >
                                                    <span style="font-size: 0.75rem; opacity: 0.6;">Why can't players see this yet?</span>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: editPasswordInfoExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                                        <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                                    </svg>
                                                </button>
                                                <transition name="collapse-fade">
                                                    <p v-if="editPasswordInfoExpanded" style="opacity: 0.45; font-size: 0.75rem; margin: 0.3rem 0 0;">The password will only be shown once this level is verified and added to its respective list.</p>
                                                </transition>
                                            </template>
                                        </div>
                                    </div>
                                </div>

                                <div style="margin-top: 1.25rem;" v-if="listType === 'verifications'">
                                    <label for="editNotes">Notes (optional)</label><br>
                                    <textarea id="editNotes" v-model="editForm.notes" rows="3" :style="inputStyle"></textarea>
                                </div>

                                <div ref="editDifficultyBox" style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); box-sizing: border-box; text-align: center; position: relative;" :style="{ height: boxHeights.editDifficulty, overflow: boxHeights.editDifficulty === 'auto' ? 'visible' : 'hidden', transition: 'height 0.3s ease' }" v-if="listType === 'classic' || listType === 'platformer' || listType === 'challenge'">
                                    <label>Difficulty Face <span style="opacity: 0.5;">(optional)</span></label>

                                    <div style="display: flex; gap: 1rem; margin-top: 0.6rem; align-items: stretch; justify-content: center; flex-wrap: wrap;">
                                        <div style="flex: 1 1 180px; min-width: 0; display: flex; flex-direction: column; gap: 0.6rem;">
                                            <select v-model="editForm.difficulty" @change="animateBoxHeight('editDifficulty', 'editDifficultyBox', () => {})" :style="inputStyle + ' margin-top: 0;'">
                                                <option value="">No face</option>
                                                <option v-for="(label, key) in DIFFICULTY_LABELS_" :key="key" :value="key">{{ label }}</option>
                                            </select>
                                            <transition name="collapse-fade">
                                            <select v-if="editForm.difficulty" v-model.number="editForm.rating" :style="inputStyle + ' margin-top: 0;'">
                                                <option :value="1">Rate</option>
                                                <option :value="2">Featured</option>
                                                <option :value="3">Epic</option>
                                                <option :value="4">Legendary</option>
                                                <option :value="5">Mythic</option>
                                            </select>
                                            </transition>
                                        </div>

                                        <div style="flex: 0 0 96px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background); min-height: 96px; position: relative;">
                                            <transition name="collapse-fade" mode="out-in">
                                                <img
                                                    v-if="editForm.difficulty"
                                                    key="face"
                                                    :src="\`/assets/difficulty/\${editForm.difficulty}_\${editForm.rating}.png\`"
                                                    alt="Difficulty face preview"
                                                    style="width: 72px; height: 72px; object-fit: contain;"
                                                >
                                                <span v-else key="empty" style="opacity: 0.4; font-size: 0.7rem; padding: 0 0.4rem;">No face selected</span>
                                            </transition>
                                        </div>
                                    </div>
                                </div>

                                <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); box-sizing: border-box; text-align: center;">
                                    <label>Tags <span style="opacity: 0.5;">(optional)</span></label>

                                    <transition name="alert-fade"><div v-if="tagsError" class="login-alert login-alert-error" style="margin: 0.6rem 0 0;">{{ tagsError }}</div></transition>

                                    <div v-for="group in tagGroups" :key="group.id" style="margin-top: 0.85rem;">
                                        <p style="opacity: 0.5; font-size: 0.75rem; margin: 0 0 0.4rem; text-transform: uppercase; letter-spacing: 0.03em;">{{ group.label }}</p>
                                        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: center; align-items: center;">
                                            <button
                                                v-for="t in group.tags"
                                                :key="t"
                                                type="button"
                                                @click="toggleEditTag(t)"
                                                :style="{
                                                    fontSize: '0.8rem', padding: '0.4rem 0.85rem', borderRadius: '999px', cursor: 'pointer',
                                                    border: '1px solid var(--card-border)',
                                                    backgroundColor: editForm.tags.includes(t) ? 'var(--color-primary)' : 'transparent',
                                                    color: editForm.tags.includes(t) ? 'white' : 'inherit',
                                                    transform: editForm.tags.includes(t) ? 'scale(1.06)' : 'scale(1)',
                                                    transition: 'background-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
                                                }"
                                            >{{ t }}</button>

                                            <button
                                                v-if="newTagOpenFor !== group.id"
                                                type="button"
                                                @click="newTagOpenFor = group.id; newTagName = '';"
                                                style="font-size: 0.8rem; padding: 0.4rem 0.85rem; border-radius: 999px; cursor: pointer; border: 1.5px dashed var(--form-border-gray); background: none; color: inherit; opacity: 0.7;"
                                            >+ New Tag</button>
                                        </div>
                                        <div v-if="newTagOpenFor === group.id" style="display: flex; gap: 0.4rem; margin-top: 0.5rem; justify-content: center;">
                                            <input
                                                type="text"
                                                v-model="newTagName"
                                                placeholder="Tag name"
                                                @keyup.enter="submitNewTag(group.id)"
                                                style="max-width: 180px; box-sizing: border-box; padding: 0.5rem 0.7rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background); color: var(--color-on-background);"
                                            >
                                            <button type="button" @click="submitNewTag(group.id)" class="creator-add-btn" style="align-self: auto;">Add</button>
                                            <button type="button" @click="newTagOpenFor = null" style="background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; font-size: 0.8rem;">Cancel</button>
                                        </div>
                                    </div>

                                    <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid var(--form-border-gray);">
                                        <button
                                            v-if="!newCategoryOpen"
                                            type="button"
                                            @click="newCategoryOpen = true; newCategoryLabel = '';"
                                            class="creator-add-btn"
                                        >+ New Category</button>
                                        <div v-else style="display: flex; gap: 0.4rem; justify-content: center;">
                                            <input
                                                type="text"
                                                v-model="newCategoryLabel"
                                                placeholder="Category name"
                                                @keyup.enter="submitNewCategory"
                                                style="max-width: 180px; box-sizing: border-box; padding: 0.5rem 0.7rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background); color: var(--color-on-background);"
                                            >
                                            <button type="button" @click="submitNewCategory" class="creator-add-btn" style="align-self: auto;">Add</button>
                                            <button type="button" @click="newCategoryOpen = false" style="background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; font-size: 0.8rem;">Cancel</button>
                                        </div>
                                    </div>
                                </div>

                                <div style="margin-top: 1.5rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover);">
                                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                        <input type="checkbox" v-model="editForm.resetNewBadge">
                                        Mark as "New" again
                                    </label>
                                    <transition name="collapse-fade">
                                    <div v-if="editForm.resetNewBadge" style="margin-top: 0.75rem;">
                                        <label for="newBadgeDays">For how many days (max 14)</label><br>
                                        <input
                                            id="newBadgeDays"
                                            type="number"
                                            v-model.number="editForm.newBadgeDays"
                                            min="1"
                                            max="14"
                                            style="width: 100px; box-sizing: border-box; margin-top: 0.4rem; padding: 0.5rem 0.7rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background); color: var(--color-on-background); text-align: center;"
                                        >
                                    </div>
                                    </transition>
                                </div>

                                <button
                                    type="submit"
                                    class="nav__cta type-label-lg"
                                    :disabled="submitting"
                                    style="margin-top: 1.75rem; width: 100%; padding: 0.85rem; border: none; border-radius: 8px; cursor: pointer; background-color: #767676;"
                                >{{ submitting ? 'Saving...' : 'Save Changes' }}</button>
                            </template>
                        </template>
                    </form>

                    <!-- ================= REORDER MODE ================= -->
                    <form v-else-if="mode === 'reorder'" key="reorder" @submit.prevent="submitReorder">
                        <div style="margin-top: 1.5rem;">
                            <label for="reorderLevel">Level to move</label><br>
                            <button
                                id="reorderLevel"
                                type="button"
                                class="list-tab"
                                @click="openGenericLevelPicker('reorder')"
                                :style="inputStyle + ' display: flex; align-items: center; cursor: pointer; text-align: left;'"
                            >
                                <span style="flex: 1;">{{ reorderPath ? levelLabel(reorderPath) : (levelsLoading ? 'Loading levels...' : 'Select a level') }}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                            </button>
                        </div>

                        <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;">
                            <label for="reorderPosition">New position (rank)</label><br>
                            <input id="reorderPosition" type="number" v-model.number="reorderPosition" min="1" required :style="inputStyle">

                            <!-- Lista de referência: mostra a lista atual, destacando de onde e pra onde a fase vai -->
                            <div style="margin-top: 0.85rem; max-height: 220px; overflow-y: auto; border-top: 1px solid var(--form-border-gray); padding-top: 0.6rem; text-align: left;">
                                <p v-if="levelsLoading" style="opacity: 0.6; margin: 0;">Loading current list...</p>
                                <div
                                    v-for="(lvl, i) in levels"
                                    :key="lvl.path"
                                    style="display: flex; gap: 0.5rem; padding: 0.15rem 0; font-size: 0.85rem;"
                                    :style="{
                                        fontWeight: (lvl.path === reorderPath || (i + 1) === reorderPosition) ? '700' : '400',
                                        color: lvl.path === reorderPath ? 'var(--color-error)' : ((i + 1) === reorderPosition ? 'var(--color-primary)' : 'inherit'),
                                        textDecoration: lvl.path === reorderPath ? 'line-through' : 'none',
                                    }"
                                >
                                    <span style="opacity: 0.6; min-width: 2rem; flex-shrink: 0;">#{{ i + 1 }}</span>
                                    <span style="min-width: 0; overflow-wrap: break-word;">{{ lvl.name }}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            class="nav__cta type-label-lg"
                            :disabled="submitting || !reorderPath"
                            style="margin-top: 1.75rem; width: 100%; padding: 0.85rem; border: none; border-radius: 8px; cursor: pointer; background-color: #767676;"
                        >{{ submitting ? 'Moving...' : 'Move Level' }}</button>
                    </form>

                    <!-- ================= RECORDS MODE ================= -->
                    <form v-else-if="mode === 'records'" key="records" @submit.prevent="saveRecords">
                        <div style="margin-top: 1.5rem;">
                            <label for="recordsLevel">Level</label><br>
                            <button
                                id="recordsLevel"
                                type="button"
                                class="list-tab"
                                @click="openGenericLevelPicker('records')"
                                :style="inputStyle + ' display: flex; align-items: center; cursor: pointer; text-align: left;'"
                            >
                                <span style="flex: 1;">{{ recordsPath ? levelLabel(recordsPath) : (levelsLoading ? 'Loading levels...' : 'Select a level') }}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                            </button>
                        </div>

                        <template v-if="recordsPath">
                            <p v-if="recordsLoading" style="opacity: 0.6; margin-top: 1rem;">Loading records...</p>

                            <template v-else>
                                <p v-if="listType === 'impossible'" style="opacity: 0.6; margin-top: 0.75rem;">
                                    Order matters here — it's used to figure out who set each World Record first. Use the arrows to fix the order if needed.
                                </p>

                                <transition-group name="creator-row-fade" tag="div" style="position: relative;">
                                <div
                                    v-for="(rec, i) in recordsList"
                                    :key="rec.id"
                                    style="margin-top: 1rem; padding: 0.85rem; border: 1.5px solid var(--form-border-gray); border-radius: 8px; background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); position: relative;"
                                >
                                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.6rem;">
                                        <span style="opacity: 0.6; font-size: 0.85rem;">#{{ i + 1 }}</span>
                                        <div style="flex: 1;"></div>
                                        <button type="button" @click="moveRecord(i, -1)" :disabled="i === 0" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; font-size: 1rem;">▲</button>
                                        <button type="button" @click="moveRecord(i, 1)" :disabled="i === recordsList.length - 1" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; font-size: 1rem;">▼</button>
                                        <button type="button" @click="removeRecord(i)" class="record-remove-btn">Remove</button>
                                    </div>

                                    <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                                        <input type="text" v-model="rec.user" placeholder="Player name" :style="inputStyle + ' flex: 2; min-width: 140px; margin-top: 0;'">
                                        <input type="number" v-model.number="rec.percent" placeholder="%" min="1" max="100" :style="inputStyle + ' flex: 1; min-width: 70px; margin-top: 0;'">
                                        <input type="number" v-model.number="rec.hz" placeholder="Hz" min="1" :style="inputStyle + ' flex: 1; min-width: 70px; margin-top: 0;'">
                                    </div>
                                    <input type="text" v-model="rec.link" placeholder="Video link" :style="inputStyle + ' margin-top: 0.6rem;'">
                                    <div style="margin-top: 0.6rem;">
                                        <label style="font-size: 0.8rem; opacity: 0.6;">Date</label><br>
                                        <input type="date" v-model="rec.date" :style="inputStyle + ' margin-top: 0.3rem; max-width: 200px;'">
                                    </div>
                                    <div v-if="rec.percent === 100" style="margin-top: 0.6rem;">
                                        <label style="font-size: 0.8rem; opacity: 0.6;">Enjoyment (0-100)</label><br>
                                        <input type="number" v-model.number="rec.enjoyment" min="0" max="100" :style="inputStyle + ' margin-top: 0.3rem; max-width: 200px;'">
                                    </div>
                                    <transition name="collapse-fade">
                                        <div v-if="getYoutubeIdFromUrl(rec.link)" class="video-preview-box" style="margin-top: 0.6rem;">
                                            <iframe :src="embed(rec.link)" frameborder="0" allowfullscreen></iframe>
                                        </div>
                                    </transition>
                                </div>
                                </transition-group>

                                <button
                                    type="button"
                                    @click="addRecord"
                                    style="margin-top: 1rem; width: 100%; padding: 0.6rem; border: 1.5px dashed var(--form-border-gray); border-radius: 8px; background: none; color: inherit; cursor: pointer;"
                                >+ Add Record</button>

                                <button
                                    type="submit"
                                    class="nav__cta type-label-lg"
                                    :disabled="recordsSaving"
                                    style="margin-top: 1.75rem; width: 100%; padding: 0.85rem; border: none; border-radius: 8px; cursor: pointer; background-color: #767676;"
                                >{{ recordsSaving ? 'Saving...' : 'Save Records' }}</button>
                            </template>
                        </template>
                    </form>

                    <!-- ================= REMOVE MODE ================= -->
                    <form v-else-if="mode === 'remove'" key="remove" @submit.prevent="submitRemove">
                        <div style="margin-top: 1.5rem;">
                            <label for="removeLevel">Level to remove</label><br>
                            <button
                                id="removeLevel"
                                type="button"
                                class="list-tab"
                                @click="openGenericLevelPicker('remove')"
                                :style="inputStyle + ' display: flex; align-items: center; cursor: pointer; text-align: left;'"
                            >
                                <span style="flex: 1;">{{ removePath ? levelLabel(removePath) : (levelsLoading ? 'Loading levels...' : 'Select a level') }}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                            </button>
                        </div>

                        <button
                            type="submit"
                            class="nav__cta type-label-lg"
                            :disabled="submitting || !removePath"
                            style="margin-top: 1.75rem; width: 100%; padding: 0.85rem; border: none; border-radius: 8px; cursor: pointer; background-color: var(--color-error);"
                        >{{ submitting ? 'Removing...' : 'Remove Level' }}</button>
                    </form>

                    <!-- ================= MOVE MODE ================= -->
                    <form v-else-if="mode === 'move'" key="move" @submit.prevent="submitMove">
                        <div ref="moveInfoBox" style="padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); box-sizing: border-box; position: relative;" :style="{ height: boxHeights.moveInfo, overflow: boxHeights.moveInfo === 'auto' ? 'visible' : 'hidden', transition: 'height 0.3s ease' }">
                            <button
                                type="button"
                                @click="animateBoxHeight('moveInfo', 'moveInfoBox', () => { moveInfoExpanded = !moveInfoExpanded; })"
                                style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; width: 100%; background: none; border: none; cursor: pointer; color: inherit; padding: 0; font: inherit;"
                            >
                                <span style="font-size: 0.85rem; opacity: 0.8;">What does Move List do?</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: moveInfoExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                    <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </button>
                            <transition name="collapse-fade">
                                <p v-if="moveInfoExpanded" style="opacity: 0.6; font-size: 0.85rem; margin: 0.6rem 0 0;">
                                    Moving a level takes it out of <strong>{{ LIST_LABELS_[listType] }}</strong> (the list selected above) and puts it into another list — everything about it (records, verifier, video, etc) comes along as-is.
                                </p>
                            </transition>
                        </div>

                        <div style="margin-top: 1.25rem;">
                            <label for="moveLevel">Level to move</label><br>
                            <button
                                id="moveLevel"
                                type="button"
                                class="list-tab"
                                @click="openGenericLevelPicker('move')"
                                :style="inputStyle + ' display: flex; align-items: center; cursor: pointer; text-align: left;'"
                            >
                                <span style="flex: 1;">{{ movePath ? levelLabel(movePath) : (levelsLoading ? 'Loading levels...' : 'Select a level') }}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                            </button>
                        </div>

                        <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;">
                            <label>Move to</label>

                            <div style="position: relative; margin-top: 0.4rem;">
                                <button
                                    type="button"
                                    class="list-tab"
                                    @click="moveTargetMenuOpen = !moveTargetMenuOpen"
                                    style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); border: 1.5px solid var(--form-border-gray); border-radius: 8px; padding: 0.65rem 0.9rem;"
                                >
                                    <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ moveTarget ? LIST_LABELS_[moveTarget] : 'Select a list' }}</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: moveTargetMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                        <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </button>
                                <transition name="dropdown-fade">
                                <div
                                    v-if="moveTargetMenuOpen"
                                    style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); border: 1.5px solid var(--form-border-gray); border-radius: 8px; overflow: hidden; z-index: 20;"
                                >
                                    <button
                                        type="button"
                                        v-for="type in Object.keys(LIST_LABELS_).filter(t => t !== 'verifications' && t !== listType)"
                                        :key="type"
                                        @click="selectMoveTarget(type); moveTargetMenuOpen = false;"
                                        class="type-label-lg"
                                        :style="{
                                            display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                            border: 'none', cursor: 'pointer',
                                            backgroundColor: moveTarget === type ? 'var(--form-border-gray)' : 'transparent',
                                            color: 'inherit',
                                        }"
                                    >{{ LIST_LABELS_[type] }}</button>
                                </div>
                                </transition>
                                <div v-if="moveTargetMenuOpen" @click="moveTargetMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                            </div>

                            <!-- Lista de referência da lista de DESTINO, pra saber onde vai cair -->
                            <div style="margin-top: 0.85rem; max-height: 180px; overflow-y: auto; border-top: 1px solid var(--form-border-gray); padding-top: 0.6rem; text-align: left;">
                                <p v-if="moveTargetLevelsLoading" style="opacity: 0.6; margin: 0;">Loading {{ LIST_LABELS_[moveTarget] }} list...</p>
                                <div
                                    v-for="(lvl, i) in moveTargetLevels"
                                    :key="lvl.path"
                                    style="display: flex; gap: 0.5rem; padding: 0.15rem 0; font-size: 0.85rem;"
                                    :style="{ fontWeight: (i + 1) === movePosition ? '700' : '400', color: (i + 1) === movePosition ? 'var(--color-primary)' : 'inherit' }"
                                >
                                    <span style="opacity: 0.6; min-width: 2rem; flex-shrink: 0;">#{{ i + 1 }}</span>
                                    <span style="min-width: 0; overflow-wrap: break-word;">{{ lvl.name }}</span>
                                </div>
                            </div>

                            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--form-border-gray);">
                                <label for="movePosition">Position on {{ LIST_LABELS_[moveTarget] }}</label><br>
                                <input id="movePosition" type="number" v-model.number="movePosition" min="1" required :style="inputStyle">
                            </div>
                        </div>

                        <button
                            type="submit"
                            class="nav__cta type-label-lg"
                            :disabled="submitting || !movePath"
                            style="margin-top: 1.75rem; width: 100%; padding: 0.85rem; border: none; border-radius: 8px; cursor: pointer; background-color: #767676;"
                        >{{ submitting ? 'Moving...' : 'Move Level' }}</button>
                    </form>
                    </transition>
                    </div>
                </template>
            </div>

            <!-- ================= LEVEL PICKER POPUP (Edit/Reorder/Records/Remove/Move) ================= -->
            <transition name="tab-fade">
            <div v-if="levelPickerOpen" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="levelPickerOpen = false">
                <div style="background-color: var(--color-background); border: 1px solid var(--color-background-hover); border-radius: 12px; width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Select a level</p>
                        <button @click="levelPickerOpen = false" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>

                    <input
                        type="text"
                        v-model="levelPickerSearch"
                        placeholder="Search..."
                        :style="inputStyle + ' margin-top: 0.75rem;'"
                    >

                    <div style="overflow-y: auto; margin-top: 0.75rem; padding-top: 0.2rem; flex: 1;">
                        <p v-if="levelsLoading" style="opacity: 0.5; font-size: 0.85rem;">Loading...</p>
                        <button
                            v-for="lvl in filteredGenericLevels"
                            :key="lvl.path"
                            type="button"
                            @click="selectGenericLevel(lvl)"
                            style="display: flex; gap: 0.5rem; align-items: baseline; width: 100%; text-align: left; padding: 0.5rem 0.6rem; border: none; background: none; color: inherit; cursor: pointer; border-radius: 6px;"
                            onmouseover="this.style.backgroundColor='var(--color-background-hover)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                        ><span style="opacity: 0.5; font-size: 0.8rem; flex-shrink: 0;">#{{ lvl.position }}</span><span>{{ lvl.name }}</span></button>
                        <p v-if="!levelsLoading && filteredGenericLevels.length === 0" style="opacity: 0.4; font-size: 0.85rem;">No matches.</p>
                    </div>
                </div>
            </div>
            </transition>

            <!-- ================= NAME PICKER POPUP ================= -->
            <transition name="tab-fade">
            <div v-if="picker.field" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="closePicker">
                <div style="background-color: var(--color-background); border: 1px solid var(--color-background-hover); border-radius: 12px; width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Pick a name for {{ pickerLabel }}</p>
                        <button @click="closePicker" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>

                    <input
                        type="text"
                        v-model="picker.search"
                        placeholder="Search..."
                        :style="inputStyle + ' margin-top: 0.75rem;'"
                    >

                    <div style="overflow-y: auto; margin-top: 0.75rem; padding-top: 0.2rem; flex: 1;">
                        <p class="type-label-md" style="opacity: 0.6; margin: 0 0 0.4rem;">Static Accounts <span style="opacity: 0.6;">(from level files)</span></p>
                        <p v-if="namesLoading" style="opacity: 0.5; font-size: 0.85rem;">Loading...</p>
                        <button
                            v-for="n in filteredStatic"
                            :key="'s-' + n"
                            @click="selectName(n)"
                            style="display: block; width: 100%; text-align: left; padding: 0.4rem 0.5rem; border: none; background: none; color: inherit; cursor: pointer; border-radius: 6px;"
                            onmouseover="this.style.backgroundColor='var(--color-background-hover)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                        >{{ n }}</button>
                        <p v-if="!namesLoading && filteredStatic.length === 0" style="opacity: 0.4; font-size: 0.85rem;">No matches.</p>

                        <p class="type-label-md" style="opacity: 0.6; margin: 1rem 0 0.4rem;">Registered Accounts</p>
                        <button
                            v-for="n in filteredRegistered"
                            :key="'r-' + n"
                            @click="selectName(n)"
                            style="display: block; width: 100%; text-align: left; padding: 0.4rem 0.5rem; border: none; background: none; color: inherit; cursor: pointer; border-radius: 6px;"
                            onmouseover="this.style.backgroundColor='var(--color-background-hover)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                        >{{ n }}</button>
                        <p v-if="!namesLoading && filteredRegistered.length === 0" style="opacity: 0.4; font-size: 0.85rem;">No matches.</p>
                    </div>

                    <div style="border-top: 1px solid var(--color-background-hover); margin-top: 0.75rem; padding-top: 0.75rem;">
                        <label style="font-size: 0.85rem; opacity: 0.7;">Not listed? Add a new static account name:</label>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem; align-items: stretch;">
                            <input
                                type="text"
                                v-model="picker.newName"
                                placeholder="New name"
                                @keyup.enter="confirmNewName"
                                :style="inputStyle + ' margin-top: 0; flex: 1;'"
                            >
                            <button
                                @click="confirmNewName"
                                class="nav__cta type-label-lg"
                                style="border: none; border-radius: 8px; cursor: pointer; padding: 0 1rem; white-space: nowrap;"
                            >Add</button>
                        </div>
                    </div>
                </div>
            </div>
            </transition>
        </main>
    `,
    computed: {
        filteredGenericLevels() {
            const q = this.levelPickerSearch.trim().toLowerCase();
            const list = this.levels.map((lvl, i) => ({ ...lvl, position: i + 1 }));
            if (!q) return list;
            return list.filter((lvl) => lvl.name.toLowerCase().includes(q));
        },
        // Verifications tem suporte nas abas "Add Level", "Edit Level" e "Remove Level" —
        // Reorder/Records ainda assumem a estrutura de records multi-jogador das outras listas.
        availableListTypes() {
            if (this.lockedListType) return [this.lockedListType];
            return Object.keys(LIST_LABELS).filter((t) => t !== 'verifications' || ['add', 'edit', 'remove'].includes(this.mode));
        },
        availableModes() {
            if (this.lockedListType) return MODE_ORDER.filter((m) => ['add', 'edit', 'remove'].includes(m));
            return MODE_ORDER;
        },
        pickerLabel() {
            return (this.picker.field || '').replace(/^edit:/, '');
        },
        filteredStatic() {
            const q = this.picker.search.trim().toLowerCase();
            const list = q
                ? this.staticNames.filter((n) => n.toLowerCase().includes(q))
                : this.staticNames;
            return list.slice(0, 100);
        },
        filteredRegistered() {
            const q = this.picker.search.trim().toLowerCase();
            const list = q
                ? this.registeredNames.filter((n) => n.toLowerCase().includes(q))
                : this.registeredNames;
            return list.slice(0, 100);
        },
    },
    created() {
        this.LIST_LABELS_ = LIST_LABELS;
        this.MODE_LABELS_ = MODE_LABELS;
        this.CATEGORY_LABELS_ = CATEGORY_LABELS;
        this.DIFFICULTY_LABELS_ = DIFFICULTY_LABELS;
        this.embed = embed;
        this.getYoutubeIdFromUrl = getYoutubeIdFromUrl;
        this.inputStyle = 'width: 100%; padding: 0.65rem 0.85rem; margin-top: 0.4rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); color: var(--color-on-background);';
    },
    async mounted() {
        this.authorized = await hasRole('admin');
        this.loading = false;

        if (this.authorized) {
            await this.loadLevels(this.listType);
            this.loadAllNames();
            await this.loadTagGroups();
        }
    },
    methods: {
        async selectMoveTarget(type) {
            this.moveTarget = type;
            await this.loadMoveTargetLevels();
        },
        async loadMoveTargetLevels() {
            if (this.levelsCache[this.moveTarget]) {
                this.moveTargetLevels = this.levelsCache[this.moveTarget];
                return;
            }
            this.moveTargetLevelsLoading = true;
            try {
                const result = await LIST_FETCHERS[this.moveTarget]();
                const lvls = (result || [])
                    .filter(([level]) => level !== null)
                    .map(([level]) => ({ path: level.path, name: level.name }));
                this.levelsCache[this.moveTarget] = lvls;
                this.moveTargetLevels = lvls;
            } finally {
                this.moveTargetLevelsLoading = false;
            }
        },
        async switchMode(mode) {
            if (this.lockedListType && !['add', 'edit', 'remove'].includes(mode)) return;
            this.mode = mode;
            if (this.listType === 'verifications' && !['add', 'edit', 'remove'].includes(mode)) {
                await this.selectListType('classic');
            }
            if (mode === 'move') {
                if (this.moveTarget === this.listType) {
                    this.moveTarget = Object.keys(LIST_LABELS).find((t) => t !== 'verifications' && t !== this.listType) || '';
                }
                await this.loadMoveTargetLevels();
            }
        },
        async selectListType(type) {
            if (this.lockedListType) return;
            if (this.listType === type) return;
            this.listType = type;
            this.removePath = '';
            this.editPath = '';
            this.reorderPath = '';
            this.recordsPath = '';
            this.movePath = '';
            this.moveTarget = Object.keys(LIST_LABELS).find((t) => t !== 'verifications' && t !== type) || '';
            await this.loadLevels(type);
            if (this.mode === 'move') {
                await this.loadMoveTargetLevels();
            }
        },
        async loadLevels(type) {
            if (this.levelsCache[type]) {
                this.levels = this.levelsCache[type];
                return;
            }
            this.levelsLoading = true;
            try {
                const fetcher = LIST_FETCHERS[type];
                const result = await fetcher();
                const levels = (result || [])
                    .filter(([level]) => level !== null)
                    .map(([level]) => ({ path: level.path, name: level.name }));
                this.levelsCache[type] = levels;
                this.levels = levels;
            } finally {
                this.levelsLoading = false;
            }
        },
        async loadAllNames() {
            this.namesLoading = true;
            try {
                const registeredSet = new Set();
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('list_name')
                    .not('list_name', 'is', null);
                (profiles || []).forEach((p) => registeredSet.add(p.list_name));

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
                // Não repete quem já tem conta registrada na seção "estática".
                registeredSet.forEach((n) => staticSet.delete(n));

                this.registeredNames = Array.from(registeredSet).sort((a, b) => a.localeCompare(b));
                this.staticNames = Array.from(staticSet).sort((a, b) => a.localeCompare(b));
            } finally {
                this.namesLoading = false;
            }
        },
        // Anima a altura de um container ao adicionar/remover um creator, em vez
        // de mudar de tamanho instantaneamente. `mutate` é a função que faz a
        // mudança de verdade (push/splice) no array de creators.
        animateBoxHeight(boxKey, refName, mutate) {
            const el = this.$refs[refName];
            if (!el) { mutate(); return; }

            this.boxHeights[boxKey] = el.offsetHeight + 'px';
            mutate();

            this.$nextTick(() => {
                const previousHeight = el.style.height;
                el.style.height = 'auto';
                const targetHeight = el.scrollHeight + 2;
                el.style.height = previousHeight;

                requestAnimationFrame(() => {
                    this.boxHeights[boxKey] = targetHeight + 'px';
                    clearTimeout(this['_boxHeightTimeout_' + boxKey]);
                    this['_boxHeightTimeout_' + boxKey] = setTimeout(() => {
                        this.boxHeights[boxKey] = 'auto';
                    }, 300);
                });
            });
        },
        togglePath(refName) {
            this.animateBoxHeight('name', refName, () => {
                this.pathExpanded = !this.pathExpanded;
            });
        },
        toggleShowcase(refName) {
            this.animateBoxHeight('video', refName, () => {
                this.showcaseExpanded = !this.showcaseExpanded;
            });
        },
        toggleEditShowcase(refName) {
            this.animateBoxHeight('editVideo', refName, () => {
                this.editShowcaseExpanded = !this.editShowcaseExpanded;
            });
        },
        openPicker(field, index = null) {
            this.picker.field = field;
            this.picker.index = index;
            this.picker.search = '';
            this.picker.newName = '';
        },
        closePicker() {
            this.picker.field = null;
            this.picker.index = null;
        },
        selectName(name) {
            this.applyName(name);
            this.closePicker();
        },
        confirmNewName() {
            const name = this.picker.newName.trim();
            if (!name) return;
            this.applyName(name);
            this.picker.newName = '';
            this.closePicker();
        },
        applyName(name) {
            const isEdit = this.picker.field.startsWith('edit:');
            const key = isEdit ? this.picker.field.slice(5) : this.picker.field;
            const target = isEdit ? this.editForm : this;

            if (key === 'creators') {
                const idx = this.picker.index;
                const boxKey = isEdit ? 'editAuthor' : 'author';
                const refName = isEdit ? 'creatorsBoxEdit' : 'authorBoxAdd';
                if (idx === null || idx === undefined || idx >= target.creators.length) {
                    const exists = target.creators.some((c) => c.name === name);
                    if (!exists) {
                        this.animateBoxHeight(boxKey, refName, () => {
                            target.creators.push({ id: this.creatorIdSeed++, name });
                        });
                    }
                } else {
                    target.creators[idx].name = name;
                }
            } else {
                target[key] = name;
            }
        },
        autoFillPath() {
            // Só sugere o path automaticamente enquanto o admin não editar esse campo manualmente.
            if (this.pathTouched) return;
            this.path = this.name.trim().replace(/\s+/g, '_');
        },
        async submitAdd() {
            this.feedback = null;
            this.submitting = true;

            try {
                const { data: { session } } = await supabase.auth.getSession();

                const creatorsArr = this.creators
                    .map((c) => c.name.trim())
                    .filter(Boolean);

                const res = await fetch('/api/add-level', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        listType: this.listType,
                        position: this.position,
                        path: this.path.trim(),
                        id: this.id,
                        name: this.name.trim(),
                        author: this.author.trim(),
                        creators: creatorsArr.length ? creatorsArr : undefined,
                        verifier: this.verifier.trim(),
                        verification: this.verification.trim(),
                        showcase: this.showcase.trim(),
                        percentToQualify: this.percentToQualify,
                        password: this.password.trim(),
                        status: this.listType === 'verifications' ? this.status : undefined,
                        category: this.listType === 'verifications' ? this.category : undefined,
                        difficulty: this.difficulty || undefined,
                        rating: this.difficulty ? this.rating : undefined,
                        verifierEnjoyment: (this.verifierEnjoyment !== null && this.verifierEnjoyment !== '') ? this.verifierEnjoyment : undefined,
                    }),
                });

                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.error || 'Failed to add level.');
                }

                this.feedback = { ok: true, message: `"${this.name}" added at position #${result.position}.` };
                this.resetAddForm();
                delete this.levelsCache[this.listType];
                await this.loadLevels(this.listType);
                this.loadAllNames();
            } catch (err) {
                this.feedback = { ok: false, message: err.message };
            } finally {
                this.submitting = false;
            }
        },
        async loadRecords() {
            if (!this.recordsPath) return;
            this.recordsLoading = true;
            this.feedback = null;
            try {
                const res = await fetch(`${DIR_URL_BY_LIST_TYPE[this.listType]}/${this.recordsPath}.json`);
                const level = await res.json();
                // Cópia local editável — nada é salvo até clicar em "Save Records".
                this.recordsList = (level.records || []).map((r) => ({ ...r, id: this.recordIdSeed++ }));
            } catch (err) {
                this.feedback = { ok: false, message: 'Failed to load this level\'s records.' };
                this.recordsPath = '';
            } finally {
                this.recordsLoading = false;
            }
        },
        addRecord() {
            this.recordsList.push({ user: '', percent: 100, hz: 240, link: '', date: new Date().toISOString().slice(0, 10), id: this.recordIdSeed++ });
        },
        removeRecord(index) {
            this.recordsList.splice(index, 1);
        },
        moveRecord(index, direction) {
            const target = index + direction;
            if (target < 0 || target >= this.recordsList.length) return;
            const [item] = this.recordsList.splice(index, 1);
            this.recordsList.splice(target, 0, item);
        },
        async saveRecords() {
            this.recordsSaving = true;
            this.feedback = null;

            const cleaned = this.recordsList.map((r) => ({
                user: (r.user || '').trim(),
                percent: Number(r.percent),
                hz: Number(r.hz),
                link: (r.link || '').trim(),
                date: r.date || null,
                enjoyment: r.percent === 100 && typeof r.enjoyment === 'number' ? r.enjoyment : null,
            }));

            if (cleaned.some((r) => !r.user || !r.link || !r.percent || !r.hz)) {
                this.feedback = { ok: false, message: 'Every record needs a user, percent, hz, and link filled in.' };
                this.recordsSaving = false;
                return;
            }

            try {
                const { data: { session } } = await supabase.auth.getSession();

                const res = await fetch('/api/edit-records', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        listType: this.listType,
                        path: this.recordsPath,
                        records: cleaned,
                    }),
                });

                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.error || 'Failed to save records.');
                }

                this.feedback = { ok: true, message: 'Records saved!' };
            } catch (err) {
                this.feedback = { ok: false, message: err.message };
            } finally {
                this.recordsSaving = false;
            }
        },
        toggleEditTag(tag) {
            const i = this.editForm.tags.indexOf(tag);
            if (i === -1) {
                this.editForm.tags.push(tag);
            } else {
                this.editForm.tags.splice(i, 1);
            }
        },
        async loadTagGroups() {
            this.tagGroups = await fetchTagGroups();
        },
        async submitNewCategory() {
            this.tagsError = null;
            try {
                await addTagCategory(this.newCategoryLabel);
                this.newCategoryLabel = '';
                this.newCategoryOpen = false;
                await this.loadTagGroups();
            } catch (err) {
                this.tagsError = err.message || 'Failed to create category.';
            }
        },
        async submitNewTag(categoryId) {
            this.tagsError = null;
            try {
                await addTagToCategory(categoryId, this.newTagName);
                this.newTagName = '';
                this.newTagOpenFor = null;
                await this.loadTagGroups();
            } catch (err) {
                this.tagsError = err.message || 'Failed to add tag.';
            }
        },

        levelLabel(path) {
            const idx = this.levels.findIndex((lvl) => lvl.path === path);
            if (idx === -1) return 'Select a level';
            return `#${idx + 1} — ${this.levels[idx].name}`;
        },
        openGenericLevelPicker(which) {
            this.levelPickerFor = which;
            this.levelPickerSearch = '';
            this.levelPickerOpen = true;
        },
        selectGenericLevel(lvl) {
            if (this.levelPickerFor === 'edit') {
                this.editPath = lvl.path;
                this.loadLevelForEdit();
            } else if (this.levelPickerFor === 'reorder') {
                this.reorderPath = lvl.path;
                this.onReorderLevelSelected();
            } else if (this.levelPickerFor === 'records') {
                this.recordsPath = lvl.path;
                this.loadRecords();
            } else if (this.levelPickerFor === 'remove') {
                this.removePath = lvl.path;
            } else if (this.levelPickerFor === 'move') {
                this.movePath = lvl.path;
            }
            this.levelPickerOpen = false;
        },

        async loadLevelForEdit() {
            if (!this.editPath) return;
            this.editLoading = true;
            try {
                const res = await fetch(`${DIR_URL_BY_LIST_TYPE[this.listType]}/${this.editPath}.json`);
                const level = await res.json();
                this.editForm = {
                    id: level.id ?? '',
                    name: level.name ?? '',
                    author: level.author ?? '',
                    creators: (level.creators || []).map((name) => ({ id: this.creatorIdSeed++, name })),
                    verifier: level.verifier ?? '',
                    verification: level.verification ?? '',
                    showcase: level.showcase ?? '',
                    percentToQualify: level.percentToQualify ?? 100,
                    password: level.password ?? 'Copyable',
                    verifierEnjoyment: typeof level.verifier_enjoyment === 'number' ? level.verifier_enjoyment : null,
                    category: level.category ?? 'classic',
                    notes: level.notes ?? '',
                    difficulty: level.difficulty ?? '',
                    rating: level.rating ?? 1,
                    tags: Array.isArray(level.tags) ? [...level.tags] : [],
                    resetNewBadge: false,
                    newBadgeDays: 14,
                };
            } catch (err) {
                this.feedback = { ok: false, message: 'Failed to load this level\'s data.' };
                this.editPath = '';
            } finally {
                this.editLoading = false;
            }
        },
        async submitEdit() {
            this.feedback = null;
            this.submitting = true;

            try {
                const { data: { session } } = await supabase.auth.getSession();

                const creatorsArr = this.editForm.creators
                    .map((c) => c.name.trim())
                    .filter(Boolean);

                // Se marcado, "faz de conta" que a fase foi adicionada há menos
                // dias que o máximo — assim o badge New aparece só pelos N dias
                // pedidos (nunca mais que o máximo da categoria).
                let dateAddedOverride;
                if (this.editForm.resetNewBadge) {
                    const maxDays = NEW_BADGE_DAYS[this.listType === 'verifications' ? 'verification' : 'level'];
                    const desiredDays = Math.min(Math.max(this.editForm.newBadgeDays || 1, 1), maxDays);
                    const backdateDays = maxDays - desiredDays;
                    dateAddedOverride = new Date(Date.now() - backdateDays * 24 * 60 * 60 * 1000).toISOString();
                }

                const res = await fetch('/api/edit-level', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        listType: this.listType,
                        path: this.editPath,
                        id: this.editForm.id || null,
                        name: this.editForm.name.trim(),
                        author: this.editForm.author.trim(),
                        creators: creatorsArr,
                        verifier: this.editForm.verifier.trim(),
                        verification: this.editForm.verification.trim(),
                        showcase: this.editForm.showcase.trim(),
                        percentToQualify: this.editForm.percentToQualify,
                        password: this.editForm.password.trim(),
                        verifierEnjoyment: (this.editForm.verifierEnjoyment !== null && this.editForm.verifierEnjoyment !== '') ? this.editForm.verifierEnjoyment : null,
                        category: this.listType === 'verifications' ? this.editForm.category : undefined,
                        notes: this.listType === 'verifications' ? this.editForm.notes.trim() : undefined,
                        difficulty: this.editForm.difficulty || undefined,
                        rating: this.editForm.difficulty ? this.editForm.rating : undefined,
                        tags: this.editForm.tags,
                        dateAddedOverride,
                    }),
                });

                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.error || 'Failed to save changes.');
                }

                this.feedback = { ok: true, message: `"${this.editForm.name}" was updated.` };
                delete this.levelsCache[this.listType];
                await this.loadLevels(this.listType);
                this.loadAllNames();
            } catch (err) {
                this.feedback = { ok: false, message: err.message };
            } finally {
                this.submitting = false;
            }
        },
        onReorderLevelSelected() {
            const index = this.levels.findIndex((l) => l.path === this.reorderPath);
            if (index !== -1) {
                this.reorderPosition = index + 1;
            }
        },
        async submitReorder() {
            this.feedback = null;
            this.submitting = true;

            try {
                const { data: { session } } = await supabase.auth.getSession();

                const res = await fetch('/api/reorder-level', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        listType: this.listType,
                        path: this.reorderPath,
                        position: this.reorderPosition,
                    }),
                });

                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.error || 'Failed to reorder level.');
                }

                this.feedback = result.unchanged
                    ? { ok: true, message: 'Position unchanged.' }
                    : { ok: true, message: `Moved to position #${result.position}.` };

                delete this.levelsCache[this.listType];
                await this.loadLevels(this.listType);
                this.reorderPath = '';
            } catch (err) {
                this.feedback = { ok: false, message: err.message };
            } finally {
                this.submitting = false;
            }
        },
        async submitRemove() {
            const lvl = this.levels.find((l) => l.path === this.removePath);
            if (!lvl) return;

            if (!window.confirm(`Are you sure you want to remove "${lvl.name}"? This deletes its file and cannot be undone from here.`)) {
                return;
            }

            this.feedback = null;
            this.submitting = true;

            try {
                const { data: { session } } = await supabase.auth.getSession();

                const res = await fetch('/api/remove-level', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        listType: this.listType,
                        path: this.removePath,
                    }),
                });

                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.error || 'Failed to remove level.');
                }

                this.feedback = {
                    ok: true,
                    message: result.warning || `"${lvl.name}" was removed.`,
                };
                this.removePath = '';
                delete this.levelsCache[this.listType];
                await this.loadLevels(this.listType);
            } catch (err) {
                this.feedback = { ok: false, message: err.message };
            } finally {
                this.submitting = false;
            }
        },
        async submitMove() {
            const lvl = this.levels.find((l) => l.path === this.movePath);
            if (!lvl) return;

            if (!window.confirm(`Move "${lvl.name}" from ${LIST_LABELS[this.listType]} to ${LIST_LABELS[this.moveTarget]}?`)) {
                return;
            }

            this.feedback = null;
            this.submitting = true;

            try {
                const { data: { session } } = await supabase.auth.getSession();

                const res = await fetch('/api/move-level', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        fromList: this.listType,
                        toList: this.moveTarget,
                        path: this.movePath,
                        position: this.movePosition,
                    }),
                });

                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.error || 'Failed to move level.');
                }

                this.feedback = {
                    ok: true,
                    message: result.warning || `"${lvl.name}" was moved to ${LIST_LABELS[this.moveTarget]}.`,
                };
                this.movePath = '';
                this.movePosition = 1;
                delete this.levelsCache[this.listType];
                delete this.levelsCache[this.moveTarget];
                await this.loadLevels(this.listType);
                await this.loadMoveTargetLevels();
            } catch (err) {
                this.feedback = { ok: false, message: err.message };
            } finally {
                this.submitting = false;
            }
        },
        resetAddForm() {
            this.position = 1;
            this.path = '';
            this.pathTouched = false;
            this.id = '';
            this.name = '';
            this.author = '';
            this.creators = [];
            this.verifier = '';
            this.verification = '';
            this.showcase = '';
            this.percentToQualify = 100;
            this.password = 'Copyable';
            this.verifierEnjoyment = null;
            this.status = 'open_verification';
            this.category = 'classic';
            this.difficulty = '';
            this.rating = 1;
        },
    },
};
