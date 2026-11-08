import { supabase } from '../supabase.js';
import { store } from '../main.js';
import { embed, getYoutubeIdFromUrl } from '../util.js';
import {
    fetchList,
    fetchPlatformerList,
    fetchChallengeList,
    fetchImpossibleList,
} from '../content.js';

const LIST_FETCHERS = {
    classic: fetchList,
    platformer: fetchPlatformerList,
    challenge: fetchChallengeList,
    impossible: fetchImpossibleList,
};

const LIST_LABELS = {
    classic: 'Classic',
    platformer: 'Platformer',
    challenge: 'Challenge',
    impossible: 'Impossible',
};

const inputStyle = 'width: 100%; padding: 0.65rem 0.85rem; margin-top: 0.4rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); color: var(--color-on-background);';

export default {
    data: () => ({
        store,
        inputStyle,

        listType: 'classic',
        listMenuOpen: false,
        levels: [],
        levelsLoading: false,
        levelsCache: {},

        selectedLevel: '',
        levelPickerOpen: false,
        levelPickerSearch: '',
        completionLink: '',
        percent: 100,
        enjoyment: null,
        hz: '',
        rawFootage: '',
        notes: '',

        submitting: false,
        error: null,
        success: null,
    }),
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 600px; margin: 0 auto;">

                <h1 style="text-align: center;">Submit Record</h1>

                <div v-if="!store.user" class="login-alert login-alert-error">
                    You need to <router-link to="/login" style="color: inherit; text-decoration: underline;">log in</router-link> first.
                </div>

                <template v-else>
                    <transition name="alert-fade"><div v-if="error" class="login-alert login-alert-error">{{ error }}</div></transition>
                    <transition name="alert-fade"><div v-if="success" class="login-alert login-alert-success">{{ success }}</div></transition>

                    <template v-if="!success">
                        <div style="position: relative; margin-top: 1rem;">
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
                                    v-for="type in Object.keys(LIST_LABELS_)"
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

                        <form @submit.prevent="submit" class="add-level-form-card">
                            <div style="padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;">
                                <label for="level">Level</label><br>
                                <button
                                    id="level"
                                    type="button"
                                    class="list-tab"
                                    @click="levelPickerOpen = true; levelPickerSearch = '';"
                                    :style="inputStyle + ' display: flex; align-items: center; cursor: pointer; text-align: left;'"
                                >
                                    <span style="flex: 1;">{{ selectedLevel ? levelLabel(selectedLevel) : (levelsLoading ? 'Loading levels...' : 'Select a level') }}</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;"><path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                                </button>

                                <label style="display: block; margin-top: 1.25rem;">Video Link</label>
                                <input id="completionLink" type="text" v-model="completionLink" required placeholder="https://youtu.be/..." :style="inputStyle">
                                <transition name="collapse-fade">
                                    <div v-if="getYoutubeIdFromUrl(completionLink)" class="video-preview-box" style="margin-top: 0.5rem;">
                                        <iframe :src="embed(completionLink)" frameborder="0" allowfullscreen></iframe>
                                    </div>
                                </transition>
                            </div>

                            <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;">
                                <div style="display: flex; flex-wrap: wrap; gap: 1.25rem;">
                                    <div style="flex: 1 1 130px; min-width: 0;">
                                        <label for="percent">Percent</label><br>
                                        <input id="percent" type="number" v-model.number="percent" required min="1" max="100" step="1" :style="inputStyle">
                                    </div>
                                    <div style="flex: 1 1 130px; min-width: 0;">
                                        <label for="hz">Hz</label><br>
                                        <input id="hz" type="number" v-model.number="hz" required min="30" step="1" placeholder="e.g. 240" :style="inputStyle">
                                    </div>
                                </div>

                                <transition name="collapse-fade">
                                <div v-if="percent === 100" style="margin-top: 1.25rem;">
                                    <label for="enjoyment">Enjoyment (0-100) <span style="opacity: 0.5;">(optional)</span></label><br>
                                    <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">How much did you enjoy this level? Leave blank if you're not sure — it won't affect the average. Can't be changed later without a staff member's help.</p>
                                    <input id="enjoyment" type="number" v-model.number="enjoyment" min="0" max="100" step="1" :style="inputStyle + ' margin-top: 0.4rem;'">
                                </div>
                                </transition>

                                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--form-border-gray);">
                                    <label for="rawFootage">Raw Footage <span style="opacity: 0.5;">(optional)</span></label><br>
                                    <input id="rawFootage" type="text" v-model="rawFootage" placeholder="Drive / Mega link" :style="inputStyle">
                                </div>
                            </div>

                            <div style="margin-top: 1.25rem;">
                                <label for="notes">Notes <span style="opacity: 0.5;">(optional)</span></label><br>
                                <textarea id="notes" v-model="notes" rows="3" :style="inputStyle + ' resize: vertical; font-family: inherit;'"></textarea>
                            </div>

                            <button
                                type="submit"
                                class="nav__cta type-label-lg"
                                :disabled="submitting"
                                style="margin-top: 1.75rem; width: 100%; padding: 0.85rem; border: none; border-radius: 8px; cursor: pointer; background-color: #767676;"
                            >{{ submitting ? 'Submitting...' : 'Submit Record' }}</button>
                        </form>
                    </template>
                </template>

            </div>

            <!-- ================= LEVEL PICKER POPUP ================= -->
            <transition name="tab-fade">
            <div v-if="levelPickerOpen" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="levelPickerOpen = false">
                <div style="background-color: var(--color-background); border: 1px solid var(--color-background-hover); border-radius: 12px; width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Select a level</p>
                        <button @click="levelPickerOpen = false" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>

                    <input type="text" v-model="levelPickerSearch" placeholder="Search..." :style="inputStyle + ' margin-top: 0.75rem;'">

                    <div style="overflow-y: auto; margin-top: 0.75rem; padding-top: 0.2rem; flex: 1;">
                        <p v-if="levelsLoading" style="opacity: 0.5; font-size: 0.85rem;">Loading...</p>
                        <button
                            v-for="lvl in filteredLevelsForPicker"
                            :key="lvl.path"
                            type="button"
                            @click="selectedLevel = lvl.path; levelPickerOpen = false;"
                            style="display: flex; gap: 0.5rem; align-items: baseline; width: 100%; text-align: left; padding: 0.5rem 0.6rem; border: none; background: none; color: inherit; cursor: pointer; border-radius: 6px;"
                            onmouseover="this.style.backgroundColor='var(--color-background-hover)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                        ><span style="opacity: 0.5; font-size: 0.8rem; flex-shrink: 0;">#{{ lvl.position }}</span><span>{{ lvl.name }}</span></button>
                        <p v-if="!levelsLoading && filteredLevelsForPicker.length === 0" style="opacity: 0.4; font-size: 0.85rem;">No matches.</p>
                    </div>
                </div>
            </div>
            </transition>
        </main>
    `,
    created() {
        this.LIST_LABELS_ = LIST_LABELS;
        this.embed = embed;
        this.getYoutubeIdFromUrl = getYoutubeIdFromUrl;
    },
    async mounted() {
        await this.loadLevels(this.listType);
    },
    computed: {
        filteredLevelsForPicker() {
            const q = this.levelPickerSearch.trim().toLowerCase();
            if (!q) return this.levels;
            return this.levels.filter((lvl) => lvl.name.toLowerCase().includes(q));
        },
    },
    methods: {
        levelLabel(path) {
            const lvl = this.levels.find((l) => l.path === path);
            return lvl ? `#${lvl.position} — ${lvl.name}` : 'Select a level';
        },
        async selectListType(type) {
            if (this.listType === type) return;
            this.listType = type;
            this.selectedLevel = '';
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
                const levels = (result || [])
                    .filter(([level]) => level !== null)
                    .map(([level], i) => ({ path: level.path, name: level.name, position: i + 1 }));
                this.levelsCache[type] = levels;
                this.levels = levels;
            } catch (err) {
                this.error = 'Failed to load levels. Please try again.';
            } finally {
                this.levelsLoading = false;
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
        async submit() {
            this.error = null;

            if (!this.selectedLevel) {
                this.error = 'Please select a level.';
                return;
            }
            if (!this.completionLink.trim()) {
                this.error = 'Please provide a video link.';
                return;
            }
            if (!this.percent || this.percent < 1 || this.percent > 100) {
                this.error = 'Percent must be between 1 and 100.';
                return;
            }
            if (!this.hz || this.hz < 1 || !Number.isInteger(this.hz)) {
                this.error = 'Hz must be a whole number.';
                return;
            }
            if (this.enjoyment !== null && this.enjoyment !== '' && (this.enjoyment < 0 || this.enjoyment > 100)) {
                this.error = 'Enjoyment must be between 0 and 100.';
                return;
            }

            this.submitting = true;
            try {
                const { data: submission, error: insertError } = await supabase
                    .from('submissions')
                    .insert({
                        user_id: store.user.id,
                        list_type: this.listType,
                        level_name: this.selectedLevel,
                        completion_link: this.completionLink.trim(),
                        percent: this.percent,
                        hz: this.hz,
                        enjoyment: this.percent === 100 && this.enjoyment !== null && this.enjoyment !== '' ? this.enjoyment : null,
                        raw_footage: this.rawFootage.trim() || null,
                        notes: this.notes.trim() || null,
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;

                await supabase.from('submission_history').insert({
                    submission_id: submission.id,
                    changed_by: store.user.id,
                    status: 'pending',
                    notes: 'Submission created.',
                });

                const levelDisplayName = this.levels.find((l) => l.path === this.selectedLevel)?.name || this.selectedLevel;
                await this.notifyStaff(
                    'new_submission',
                    `New submission: ${levelDisplayName} (${this.percent}%)`,
                    '/admin/submissions',
                );

                this.success = 'Your submission was sent! Mods will review it soon.';
            } catch (err) {
                this.error = err.message || 'Something went wrong submitting your record.';
            } finally {
                this.submitting = false;
            }
        },
    },
};
