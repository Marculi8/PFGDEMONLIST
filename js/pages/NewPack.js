import { store } from '../main.js';
import { supabase, hasRole } from '../supabase.js';
import {
    fetchList,
    fetchPlatformerList,
    fetchChallengeList,
} from '../content.js';

import ImageCropper from '../components/ImageCropper.js';
import { scoreClassic, scorePlatformer, scoreChallenge, round } from '../score.js';
import { tierGradientCSS, calculateAutoTier } from '../tierGradient.js';

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
        loadingAuth: true,
        authorized: false,
        name: '',
        tagline: '',
        tierId: null,
        tierMode: 'auto',
        tierMenuOpen: false,
        tiers: [],

        iconMode: 'emoji', // 'emoji' | 'image' | 'none'
        iconEmoji: '',
        iconImageUrl: '',
        uploadingIcon: false,
        cropperOpen: false,
        rawImageSrc: null,

        levels: [], // { id, listType, path, name, points, position }
        levelIdSeed: 1,
        listType: 'classic',

        levelPickerOpen: false,
        levelPickerSearch: '',
        levelsCache: {},
        levelsLoading: false,

        submitting: false,
        error: null,
        success: null,
    }),
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 600px; margin: 0 auto;">

                <h1 style="text-align: center;">New Pack</h1>

                <template v-if="loadingAuth">
                    <p style="text-align: center; opacity: 0.6;">Loading...</p>
                </template>

                <div v-else-if="!authorized" class="login-alert login-alert-error">
                    You don't have permission to view this page.
                </div>

                <template v-else>
                    <transition name="alert-fade"><div v-if="error" class="login-alert login-alert-error">{{ error }}</div></transition>
                    <transition name="alert-fade"><div v-if="success" class="login-alert login-alert-success">{{ success }}</div></transition>

                    <template v-if="!success">
                        <p style="opacity: 0.6; margin-top: 1rem; font-size: 0.9rem;">
                            Group a set of levels into a themed pack. It goes live immediately — no review needed.
                        </p>

                        <form @submit.prevent="submitPack" class="add-level-form-card">
                            <div style="padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;">
                                <label for="name">Pack Name</label><br>
                                <input id="name" type="text" v-model="name" required :style="inputStyle">

                                <label for="tagline" style="display: block; margin-top: 1.75rem;">Description</label>
                                <input id="tagline" type="text" v-model="tagline" required placeholder="A short description" :style="inputStyle">
                            </div>

                            <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;">
                                <label>Tier</label>
                                <div style="display: flex; gap: 0.4rem; margin-top: 0.5rem; justify-content: center;">
                                    <button
                                        v-for="m in ['auto', 'manual']"
                                        :key="m"
                                        type="button"
                                        @click="tierMode = m"
                                        :style="{
                                            fontSize: '0.85rem', padding: '0.4rem 0.9rem', borderRadius: '999px', cursor: 'pointer',
                                            border: '1px solid var(--card-border)',
                                            backgroundColor: tierMode === m ? 'var(--color-primary)' : 'transparent',
                                            color: tierMode === m ? 'white' : 'inherit',
                                        }"
                                    >{{ m === 'auto' ? 'Automatic' : 'Manual' }}</button>
                                </div>

                                <template v-if="tierMode === 'auto'">
                                    <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.6rem 0 0;">Calculated automatically from the levels you pick below.</p>
                                    <div v-if="autoTier" style="margin-top: 0.6rem;">
                                        <span
                                            class="type-label-lg"
                                            :style="{
                                                display: 'inline-block', padding: '0.4rem 1rem', borderRadius: '999px',
                                                color: '#14141a', textShadow: '0 1px 2px rgba(255,255,255,0.35)',
                                                backgroundImage: tierGradientCSS_(autoTier),
                                            }"
                                        >{{ autoTier.name }} Tier</span>
                                    </div>
                                    <p v-else style="opacity: 0.5; font-size: 0.85rem; margin-top: 0.6rem;">Add levels to see the tier.</p>
                                </template>

                                <div v-else style="position: relative; margin-top: 0.75rem;">
                                    <button
                                        type="button"
                                        class="list-tab"
                                        @click="tierMenuOpen = !tierMenuOpen"
                                        style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 0.65rem 0.9rem;"
                                    >
                                        <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ tierId ? tierName(tierId) : 'Select a tier' }}</span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: tierMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                            <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                        </svg>
                                    </button>
                                    <transition name="dropdown-fade">
                                    <div
                                        v-if="tierMenuOpen"
                                        style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; overflow: hidden; z-index: 20;"
                                    >
                                        <button
                                            type="button"
                                            v-for="t in tiers"
                                            :key="t.id"
                                            @click="tierId = t.id; tierMenuOpen = false;"
                                            class="type-label-lg"
                                            :style="{
                                                display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                                border: 'none', cursor: 'pointer',
                                                backgroundColor: tierId === t.id ? 'var(--color-primary)' : 'transparent',
                                                color: tierId === t.id ? '#ffffff' : 'inherit',
                                            }"
                                        >{{ t.name }}</button>
                                    </div>
                                    </transition>
                                    <div v-if="tierMenuOpen" @click="tierMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                                </div>
                            </div>

                            <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;">
                                <label>List</label>
                                <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">Which list this pack's levels come from.</p>
                                <div style="display: flex; gap: 0.4rem; margin-top: 0.5rem; justify-content: center; flex-wrap: wrap;">
                                    <button
                                        v-for="lt in ['classic', 'platformer', 'challenge']"
                                        :key="lt"
                                        type="button"
                                        @click="selectListType(lt)"
                                        :style="{
                                            fontSize: '0.85rem', padding: '0.45rem 0.9rem', borderRadius: '999px', cursor: 'pointer',
                                            border: '1px solid var(--card-border)',
                                            backgroundColor: listType === lt ? 'var(--color-primary)' : 'transparent',
                                            color: listType === lt ? 'white' : 'inherit',
                                        }"
                                    >{{ LIST_LABELS_[lt] }}</button>
                                </div>
                            </div>

                            <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;">
                                <label>Icon <span style="opacity: 0.5;">(optional)</span></label>
                                <div class="slide-tabs" style="margin-top: 0.5rem;">
                                    <button type="button" class="slide-tab" :class="{ active: iconMode === 'emoji' }" @click="iconMode = 'emoji'">Emoji</button>
                                    <button type="button" class="slide-tab" :class="{ active: iconMode === 'image' }" @click="iconMode = 'image'">Image</button>
                                    <div class="slide-tab-indicator" :style="{ transform: iconMode === 'image' ? 'translateX(100%)' : 'translateX(0)' }"></div>
                                </div>

                                <input v-if="iconMode === 'emoji'" type="text" v-model="iconEmoji" placeholder="🔥" maxlength="4" :style="inputStyle + ' text-align: center; font-size: 1.5rem; margin-top: 0.75rem;'">

                                <div v-else style="margin-top: 0.75rem;">
                                    <img v-if="iconImageUrl" :src="iconImageUrl" style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto;">
                                    <label style="display: inline-block; margin-top: 0.6rem; padding: 0.5rem 1rem; border-radius: 8px; border: 1.5px dashed var(--form-border-gray); cursor: pointer; font-size: 0.85rem;">
                                        {{ uploadingIcon ? 'Uploading...' : (iconImageUrl ? 'Change image' : '+ Upload image') }}
                                        <input type="file" accept="image/*" @change="handleFileSelect" style="display: none;" :disabled="uploadingIcon">
                                    </label>
                                </div>
                            </div>

                            <div v-if="levels.length > 0" style="margin-top: 1.25rem; padding: 0.85rem 1rem; border-radius: 8px; background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%); text-align: center;">
                                <span class="type-label-lg">Estimated Reward: {{ estimatedPoints }} points</span>
                            </div>

                            <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;">
                                <label>Levels</label>
                                <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">Reward points are calculated automatically from these levels.</p>

                                <transition-group name="creator-row-fade" tag="div" style="margin-top: 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
                                    <div v-for="(lvl, i) in levels" :key="lvl.id" style="display: flex; gap: 0.5rem; align-items: center; text-align: left;">
                                        <div style="flex: 1; min-width: 0;">
                                            <span style="opacity: 0.5; font-size: 0.75rem;">#{{ lvl.position }}</span>
                                            <span class="type-label-lg" style="font-size: 0.9rem;"> {{ lvl.name }}</span>
                                            <span style="opacity: 0.5; font-size: 0.75rem;"> ({{ levelScore(lvl) }} pts)</span>
                                        </div>
                                        <button type="button" @click="moveLevel(i, -1)" :disabled="i === 0" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; font-size: 1rem; flex-shrink: 0;">▲</button>
                                        <button type="button" @click="moveLevel(i, 1)" :disabled="i === levels.length - 1" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; font-size: 1rem; flex-shrink: 0;">▼</button>
                                        <button type="button" @click="levels.splice(i, 1)" class="creator-slot-btn" aria-label="Remove level">−</button>
                                    </div>
                                    <button key="add-level-btn" type="button" @click="openLevelPicker" class="creator-add-btn">+ Add level</button>
                                </transition-group>
                            </div>

                            <button
                                type="submit"
                                class="nav__cta type-label-lg"
                                :disabled="submitting"
                                style="margin-top: 1.75rem; width: 100%; padding: 0.85rem; border: none; border-radius: 8px; cursor: pointer; background-color: #767676;"
                            >{{ submitting ? 'Creating...' : 'Create Pack' }}</button>
                        </form>
                    </template>
                </template>
            </div>

            <!-- ================= LEVEL PICKER POPUP ================= -->
            <transition name="tab-fade">
            <div v-if="levelPickerOpen" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="levelPickerOpen = false">
                <div style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Add a level</p>
                        <button @click="levelPickerOpen = false" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>

                    <input type="text" v-model="levelPickerSearch" placeholder="Search..." :style="inputStyle + ' margin-top: 0.75rem;'">

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

            <ImageCropper
                v-if="cropperOpen"
                :image-src="rawImageSrc"
                @cropped="handleCropped"
                @cancel="cropperOpen = false"
            ></ImageCropper>
        </main>
    `,
    created() {
        this.LIST_LABELS_ = LIST_LABELS;
        this.tierGradientCSS_ = tierGradientCSS;
    },
    async mounted() {
        this.authorized = await hasRole('mod', 'admin');
        this.loadingAuth = false;
        if (this.authorized) {
            await this.loadTiers();
            await this.loadLevelList(this.listType);
        }
    },
    computed: {
        autoTier() {
            return calculateAutoTier(this.estimatedPoints, this.tiers);
        },
        estimatedPoints() {
            if (this.levels.length === 0) return 0;
            const scoreFn = SCORE_FNS[this.listType];
            if (!scoreFn) return 0;
            const scores = this.levels.map((l) => scoreFn(l.position, 100, l.percentToQualify));
            return round(scores.reduce((a, b) => a + b, 0) / scores.length);
        },
        filteredLevelOptions() {
            const list = this.levelsCache[this.listType] || [];
            const q = this.levelPickerSearch.trim().toLowerCase();
            const chosenPaths = new Set(this.levels.map((l) => l.path));
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

        async selectListType(lt) {
            if (this.listType === lt) return;
            if (this.levels.length > 0 && !window.confirm('Changing the list will clear the levels you already added. Continue?')) {
                return;
            }
            this.listType = lt;
            this.levels = [];
            await this.loadLevelList(lt);
        },

        async openLevelPicker() {
            this.levelPickerOpen = true;
            this.levelPickerSearch = '';
            await this.loadLevelList(this.listType);
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
            this.levels.push({
                id: this.levelIdSeed++,
                listType: this.listType,
                path: lvl.path,
                name: lvl.name,
                position: lvl.position,
                percentToQualify: lvl.percentToQualify,
                points: 0,
            });
            this.levelPickerOpen = false;
        },
        moveLevel(index, direction) {
            const target = index + direction;
            if (target < 0 || target >= this.levels.length) return;
            const arr = this.levels;
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
                    this.error = 'Failed to upload the icon image.';
                } else {
                    const { data } = supabase.storage.from('pack-icons').getPublicUrl(filePath);
                    this.iconImageUrl = data.publicUrl;
                }
            } finally {
                this.uploadingIcon = false;
            }
        },

        async notifyStaff(type, message, link) {
            try {
                const { data: staff } = await supabase.from('profiles').select('id').in('role', ['mod', 'admin']);
                if (staff && staff.length > 0) {
                    await supabase.from('notifications').insert(staff.map((s) => ({ user_id: s.id, type, message, link })));
                }
            } catch (notifErr) {
                console.error('Failed to notify staff:', notifErr);
            }
        },

        async submitPack() {
            this.error = null;

            if (!this.name.trim()) {
                this.error = 'Please provide a pack name.';
                return;
            }
            if (!this.tagline.trim()) {
                this.error = 'Please provide a description.';
                return;
            }
            if (this.levels.length === 0) {
                this.error = 'Please add at least one level.';
                return;
            }
            const finalTierId = this.tierMode === 'auto' ? this.autoTier?.id : this.tierId;
            if (!finalTierId) {
                this.error = this.tierMode === 'auto' ? 'Could not calculate a tier — try again in a moment.' : 'Please select a tier.';
                return;
            }

            this.submitting = true;
            try {
                const { data: pack, error: insertError } = await supabase
                    .from('packs')
                    .insert({
                        owner_id: store.user.id,
                        name: this.name.trim(),
                        tagline: this.tagline.trim() || null,
                        tier_id: finalTierId,
                        tier_mode: this.tierMode,
                        list_type: this.listType,
                        icon_emoji: this.iconMode === 'emoji' ? (this.iconEmoji.trim() || null) : null,
                        icon_image_url: this.iconMode === 'image' ? (this.iconImageUrl || null) : null,
                        status: 'approved',
                        reviewer_id: store.user.id,
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;

                const { error: levelsError } = await supabase
                    .from('pack_levels')
                    .insert(this.levels.map((l, i) => ({
                        pack_id: pack.id,
                        list_type: l.listType,
                        level_path: l.path,
                        level_name: l.name,
                        points: l.points || 0,
                        sort_order: i,
                    })));

                if (levelsError) throw levelsError;

                this.success = 'Pack created and is now live!';
            } catch (err) {
                this.error = err.message || 'Something went wrong creating this pack.';
            } finally {
                this.submitting = false;
            }
        },
    },
};
