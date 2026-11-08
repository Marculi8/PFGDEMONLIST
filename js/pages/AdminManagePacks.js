import { store } from '../main.js';
import { supabase, hasRole } from '../supabase.js';
import {
    fetchList,
    fetchPlatformerList,
    fetchChallengeList,
} from '../content.js';

import ImageCropper from '../components/ImageCropper.js';
import { tierGradientCSS, calculateAutoTier } from '../tierGradient.js';
import { scoreClassic, scorePlatformer, scoreChallenge, round } from '../score.js';

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
    classic: 'Classic',
    platformer: 'Platformer',
    challenge: 'Challenge',
};

const inputStyle = 'width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; margin-top: 0.4rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); color: var(--color-on-background);';

export default {
    components: { ImageCropper },
    data: () => ({
        store,
        inputStyle,
        loading: true,
        authorized: false,
        packs: [],
        recalculating: false,
        recalculateProgress: '',
        tiers: [],
        listTypeFilter: 'all',
        listTypeMenuOpen: false,
        deletingId: null,
        error: null,
        feedback: null,

        editingPackId: null,
        editName: '',
        editTagline: '',
        editTierId: null,
        editTierMode: 'auto',
        editTierMenuOpen: false,
        editIconMode: 'emoji',
        editIconEmoji: '',
        editIconImageUrl: '',
        uploadingIcon: false,
        cropperOpen: false,
        rawImageSrc: null,
        editLevels: [],
        editLevelIdSeed: 1,
        editListType: 'classic',
        editBonusPercent: 0,
        savingEdit: false,
        editError: null,

        levelPickerOpen: false,
        levelPickerSearch: '',
        levelsCache: {},
        levelsLoading: false,
    }),
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 700px; margin: 0 auto;">

                <h1 style="text-align: center; margin-bottom: 1.5rem;">Manage Packs</h1>

                <template v-if="loading">
                    <p>Loading...</p>
                </template>

                <template v-else-if="!authorized">
                    <div class="login-alert login-alert-error">
                        You don't have permission to view this page.
                    </div>
                </template>

                <template v-else>
                    <transition name="alert-fade"><div v-if="error" class="login-alert login-alert-error">{{ error }}</div></transition>
                    <transition name="alert-fade"><div v-if="feedback" :class="['login-alert', feedback.ok ? 'login-alert-success' : 'login-alert-error']">{{ feedback.message }}</div></transition>

                    <button
                        type="button"
                        class="suggest-level-btn"
                        style="background-image: none; background-color: #767676;"
                        :disabled="recalculating"
                        @click="recalculateAllTiers"
                    >
                        <svg v-if="!recalculating" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
                        </svg>
                        <span class="type-label-lg">{{ recalculating ? (recalculateProgress || 'Recalculating...') : 'Recalculate All Tiers' }}</span>
                    </button>

                    <div style="position: relative; margin-top: 1rem;">
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

                    <p v-if="visibleTiers.length === 0" style="opacity: 0.6; margin-top: 1rem; text-align: center;">No packs match this filter.</p>

                    <div v-for="tier in visibleTiers" :key="tier.id" style="margin-top: 1.5rem; border-radius: 12px; padding: 2px; box-sizing: border-box; background-size: 100% 400px; background-position: top; background-repeat: no-repeat;" :style="{ backgroundImage: tierGradientCSS_(tier) }">
                        <div style="border-radius: 10px; overflow: hidden;">
                        <div
                            style="padding: 0.85rem 1rem;"
                            :style="{ backgroundImage: tierGradientCSS_(tier) }"
                        >
                            <span class="type-label-lg" style="color: #14141a; text-shadow: 0 1px 2px rgba(255,255,255,0.35);">{{ tier.name }} Tier</span>
                        </div>

                        <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; background-color: var(--card-bg); max-height: 300px; overflow-y: auto;">
                        <div v-for="(p, i) in tier.packs" :key="p.id" style="padding: 0.85rem 1rem; border-top: 1px solid rgba(255,255,255,0.06);">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <button type="button" @click="movePack(tier.packs, i, 1)" :disabled="i === tier.packs.length - 1" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; flex-shrink: 0;">▼</button>
                                <div style="flex: 1; text-align: center;">
                                    <p class="type-label-lg" style="margin: 0; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                                        <span v-if="p.icon_emoji">{{ p.icon_emoji }}</span>
                                        <img v-else-if="p.icon_image_url" :src="p.icon_image_url" style="width: 1.4rem; height: 1.4rem; border-radius: 50%; object-fit: cover;">
                                        {{ p.name }}
                                    </p>
                                    <p style="opacity: 0.6; font-size: 0.85rem; margin: 0.25rem 0 0;">
                                        {{ LIST_LABELS_[p.list_type] || '—' }} ·
                                        <span :style="{ color: p.status === 'pending' ? 'orange' : (p.status === 'rejected' ? 'var(--color-error)' : 'inherit') }">{{ p.status }}</span>
                                    </p>
                                </div>
                                <button type="button" @click="movePack(tier.packs, i, -1)" :disabled="i === 0" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; flex-shrink: 0;">▲</button>
                            </div>

                            <div style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 0.6rem;">
                                <button type="button" class="btn type-label-lg" style="width: auto; padding: 0.5rem 1rem;" @click="toggleEdit(p)">Manage</button>
                                <button
                                    type="button"
                                    class="btn type-label-lg"
                                    style="width: auto; padding: 0.5rem 1rem; background-color: var(--color-error); background-image: var(--error-gradient);"
                                    :disabled="deletingId === p.id"
                                    @click="deletePack(p)"
                                >{{ deletingId === p.id ? 'Deleting...' : 'Delete' }}</button>
                            </div>
                        </div>
                        </transition-group>
                        </div>
                    </div>
                </template>
            </div>

            <!-- ================= MANAGE PACK POPUP ================= -->
            <transition name="tab-fade">
            <div v-if="editingPack" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="editingPackId = null">
                <div style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 420px; max-height: 85vh; overflow-y: auto; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Manage — {{ editingPack.name }}</p>
                        <button @click="editingPackId = null" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>

                    <div style="text-align: center; margin-top: 0.85rem;">
                                <transition name="alert-fade"><div v-if="editError" class="login-alert login-alert-error" style="margin: 0 0 0.6rem;">{{ editError }}</div></transition>

                                <label>Name</label>
                                <input type="text" v-model="editName" :style="inputStyle">

                            <label style="display: block; margin-top: 1rem;">Tagline</label>
                            <input type="text" v-model="editTagline" :style="inputStyle">

                            <label style="display: block; margin-top: 1rem;">Tier</label>
                            <div style="display: flex; gap: 0.4rem; margin-top: 0.4rem; justify-content: center;">
                                <button
                                    v-for="m in ['auto', 'manual']"
                                    :key="m"
                                    type="button"
                                    @click="editTierMode = m"
                                    :style="{
                                        fontSize: '0.85rem', padding: '0.4rem 0.9rem', borderRadius: '999px', cursor: 'pointer',
                                        border: '1px solid var(--card-border)',
                                        backgroundColor: editTierMode === m ? 'var(--color-primary)' : 'transparent',
                                        color: editTierMode === m ? 'white' : 'inherit',
                                    }"
                                >{{ m === 'auto' ? 'Automatic' : 'Manual' }}</button>
                            </div>

                            <template v-if="editTierMode === 'auto'">
                                <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.6rem 0 0;">Calculated automatically from the levels below.</p>
                                <div v-if="editAutoTier" style="margin-top: 0.6rem;">
                                    <span
                                        class="type-label-lg"
                                        :style="{
                                            display: 'inline-block', padding: '0.4rem 1rem', borderRadius: '999px',
                                            color: '#14141a', textShadow: '0 1px 2px rgba(255,255,255,0.35)',
                                            backgroundImage: tierGradientCSS_(editAutoTier),
                                        }"
                                    >{{ editAutoTier.name }} Tier</span>
                                </div>
                                <p v-else style="opacity: 0.5; font-size: 0.85rem; margin-top: 0.6rem;">Add levels to see the tier.</p>
                            </template>

                            <div v-else style="position: relative; margin-top: 0.75rem;">
                                <button
                                    type="button"
                                    class="list-tab"
                                    @click="editTierMenuOpen = !editTierMenuOpen"
                                    style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 0.65rem 0.9rem;"
                                >
                                    <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ tierName(editTierId) || 'Select a tier' }}</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: editTierMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                        <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </button>
                                <transition name="dropdown-fade">
                                <div v-if="editTierMenuOpen" style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; overflow: hidden; z-index: 20;">
                                    <button
                                        v-for="t in tiers"
                                        :key="t.id"
                                        type="button"
                                        @click="editTierId = t.id; editTierMenuOpen = false;"
                                        class="type-label-lg"
                                        :style="{ display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem', border: 'none', cursor: 'pointer', backgroundColor: editTierId === t.id ? 'var(--color-primary)' : 'transparent', color: editTierId === t.id ? '#ffffff' : 'inherit' }"
                                    >{{ t.name }}</button>
                                </div>
                                </transition>
                                <div v-if="editTierMenuOpen" @click="editTierMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                            </div>

                            <label style="display: block; margin-top: 1rem;">List</label>
                            <div style="display: flex; gap: 0.4rem; margin-top: 0.4rem; justify-content: center; flex-wrap: wrap;">
                                <button
                                    v-for="lt in ['classic', 'platformer', 'challenge']"
                                    :key="lt"
                                    type="button"
                                    @click="selectEditListType(lt)"
                                    :style="{
                                        fontSize: '0.85rem', padding: '0.45rem 0.9rem', borderRadius: '999px', cursor: 'pointer',
                                        border: '1px solid var(--card-border)',
                                        backgroundColor: editListType === lt ? 'var(--color-primary)' : 'transparent',
                                        color: editListType === lt ? 'white' : 'inherit',
                                    }"
                                >{{ LIST_LABELS_[lt] }}</button>
                            </div>

                            <label style="display: block; margin-top: 1rem;">Icon</label>
                            <div class="slide-tabs" style="margin-top: 0.5rem;">
                                <button type="button" class="slide-tab" :class="{ active: editIconMode === 'emoji' }" @click="editIconMode = 'emoji'">Emoji</button>
                                <button type="button" class="slide-tab" :class="{ active: editIconMode === 'image' }" @click="editIconMode = 'image'">Image</button>
                                <div class="slide-tab-indicator" :style="{ transform: editIconMode === 'image' ? 'translateX(100%)' : 'translateX(0)' }"></div>
                            </div>
                            <input v-if="editIconMode === 'emoji'" type="text" v-model="editIconEmoji" maxlength="4" :style="inputStyle + ' text-align: center; font-size: 1.5rem;'">
                            <div v-else style="margin-top: 0.75rem;">
                                <img v-if="editIconImageUrl" :src="editIconImageUrl" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto;">
                                <label style="display: inline-block; margin-top: 0.6rem; padding: 0.5rem 1rem; border-radius: 8px; border: 1.5px dashed var(--form-border-gray); cursor: pointer; font-size: 0.85rem;">
                                    {{ uploadingIcon ? 'Uploading...' : '+ Upload image' }}
                                    <input type="file" accept="image/*" @change="handleFileSelect" style="display: none;" :disabled="uploadingIcon">
                                </label>
                            </div>

                            <label style="display: block; margin-top: 1.25rem;">Levels</label>
                            <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">Reward points are calculated automatically from these levels.</p>

                            <label style="display: block; margin-top: 1rem;">Points Boost <span style="opacity: 0.5;">(%)</span></label>
                            <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">Inflates this pack's reward points by this percentage. 0 = no change, 50 = +50%.</p>
                            <input type="number" v-model.number="editBonusPercent" step="1" style="width: 120px; box-sizing: border-box; margin-top: 0.4rem; padding: 0.5rem 0.7rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background); color: var(--color-on-background); text-align: center;">

                            <div v-if="editLevels.length > 0" style="margin-top: 1rem; padding: 0.85rem 1rem; border-radius: 8px; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%); text-align: center;">
                                <span class="type-label-lg">Estimated Reward: {{ estimatedPoints }} points</span>
                            </div>

                            <transition-group name="creator-row-fade" tag="div" style="margin-top: 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
                                <div v-for="(lvl, i) in editLevels" :key="lvl.id" style="display: flex; gap: 0.5rem; align-items: center; text-align: left;">
                                    <div style="flex: 1; min-width: 0;">
                                        <span style="opacity: 0.5; font-size: 0.75rem;">#{{ lvl.position }}</span>
                                        <span class="type-label-lg" style="font-size: 0.9rem;"> {{ lvl.name }}</span>
                                        <span style="opacity: 0.5; font-size: 0.75rem;"> ({{ levelScore(lvl) }} pts)</span>
                                    </div>
                                    <button type="button" @click="moveLevel(i, -1)" :disabled="i === 0" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; flex-shrink: 0;">▲</button>
                                    <button type="button" @click="moveLevel(i, 1)" :disabled="i === editLevels.length - 1" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; flex-shrink: 0;">▼</button>
                                    <button type="button" @click="editLevels.splice(i, 1)" class="creator-slot-btn" aria-label="Remove level">−</button>
                                </div>
                                <button key="add-lvl-btn" type="button" @click="openLevelPicker" class="creator-add-btn">+ Add level</button>
                            </transition-group>

                            <button
                                type="button"
                                @click="saveEdit(editingPack)"
                                class="login-btn"
                                style="width: auto; padding: 0.55rem 1.1rem; margin: 1.25rem 0 0;"
                                :disabled="savingEdit"
                            >{{ savingEdit ? 'Saving...' : 'Save changes' }}</button>
                    </div>
                </div>
            </div>
            </transition>

            <!-- ================= LEVEL PICKER POPUP ================= -->
            <transition name="tab-fade">
            <div v-if="levelPickerOpen" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="levelPickerOpen = false">
                <div style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Add a level</p>
                        <button @click="levelPickerOpen = false" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>
                    <input type="text" v-model="levelPickerSearch" placeholder="Search..." :style="inputStyle">
                    <div style="overflow-y: auto; margin-top: 0.75rem; padding-top: 0.2rem; flex: 1;">
                        <p v-if="levelsLoading" style="opacity: 0.5; font-size: 0.85rem;">Loading...</p>
                        <button
                            v-for="lvl in filteredLevelOptions"
                            :key="lvl.path"
                            type="button"
                            @click="addLevel(lvl)"
                            style="display: flex; gap: 0.5rem; align-items: baseline; width: 100%; text-align: left; padding: 0.5rem 0.6rem; border: none; background: none; color: inherit; cursor: pointer; border-radius: 6px;"
                            onmouseover="this.style.backgroundColor='var(--color-background-hover)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                        ><span style="opacity: 0.5; font-size: 0.8rem; flex-shrink: 0;">#{{ lvl.position }}</span><span>{{ lvl.name }}</span></button>
                        <p v-if="!levelsLoading && filteredLevelOptions.length === 0" style="opacity: 0.4; font-size: 0.85rem;">No matches.</p>
                    </div>
                </div>
            </div>
            </transition>

            <ImageCropper v-if="cropperOpen" :image-src="rawImageSrc" @cropped="handleCropped" @cancel="cropperOpen = false"></ImageCropper>
        </main>
    `,
    created() {
        this.LIST_LABELS_ = LIST_LABELS;
        this.tierGradientCSS_ = tierGradientCSS;
    },
    async mounted() {
        this.authorized = await hasRole('admin');
        if (this.authorized) {
            await Promise.all([this.loadTiers(), this.loadPacks()]);
        }
        this.loading = false;
    },
    computed: {
        editingPack() {
            return this.packs.find((p) => p.id === this.editingPackId) || null;
        },
        editAutoTier() {
            return calculateAutoTier(this.estimatedPoints, this.tiers);
        },
        estimatedPoints() {
            if (this.editLevels.length === 0) return 0;
            const scoreFn = SCORE_FNS[this.editListType];
            if (!scoreFn) return 0;
            const scores = this.editLevels.map((l) => scoreFn(l.position, 100, l.percentToQualify));
            const rawAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
            return round(rawAvg * (1 + (this.editBonusPercent || 0) / 100));
        },
        filteredPacksForList() {
            if (this.listTypeFilter === 'all') return this.packs;
            return this.packs.filter((p) => p.list_type === this.listTypeFilter);
        },
        visibleTiers() {
            return this.tiers
                .map((tier) => ({
                    ...tier,
                    packs: this.filteredPacksForList
                        .filter((p) => p.tier_id === tier.id)
                        .sort((a, b) => a.sort_order - b.sort_order),
                }))
                .filter((tier) => tier.packs.length > 0);
        },
        filteredLevelOptions() {
            const list = this.levelsCache[this.editListType] || [];
            const q = this.levelPickerSearch.trim().toLowerCase();
            const chosenPaths = new Set(this.editLevels.map((l) => l.path));
            let filtered = list.filter((l) => !chosenPaths.has(l.path));
            if (q) filtered = filtered.filter((l) => l.name.toLowerCase().includes(q));
            return filtered;
        },
    },
    methods: {
        tierName(id) {
            const t = this.tiers.find((x) => x.id === id);
            return t ? t.name : '';
        },
        async loadTiers() {
            const { data } = await supabase.from('pack_tiers').select('*').order('sort_order', { ascending: true });
            this.tiers = data || [];
        },
        async loadPacks() {
            const { data } = await supabase.from('packs').select('*').order('sort_order', { ascending: true });
            this.packs = data || [];
        },

        async recalculateAllTiers() {
            if (!window.confirm(`Recalculate the tier of all ${this.packs.length} packs? This forces every pack to Automatic, overriding any manual tier choice.`)) return;

            this.recalculating = true;
            this.error = null;
            this.feedback = null;

            try {
                // Busca as 3 listas uma vez só, e monta o índice posição+percentToQualify por fase.
                const listTypes = ['classic', 'platformer', 'challenge'];
                const results = await Promise.all(listTypes.map((t) => LIST_FETCHERS[t]()));
                const levelInfo = {};
                listTypes.forEach((type, i) => {
                    const map = new Map();
                    (results[i] || []).forEach(([level], idx) => {
                        if (level) map.set(level.path, { position: idx + 1, percentToQualify: level.percentToQualify });
                    });
                    levelInfo[type] = map;
                });

                const { data: allLevels } = await supabase
                    .from('pack_levels')
                    .select('*')
                    .in('pack_id', this.packs.map((p) => p.id));

                let updated = 0;
                for (let i = 0; i < this.packs.length; i++) {
                    const p = this.packs[i];
                    this.recalculateProgress = `Recalculating... ${i + 1}/${this.packs.length}`;

                    const scoreFn = SCORE_FNS[p.list_type];
                    const packLevels = (allLevels || []).filter((l) => l.pack_id === p.id);

                    if (!scoreFn || packLevels.length === 0) continue;

                    const scores = packLevels.map((pl) => {
                        const info = levelInfo[p.list_type]?.get(pl.level_path);
                        if (!info) return 0;
                        return scoreFn(info.position, 100, info.percentToQualify);
                    });
                    const rawAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
                    const points = round(rawAvg * (1 + (p.bonus_percent || 0) / 100));

                    const newTier = calculateAutoTier(points, this.tiers);
                    if (!newTier) continue;

                    if (p.tier_id !== newTier.id || p.tier_mode !== 'auto') {
                        await supabase.from('packs').update({ tier_id: newTier.id, tier_mode: 'auto' }).eq('id', p.id);
                        p.tier_id = newTier.id;
                        p.tier_mode = 'auto';
                        updated++;
                    }
                }

                this.feedback = { ok: true, message: `Done — ${updated} pack(s) had their tier updated.` };
            } catch (err) {
                this.feedback = { ok: false, message: err.message || 'Something went wrong recalculating tiers.' };
            } finally {
                this.recalculating = false;
                this.recalculateProgress = '';
                clearTimeout(this._feedbackTimeout);
                this._feedbackTimeout = setTimeout(() => { this.feedback = null; }, 6000);
            }
        },

        async movePack(tierPacks, index, direction) {
            const target = index + direction;
            if (target < 0 || target >= tierPacks.length) return;

            const a = tierPacks[index];
            const b = tierPacks[target];
            [a.sort_order, b.sort_order] = [b.sort_order, a.sort_order];
            [tierPacks[index], tierPacks[target]] = [tierPacks[target], tierPacks[index]];

            await Promise.all([
                supabase.from('packs').update({ sort_order: a.sort_order }).eq('id', a.id),
                supabase.from('packs').update({ sort_order: b.sort_order }).eq('id', b.id),
            ]);
        },

        async toggleEdit(p) {
            if (this.editingPackId === p.id) {
                this.editingPackId = null;
                return;
            }
            this.editingPackId = p.id;
            this.editName = p.name;
            this.editTagline = p.tagline || '';
            this.editTierId = p.tier_id;
            this.editTierMode = p.tier_mode || 'auto';
            this.editListType = p.list_type || 'classic';
            this.editBonusPercent = p.bonus_percent || 0;
            this.editIconMode = p.icon_image_url ? 'image' : 'emoji';
            this.editIconEmoji = p.icon_emoji || '';
            this.editIconImageUrl = p.icon_image_url || '';
            this.editError = null;

            await this.loadLevelList(this.editListType);
            const levelInfo = new Map((this.levelsCache[this.editListType] || []).map((l) => [l.path, l]));

            const { data: levels } = await supabase.from('pack_levels').select('*').eq('pack_id', p.id).order('sort_order', { ascending: true });
            this.editLevels = (levels || []).map((l) => ({
                id: this.editLevelIdSeed++,
                listType: l.list_type,
                path: l.level_path,
                name: l.level_name,
                position: levelInfo.get(l.level_path)?.position ?? '?',
                percentToQualify: levelInfo.get(l.level_path)?.percentToQualify,
                points: l.points,
            }));
        },

        async selectEditListType(lt) {
            if (this.editListType === lt) return;
            if (this.editLevels.length > 0 && !window.confirm('Changing the list will clear the levels you already added. Continue?')) {
                return;
            }
            this.editListType = lt;
            this.editLevels = [];
            await this.loadLevelList(lt);
        },

        async openLevelPicker() {
            this.levelPickerOpen = true;
            this.levelPickerSearch = '';
            await this.loadLevelList(this.editListType);
        },
        async loadLevelList(listType) {
            if (this.levelsCache[listType]) return;
            this.levelsLoading = true;
            try {
                const result = await LIST_FETCHERS[listType]();
                this.levelsCache[listType] = (result || [])
                    .filter(([level]) => level !== null)
                    .map(([level], i) => ({ path: level.path, name: level.name, position: i + 1, percentToQualify: level.percentToQualify }));
            } finally {
                this.levelsLoading = false;
            }
        },
        addLevel(lvl) {
            this.editLevels.push({ id: this.editLevelIdSeed++, listType: this.editListType, path: lvl.path, name: lvl.name, position: lvl.position, percentToQualify: lvl.percentToQualify, points: 0 });
            this.levelPickerOpen = false;
        },
        moveLevel(index, direction) {
            const target = index + direction;
            if (target < 0 || target >= this.editLevels.length) return;
            const arr = this.editLevels;
            [arr[index], arr[target]] = [arr[target], arr[index]];
        },
        levelScore(lvl) {
            const scoreFn = SCORE_FNS[lvl.listType];
            if (!scoreFn) return 0;
            return scoreFn(lvl.position, 100, lvl.percentToQualify);
        },

        handleFileSelect(event) {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
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
            this.uploadingIcon = true;
            try {
                const filePath = `pending/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
                const { error: uploadError } = await supabase.storage.from('pack-icons').upload(filePath, blob, { contentType: 'image/png' });
                if (uploadError) {
                    this.editError = 'Failed to upload the icon image.';
                } else {
                    const { data } = supabase.storage.from('pack-icons').getPublicUrl(filePath);
                    this.editIconImageUrl = data.publicUrl;
                }
            } finally {
                this.uploadingIcon = false;
            }
        },

        async saveEdit(p) {
            this.editError = null;
            if (this.editLevels.length === 0) {
                this.editError = 'A pack needs at least one level.';
                return;
            }
            const finalTierId = this.editTierMode === 'auto' ? this.editAutoTier?.id : this.editTierId;
            if (!finalTierId) {
                this.editError = this.editTierMode === 'auto' ? 'Could not calculate a tier.' : 'Please select a tier.';
                return;
            }
            this.savingEdit = true;
            try {
                const { error: updateError } = await supabase
                    .from('packs')
                    .update({
                        name: this.editName.trim(),
                        tagline: this.editTagline.trim() || null,
                        tier_id: finalTierId,
                        tier_mode: this.editTierMode,
                        list_type: this.editListType,
                        bonus_percent: this.editBonusPercent || 0,
                        icon_image_url: this.editIconMode === 'image' ? (this.editIconImageUrl || null) : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', p.id);
                if (updateError) throw updateError;

                await supabase.from('pack_levels').delete().eq('pack_id', p.id);
                const { error: levelsError } = await supabase
                    .from('pack_levels')
                    .insert(this.editLevels.map((l, i) => ({
                        pack_id: p.id,
                        list_type: l.listType,
                        level_path: l.path,
                        level_name: l.name,
                        points: l.points || 0,
                        sort_order: i,
                    })));
                if (levelsError) throw levelsError;

                Object.assign(p, {
                    name: this.editName.trim(),
                    tagline: this.editTagline.trim() || null,
                    tier_id: finalTierId,
                    tier_mode: this.editTierMode,
                    list_type: this.editListType,
                    bonus_percent: this.editBonusPercent || 0,
                    icon_emoji: this.editIconMode === 'emoji' ? (this.editIconEmoji.trim() || null) : null,
                    icon_image_url: this.editIconMode === 'image' ? (this.editIconImageUrl || null) : null,
                });
                this.editingPackId = null;
                this.feedback = { ok: true, message: 'Saved.' };
            } catch (err) {
                this.editError = err.message || 'Something went wrong saving these changes.';
            } finally {
                this.savingEdit = false;
                clearTimeout(this._feedbackTimeout);
                this._feedbackTimeout = setTimeout(() => { this.feedback = null; }, 4000);
            }
        },

        async deletePack(p) {
            if (!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;
            this.deletingId = p.id;
            this.error = null;
            this.feedback = null;

            const { error } = await supabase.from('packs').delete().eq('id', p.id);
            if (error) {
                this.feedback = { ok: false, message: 'Failed to delete pack.' };
            } else {
                this.packs = this.packs.filter((x) => x.id !== p.id);
                this.feedback = { ok: true, message: `Deleted "${p.name}".` };
            }
            clearTimeout(this._feedbackTimeout);
            this._feedbackTimeout = setTimeout(() => { this.feedback = null; }, 4000);
            this.deletingId = null;
        },
    },
};
