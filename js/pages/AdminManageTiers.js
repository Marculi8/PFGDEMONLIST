import { supabase, hasRole } from '../supabase.js';
import { GRADIENT_DIRECTIONS, tierGradientCSS } from '../tierGradient.js';

const inputStyle = 'width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; margin-top: 0.4rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); color: var(--color-on-background);';

// O formulário aparece duas vezes (criar novo / editar existente), com os
// mesmos campos ligados nos mesmos data() do componente — mais simples e
// seguro do que tentar extrair como sub-componente.
const FORM_BODY = `
    <label>Name</label>
    <input type="text" v-model="formName" :style="inputStyle">

    <label style="display: block; margin-top: 1rem;">Minimum Points</label>
    <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">Packs need at least this many points (auto-calculated) to reach this tier.</p>
    <input type="number" v-model.number="formMinPoints" min="0" step="1" :style="inputStyle + ' text-align: center;'">

    <label style="display: block; margin-top: 1rem;">Colors <span style="opacity: 0.5;">(2 to 5)</span></label>
    <transition-group name="creator-row-fade" tag="div" style="display: flex; gap: 0.5rem; margin-top: 0.5rem; justify-content: center; flex-wrap: wrap; position: relative;">
        <div v-for="(c, i) in formColors" :key="i" style="display: flex; flex-direction: column; align-items: center; gap: 0.3rem;">
            <input type="color" v-model="formColors[i]" style="width: 50px; height: 40px; border-radius: 8px; border: 1.5px solid var(--card-border); background: none; cursor: pointer;">
            <button v-if="formColors.length > 2" type="button" @click="removeColor(i)" style="background: none; border: none; color: var(--color-error); cursor: pointer; font-size: 0.75rem;">Remove</button>
        </div>
    </transition-group>
    <button v-if="formColors.length < 5" type="button" @click="addColor" class="creator-add-btn" style="margin-top: 0.6rem;">+ Add color</button>

    <label style="display: block; margin-top: 1rem;">Direction</label>
    <div style="display: flex; gap: 0.4rem; margin-top: 0.4rem; justify-content: center; flex-wrap: wrap;">
        <button
            v-for="d in GRADIENT_DIRECTIONS_"
            :key="d.value"
            type="button"
            @click="formDirection = d.value"
            :style="{
                fontSize: '0.8rem', padding: '0.4rem 0.75rem', borderRadius: '999px', cursor: 'pointer',
                border: '1px solid var(--card-border)',
                backgroundColor: formDirection === d.value ? 'var(--color-primary)' : 'transparent',
                color: formDirection === d.value ? 'white' : 'inherit',
            }"
        >{{ d.label }}</button>
    </div>

    <label style="display: block; margin-top: 1.25rem;">Preview</label>
    <div
        style="display: inline-block; margin-top: 0.5rem; padding: 0.4rem 1.25rem; border-radius: 999px; color: #14141a; text-shadow: 0 1px 2px rgba(255,255,255,0.35);"
        :style="{ backgroundImage: previewGradient }"
        class="type-label-lg"
    >{{ formName || 'Tier' }} Tier</div>

    <div style="display: flex; gap: 0.5rem; margin-top: 1.25rem; justify-content: center;">
        <button type="button" @click="editingId = null" style="background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer;">Cancel</button>
        <button type="button" @click="saveTier" class="login-btn" style="width: auto; padding: 0.55rem 1.1rem; margin: 0;" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save' }}
        </button>
    </div>
`;

export default {
    data: () => ({
        inputStyle,
        loading: true,
        authorized: false,
        tiers: [],
        error: null,
        feedback: null,

        editingId: null, // null = fechado, 'new' = criando, ou o id do tier em edição
        formName: '',
        formMinPoints: 0,
        formColors: ['#8a8a8a', '#e8e8e8'],
        formDirection: '135deg',
        saving: false,
        deletingId: null,
    }),
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 600px; margin: 0 auto;">

                <h1 style="text-align: center; margin-bottom: 1.5rem;">Manage Tiers</h1>

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
                        v-if="editingId === null"
                        type="button"
                        @click="openNew"
                        class="suggest-level-btn"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        <span class="type-label-lg">New Tier</span>
                    </button>

                    <transition name="collapse-fade">
                    <div v-if="editingId === 'new'" style="margin-top: 1rem; padding: 1rem; border-radius: 10px; background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%); text-align: center;">
                        <p class="type-label-lg" style="margin: 0 0 0.75rem;">New Tier</p>
                        ${FORM_BODY}
                    </div>
                    </transition>

                    <p v-if="tiers.length === 0" style="opacity: 0.6; margin-top: 1rem; text-align: center;">No tiers yet.</p>

                    <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
                    <div v-for="(t, i) in tiers" :key="t.id" class="claim-request-card" style="flex-direction: column; align-items: stretch; gap: 0.6rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex: none;">
                            <button type="button" @click="moveTier(i, 1)" :disabled="i === tiers.length - 1" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; flex-shrink: 0;">▼</button>
                            <span
                                class="type-label-lg"
                                style="flex: 1; text-align: center;"
                                :style="{
                                    display: 'inline-block', padding: '0.4rem 1rem', borderRadius: '999px',
                                    color: '#14141a', textShadow: '0 1px 2px rgba(255,255,255,0.35)',
                                    backgroundImage: tierGradientCSS_(t),
                                    margin: '0 auto',
                                }"
                            >{{ t.name }} Tier</span>
                            <button type="button" @click="moveTier(i, -1)" :disabled="i === 0" style="background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7; flex-shrink: 0;">▲</button>
                        </div>
                        <p style="opacity: 0.5; font-size: 0.8rem; margin: 0; text-align: center;">Min. {{ t.min_points || 0 }} points</p>

                        <div style="display: flex; justify-content: center; gap: 0.5rem;">
                            <button type="button" class="btn type-label-lg" style="width: auto; padding: 0.5rem 1rem;" @click="toggleEdit(t)">
                                {{ editingId === t.id ? 'Close' : 'Edit' }}
                            </button>
                            <button
                                type="button"
                                class="btn type-label-lg"
                                style="width: auto; padding: 0.5rem 1rem; background-color: var(--color-error); background-image: var(--error-gradient);"
                                :disabled="deletingId === t.id"
                                @click="deleteTier(t)"
                            >{{ deletingId === t.id ? 'Deleting...' : 'Delete' }}</button>
                        </div>

                        <transition name="collapse-fade">
                        <div v-if="editingId === t.id" style="text-align: center; border-top: 1px solid var(--card-border); padding-top: 0.85rem;">
                            ${FORM_BODY}
                        </div>
                        </transition>
                    </div>
                    </transition-group>
                </template>
            </div>
        </main>
    `,
    created() {
        this.GRADIENT_DIRECTIONS_ = GRADIENT_DIRECTIONS;
        this.tierGradientCSS_ = tierGradientCSS;
    },
    async mounted() {
        this.authorized = await hasRole('mod', 'admin');
        if (this.authorized) {
            await this.loadTiers();
        }
        this.loading = false;
    },
    computed: {
        previewGradient() {
            const colors = this.formColors.filter(Boolean);
            return `linear-gradient(${this.formDirection}, ${colors.join(', ')})`;
        },
    },
    methods: {
        async loadTiers() {
            const { data } = await supabase.from('pack_tiers').select('*').order('sort_order', { ascending: true });
            this.tiers = data || [];
        },

        openNew() {
            this.editingId = 'new';
            this.formName = '';
            this.formMinPoints = 0;
            this.formColors = ['#8a8a8a', '#e8e8e8'];
            this.formDirection = '135deg';
            this.error = null;
        },
        toggleEdit(t) {
            if (this.editingId === t.id) {
                this.editingId = null;
                return;
            }
            this.editingId = t.id;
            this.formName = t.name;
            this.formMinPoints = t.min_points || 0;
            this.formColors = [t.gradient_from, t.gradient_to, t.gradient_color_3, t.gradient_color_4, t.gradient_color_5].filter(Boolean);
            this.formDirection = t.gradient_direction || '135deg';
            this.error = null;
        },
        addColor() {
            if (this.formColors.length < 5) this.formColors.push('#ffffff');
        },
        removeColor(i) {
            if (this.formColors.length > 2) this.formColors.splice(i, 1);
        },

        async saveTier() {
            if (!this.formName.trim()) {
                this.error = 'Please provide a tier name.';
                return;
            }
            this.saving = true;
            this.error = null;
            try {
                const payload = {
                    name: this.formName.trim(),
                    min_points: this.formMinPoints || 0,
                    gradient_from: this.formColors[0],
                    gradient_to: this.formColors[1],
                    gradient_color_3: this.formColors[2] || null,
                    gradient_color_4: this.formColors[3] || null,
                    gradient_color_5: this.formColors[4] || null,
                    gradient_direction: this.formDirection,
                };

                if (this.editingId === 'new') {
                    const nextOrder = this.tiers.reduce((max, t) => Math.max(max, t.sort_order || 0), 0) + 1;
                    const { error } = await supabase.from('pack_tiers').insert({ ...payload, sort_order: nextOrder });
                    if (error) throw error;
                    this.feedback = { ok: true, message: `Created "${this.formName.trim()}".` };
                } else {
                    const { error } = await supabase.from('pack_tiers').update(payload).eq('id', this.editingId);
                    if (error) throw error;
                    this.feedback = { ok: true, message: 'Saved.' };
                }

                this.editingId = null;
                await this.loadTiers();
            } catch (err) {
                this.error = err.message || 'Something went wrong saving this tier.';
            } finally {
                this.saving = false;
                clearTimeout(this._feedbackTimeout);
                this._feedbackTimeout = setTimeout(() => { this.feedback = null; }, 4000);
            }
        },

        async moveTier(index, direction) {
            const target = index + direction;
            if (target < 0 || target >= this.tiers.length) return;

            const a = this.tiers[index];
            const b = this.tiers[target];
            [a.sort_order, b.sort_order] = [b.sort_order, a.sort_order];
            [this.tiers[index], this.tiers[target]] = [this.tiers[target], this.tiers[index]];

            await Promise.all([
                supabase.from('pack_tiers').update({ sort_order: a.sort_order }).eq('id', a.id),
                supabase.from('pack_tiers').update({ sort_order: b.sort_order }).eq('id', b.id),
            ]);
        },

        async deleteTier(t) {
            if (!window.confirm(`Delete "${t.name}"? Packs using this tier will lose their tier badge.`)) return;
            this.deletingId = t.id;
            this.error = null;

            const { error } = await supabase.from('pack_tiers').delete().eq('id', t.id);
            if (error) {
                this.feedback = { ok: false, message: 'Failed to delete tier.' };
            } else {
                this.tiers = this.tiers.filter((x) => x.id !== t.id);
                this.feedback = { ok: true, message: `Deleted "${t.name}".` };
            }
            this.deletingId = null;
            clearTimeout(this._feedbackTimeout);
            this._feedbackTimeout = setTimeout(() => { this.feedback = null; }, 4000);
        },
    },
};
