import { supabase } from '../supabase.js';
import { store } from '../main.js';
import { embed, getYoutubeIdFromUrl } from '../util.js';
import {
    fetchList,
    fetchPlatformerList,
    fetchChallengeList,
    fetchImpossibleList,
    fetchVerificationsList,
    getImpossibleWR,
} from '../content.js';

const LIST_FETCHERS = {
    classic: fetchList,
    platformer: fetchPlatformerList,
    challenge: fetchChallengeList,
    impossible: fetchImpossibleList,
    verifications: fetchVerificationsList,
};

const LIST_LABELS = {
    classic: 'Classic',
    platformer: 'Platformer',
    challenge: 'Challenge',
    impossible: 'Impossible',
    verifications: 'Verifications',
};

const CATEGORY_LABELS = {
    classic: 'Classic',
    platformer: 'Platformer',
    challenge: 'Challenge',
};

const inputStyle = 'width: 100%; padding: 0.65rem 0.85rem; margin-top: 0.4rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); color: var(--color-on-background);';

export default {
    props: {
        lockedListType: { type: String, default: null },
    },
    data() {
        return {
            store,
            inputStyle,

            listType: this.lockedListType || 'classic',
            listMenuOpen: false,
            levels: [],
            levelsLoading: false,
            levelsCache: {},

            name: '',
            path: '',
            pathTouched: false,
            pathExpanded: false,
            levelId: '',
            position: 1,
            author: '',
            creators: [],
            creatorIdSeed: 1,
            verifierMode: 'self', // 'self' | 'custom'
            verifierCustom: '',
            verificationStatus: 'set_verifier', // 'set_verifier' | 'open_verification' — só usado quando listType === 'verifications'
            statusMenuOpen: false,
            category: 'classic', // só usado quando listType === 'verifications'
            categoryMenuOpen: false,
            categoryInfoExpanded: false,
            link: '',
            showcaseExpanded: false,
            percentToQualify: 100,
            password: 'Copyable',
            passwordInfoExpanded: false,
            notes: '',

            boxHeights: { name: 'auto', video: 'auto', categoryInfo: 'auto' },

            staticNames: [],
            registeredNames: [],
            namesLoading: false,
            picker: {
                field: null, // 'author' | 'creators' | 'verifierCustom' | null
                index: null,
                search: '',
                newName: '',
            },

            submitting: false,
            error: null,
            success: null,
        };
    },
    computed: {
        listTypes() {
            if (this.lockedListType) return [this.lockedListType];
            return Object.keys(LIST_LABELS).filter((t) => t !== 'verifications');
        },
        verifierDisplay() {
            return this.verifierMode === 'self'
                ? (store.profile?.list_name || store.profile?.username || 'you')
                : this.verifierCustom;
        },
        linkLabel() {
            if (this.listType === 'impossible') return 'Showcase Video Link';
            return 'Verification Video Link';
        },
        pickerLabel() {
            const labels = { author: 'Author', creators: 'Creators', verifierCustom: 'Verifier' };
            return labels[this.picker.field] || '';
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
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 600px; margin: 0 auto;">

                <h1 style="text-align: center;">{{ lockedListType ? 'Suggest a Verification' : 'Suggest a Level' }}</h1>

                <div v-if="!store.user" class="login-alert login-alert-error">
                    You need to <router-link to="/login" style="color: inherit; text-decoration: underline;">log in</router-link> first.
                </div>

                <template v-else>
                    <transition name="alert-fade"><div v-if="error" class="login-alert login-alert-error">{{ error }}</div></transition>
                    <transition name="alert-fade"><div v-if="success" class="login-alert login-alert-success">{{ success }}</div></transition>

                    <template v-if="!success">
                        <p style="opacity: 0.6; margin-top: 1rem; font-size: 0.9rem;">
                            Suggest a level you (or someone else) verified that isn't on the list yet. A mod/admin will review it before it goes live.
                        </p>

                        <div v-if="!lockedListType" style="position: relative; margin-top: 1rem;">
                            <button
                                type="button"
                                class="list-tab"
                                @click="listMenuOpen = !listMenuOpen"
                                style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 0.65rem 0.9rem;"
                            >
                                <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ LIST_LABELS_[listType] }}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: listMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                    <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </button>
                            <transition name="dropdown-fade">
                            <div
                                v-if="listMenuOpen"
                                style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; overflow: hidden; z-index: 20;"
                            >
                                <button
                                    type="button"
                                    v-for="type in listTypes"
                                    :key="type"
                                    @click="selectListType(type); listMenuOpen = false;"
                                    class="type-label-lg"
                                    :style="{
                                        display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                        border: 'none', cursor: 'pointer',
                                        backgroundColor: listType === type ? 'var(--color-primary)' : 'transparent',
                                        color: listType === type ? '#ffffff' : 'inherit',
                                    }"
                                >{{ LIST_LABELS_[type] }}</button>
                            </div>
                            </transition>
                            <div v-if="listMenuOpen" @click="listMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                        </div>

                        <form @submit.prevent="submitSuggestion" class="add-level-form-card">
                            <div ref="nameBox" style="padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box; position: relative;" :style="{ height: boxHeights.name, overflow: boxHeights.name === 'auto' ? 'visible' : 'hidden', transition: 'height 0.3s ease' }">
                                <label for="name">Level Name</label><br>
                                <input id="name" type="text" v-model="name" @input="autoFillPath" required :style="inputStyle">

                                <button
                                    type="button"
                                    @click="togglePath"
                                    style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; width: 100%; background: none; border: none; cursor: pointer; color: inherit; padding: 0; margin-top: 1.25rem; font: inherit;"
                                >
                                    <label style="cursor: pointer;">Path</label>
                                    <svg width="14" height="14" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: pathExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                        <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </button>
                                <transition name="collapse-fade">
                                <div v-if="pathExpanded">
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

                            <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;" v-if="listType !== 'verifications'">
                                <div style="display: flex; flex-wrap: wrap; gap: 1.25rem;">
                                    <div style="flex: 1 1 130px; min-width: 0;">
                                        <label for="levelId">Level ID</label><br>
                                        <input id="levelId" type="number" v-model="levelId" required :style="inputStyle">
                                    </div>
                                    <div style="flex: 1 1 130px; min-width: 0;">
                                        <label for="position">Suggested Position</label><br>
                                        <input id="position" type="number" v-model.number="position" min="1" required :style="inputStyle">
                                    </div>
                                </div>
                            </div>

                            <div style="margin-top: 1.25rem;" v-if="listType === 'verifications' && verificationStatus === 'open_verification'">
                                <label for="levelId">Level ID</label><br>
                                <input id="levelId" type="number" v-model="levelId" required :style="inputStyle">
                            </div>

                            <div ref="authorBox" style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box; position: relative;">
                                <label for="author">Author</label><br>
                                <input id="author" type="text" v-model="author" @click="openPicker('author')" readonly required :style="inputStyle + ' cursor: pointer;'">

                                <label style="display: block; margin-top: 1.25rem;">Creators</label>
                                <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">leave empty to just use Author</p>

                                <transition-group name="creator-row-fade" tag="div" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
                                    <div v-for="(c, i) in creators" :key="c.id" style="display: flex; gap: 0.5rem; align-items: center;">
                                        <input type="text" :value="c.name" @click="openPicker('creators', i)" readonly :style="inputStyle + ' cursor: pointer; flex: 1; margin-top: 0;'">
                                        <button type="button" @click="creators.splice(i, 1)" class="creator-slot-btn" aria-label="Remove creator">−</button>
                                    </div>
                                    <button key="add-creator-btn" type="button" @click="openPicker('creators', creators.length)" class="creator-add-btn">+ Add creator</button>
                                </transition-group>

                                <div v-if="listType !== 'impossible' && (listType !== 'verifications' || verificationStatus === 'set_verifier')" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--form-border-gray);">
                                    <label>Verifier</label>
                                    <div class="slide-tabs" style="margin-top: 0.4rem;">
                                        <button type="button" class="slide-tab" :class="{ active: verifierMode === 'self' }" @click="verifierMode = 'self'">It's me</button>
                                        <button type="button" class="slide-tab" :class="{ active: verifierMode === 'custom' }" @click="verifierMode = 'custom'">Someone else</button>
                                        <div class="slide-tab-indicator" :style="{ transform: verifierMode === 'custom' ? 'translateX(100%)' : 'translateX(0)' }"></div>
                                    </div>
                                    <input
                                        v-if="verifierMode === 'custom'"
                                        type="text"
                                        v-model="verifierCustom"
                                        @click="openPicker('verifierCustom')"
                                        readonly
                                        placeholder="Verifier's name"
                                        required
                                        :style="inputStyle + ' cursor: pointer;'"
                                    >
                                    <p v-else style="opacity: 0.5; font-size: 0.8rem; margin: 0.4rem 0 0;">Will be credited to {{ verifierDisplay }}.</p>
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
                                        <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ verificationStatus === 'set_verifier' ? 'Set Verifier' : 'Open Verification' }}</span>
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
                                            @click="verificationStatus = s; statusMenuOpen = false;"
                                            class="type-label-lg"
                                            :style="{
                                                display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                                border: 'none', cursor: 'pointer',
                                                backgroundColor: verificationStatus === s ? 'var(--form-border-gray)' : 'transparent',
                                                color: 'inherit',
                                            }"
                                        >{{ s === 'set_verifier' ? 'Set Verifier' : 'Open Verification' }}</button>
                                    </div>
                                    </transition>
                                    <div v-if="statusMenuOpen" @click="statusMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                                </div>
                                <p style="opacity: 0.5; font-size: 0.8rem; margin-top: 0.4rem;">
                                    {{ verificationStatus === 'set_verifier'
                                        ? "One person (chosen above) will verify this level. No Level ID needed — it's a private verification."
                                        : "Anyone can attempt to verify this level. Level ID is required." }}
                                </p>
                            </div>

                            <div ref="videoBox" style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box; position: relative;" :style="{ height: boxHeights.video, overflow: boxHeights.video === 'auto' ? 'visible' : 'hidden', transition: 'height 0.3s ease' }">
                                <div v-if="listType === 'impossible'">
                                    <label for="link">{{ linkLabel }}</label><br>
                                    <input id="link" type="text" v-model="link" required placeholder="https://youtu.be/..." :style="inputStyle">
                                    <transition name="collapse-fade">
                                        <div v-if="getYoutubeIdFromUrl(link)" class="video-preview-box" style="margin-top: 0.5rem;">
                                            <iframe :src="embed(link)" frameborder="0" allowfullscreen></iframe>
                                        </div>
                                    </transition>
                                </div>

                                <div v-else-if="listType === 'verifications'">
                                    <button
                                        type="button"
                                        @click="toggleShowcase"
                                        style="display: flex; align-items: center; justify-content: center; gap: 0.4rem; width: 100%; background: none; border: none; cursor: pointer; color: inherit; padding: 0; font: inherit;"
                                    >
                                        <label style="cursor: pointer;">Showcase Video (optional)</label>
                                        <svg width="14" height="14" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: showcaseExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                            <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                        </svg>
                                    </button>
                                    <transition name="collapse-fade">
                                        <div v-if="showcaseExpanded">
                                            <input id="link" type="text" v-model="link" placeholder="https://youtu.be/..." :style="inputStyle + ' margin-top: 0.4rem;'">
                                            <transition name="collapse-fade">
                                                <div v-if="getYoutubeIdFromUrl(link)" class="video-preview-box" style="margin-top: 0.5rem;">
                                                    <iframe :src="embed(link)" frameborder="0" allowfullscreen></iframe>
                                                </div>
                                            </transition>
                                        </div>
                                    </transition>
                                    <p v-if="!showcaseExpanded" style="opacity: 0.5; font-size: 0.8rem; margin: 0.3rem 0 0;">{{ link || 'Not set' }}</p>
                                </div>

                                <div v-else>
                                    <label for="link">{{ linkLabel }}</label><br>
                                    <input id="link" type="text" v-model="link" required placeholder="https://youtu.be/..." :style="inputStyle">
                                    <transition name="collapse-fade">
                                        <div v-if="getYoutubeIdFromUrl(link)" class="video-preview-box" style="margin-top: 0.5rem;">
                                            <iframe :src="embed(link)" frameborder="0" allowfullscreen></iframe>
                                        </div>
                                    </transition>
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
                                    </div>

                                    <div v-else>
                                        <label for="password">Password</label><br>
                                        <input id="password" type="text" v-model="password" :style="inputStyle">
                                        <template v-if="listType === 'verifications'">
                                            <button
                                                type="button"
                                                @click="animateBoxHeight('video', 'videoBox', () => { passwordInfoExpanded = !passwordInfoExpanded; })"
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

                            <div style="margin-top: 1.25rem;">
                                <label for="notes">Notes for the reviewer <span style="opacity: 0.5;">(optional)</span></label><br>
                                <textarea id="notes" v-model="notes" rows="3" :style="inputStyle + ' resize: vertical; font-family: inherit;'"></textarea>
                            </div>

                            <button
                                type="submit"
                                class="nav__cta type-label-lg"
                                :disabled="submitting"
                                style="margin-top: 1.75rem; width: 100%; padding: 0.85rem; border: none; border-radius: 8px; cursor: pointer; background-color: #767676;"
                            >{{ submitting ? 'Sending...' : 'Suggest Level' }}</button>
                        </form>
                    </template>
                </template>

            </div>

            <!-- ================= NAME PICKER POPUP ================= -->
            <transition name="tab-fade">
            <div v-if="picker.field" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="closePicker">
                <div style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.25rem;">
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
                            type="button"
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
                            type="button"
                            @click="selectName(n)"
                            style="display: block; width: 100%; text-align: left; padding: 0.4rem 0.5rem; border: none; background: none; color: inherit; cursor: pointer; border-radius: 6px;"
                            onmouseover="this.style.backgroundColor='var(--color-background-hover)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                        >{{ n }}</button>
                        <p v-if="!namesLoading && filteredRegistered.length === 0" style="opacity: 0.4; font-size: 0.85rem;">No matches.</p>
                    </div>

                    <div style="border-top: 1px solid var(--card-border); margin-top: 0.75rem; padding-top: 0.75rem;">
                        <label style="font-size: 0.85rem; opacity: 0.7;">Not listed? Add a new name:</label>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem; align-items: stretch;">
                            <input
                                type="text"
                                v-model="picker.newName"
                                placeholder="New name"
                                @keyup.enter="confirmNewName"
                                :style="inputStyle + ' margin-top: 0; flex: 1;'"
                            >
                            <button
                                type="button"
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
    created() {
        this.LIST_LABELS_ = LIST_LABELS;
        this.CATEGORY_LABELS_ = CATEGORY_LABELS;
        this.embed = embed;
        this.getYoutubeIdFromUrl = getYoutubeIdFromUrl;
    },
    async mounted() {
        await this.loadLevels(this.listType);
    },
    methods: {
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
        togglePath() {
            this.animateBoxHeight('name', 'nameBox', () => {
                this.pathExpanded = !this.pathExpanded;
            });
        },
        toggleShowcase() {
            this.animateBoxHeight('video', 'videoBox', () => {
                this.showcaseExpanded = !this.showcaseExpanded;
            });
        },
        async selectListType(type) {
            if (this.lockedListType) return;
            if (this.listType === type) return;
            this.listType = type;
            await this.loadLevels(type);
        },
        async loadLevels(type) {
            if (this.levelsCache[type]) {
                this.levels = this.levelsCache[type];
                return;
            }
            this.levelsLoading = true;
            this.error = null;
            try {
                const fetcher = LIST_FETCHERS[type];
                const result = await fetcher();
                let levels = (result || [])
                    .filter(([level]) => level !== null);

                if (type === 'impossible') {
                    levels = levels.filter(([level]) => !getImpossibleWR(level).verified);
                }

                levels = levels
                    .map(([level]) => ({ path: level.path, name: level.name }))
                    .sort((a, b) => a.name.localeCompare(b.name));
                this.levelsCache[type] = levels;
                this.levels = levels;
            } catch (err) {
                this.error = 'Failed to load levels. Please try again.';
            } finally {
                this.levelsLoading = false;
            }
        },
        autoFillPath() {
            if (this.pathTouched) return;
            this.path = this.name.trim().replace(/\s+/g, '_');
        },
        async loadAllNames() {
            if (this.staticNames.length > 0 || this.registeredNames.length > 0) return;
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
                registeredSet.forEach((n) => staticSet.delete(n));

                this.registeredNames = Array.from(registeredSet).sort((a, b) => a.localeCompare(b));
                this.staticNames = Array.from(staticSet).sort((a, b) => a.localeCompare(b));
            } finally {
                this.namesLoading = false;
            }
        },
        openPicker(field, index = null) {
            this.picker.field = field;
            this.picker.index = index;
            this.picker.search = '';
            this.picker.newName = '';
            this.loadAllNames();
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
            if (this.picker.field === 'creators') {
                const idx = this.picker.index;
                if (idx === null || idx === undefined || idx >= this.creators.length) {
                    const exists = this.creators.some((c) => c.name === name);
                    if (!exists) {
                        this.animateBoxHeight('author', 'authorBox', () => {
                            this.creators.push({ id: this.creatorIdSeed++, name });
                        });
                    }
                } else {
                    this.creators[idx].name = name;
                }
            } else if (this.picker.field) {
                this[this.picker.field] = name;
            }
        },
        async notifyStaff(type, message, link) {
            try {
                const { data: staff } = await supabase
                    .from('profiles')
                    .select('id')
                    .in('role', ['mod', 'admin']);

                if (staff && staff.length > 0) {
                    await supabase.from('notifications').insert(
                        staff.map((s) => ({ user_id: s.id, type, message, link })),
                    );
                }
            } catch (notifErr) {
                console.error('Failed to notify staff:', notifErr);
            }
        },
        async submitSuggestion() {
            this.error = null;

            const needsId = this.listType !== 'verifications' || this.verificationStatus === 'open_verification';
            if (!this.name.trim() || !this.path.trim() || !this.author.trim() || (needsId && !this.levelId)) {
                this.error = 'Please fill in the level name, path, author' + (needsId ? ', and ID.' : '.');
                return;
            }
            if (this.listType !== 'verifications' && !this.link.trim()) {
                this.error = 'Please provide a video link.';
                return;
            }
            const needsVerifierName = this.listType !== 'impossible' && (this.listType !== 'verifications' || this.verificationStatus === 'set_verifier');
            if (needsVerifierName && this.verifierMode === 'custom' && !this.verifierCustom.trim()) {
                this.error = "Please provide the verifier's name.";
                return;
            }
            if (this.levels.some((l) => l.path.toLowerCase() === this.path.trim().toLowerCase())) {
                this.error = 'A level with this path already exists on the list.';
                return;
            }

            this.submitting = true;
            try {
                const creatorsArr = this.creators
                    .map((c) => c.name.trim())
                    .filter(Boolean);

                const verifier = !needsVerifierName
                    ? null
                    : (this.verifierMode === 'self'
                        ? (store.profile?.list_name || store.profile?.username)
                        : this.verifierCustom.trim());

                const { error: insertError } = await supabase
                    .from('level_suggestions')
                    .insert({
                        user_id: store.user.id,
                        list_type: this.listType,
                        name: this.name.trim(),
                        path: this.path.trim(),
                        level_id: needsId ? this.levelId : null,
                        author: this.author.trim(),
                        creators: creatorsArr.length ? creatorsArr : [this.author.trim()],
                        verifier,
                        verification_status: this.listType === 'verifications' ? this.verificationStatus : null,
                        category: this.listType === 'verifications' ? this.category : null,
                        verification_link: (this.listType !== 'impossible' && this.listType !== 'verifications') ? this.link.trim() : null,
                        showcase_link: (this.listType === 'impossible' || this.listType === 'verifications') ? (this.link.trim() || null) : null,
                        percent_to_qualify: (this.listType !== 'impossible' && this.listType !== 'verifications') ? this.percentToQualify : null,
                        password: this.password.trim() || 'Copyable',
                        suggested_position: this.listType === 'verifications' ? null : this.position,
                        notes: this.notes.trim() || null,
                    });

                if (insertError) throw insertError;

                await this.notifyStaff(
                    'new_level_suggestion',
                    `New level suggestion: ${this.name.trim()} (${LIST_LABELS[this.listType]})`,
                    this.listType === 'verifications' ? '/admin/verification-suggestions' : '/admin/level-suggestions',
                );

                this.success = 'Your level suggestion was sent! A mod/admin will review it soon.';
            } catch (err) {
                this.error = err.message || 'Something went wrong suggesting this level.';
            } finally {
                this.submitting = false;
            }
        },
    },
};
