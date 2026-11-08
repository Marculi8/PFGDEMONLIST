import { supabase, hasRole } from '../supabase.js';
import { store } from '../main.js';

const LIST_LABELS = {
    classic: 'Classic',
    platformer: 'Platformer',
    challenge: 'Challenge',
    impossible: 'Impossible',
};

export default {
    data: () => ({
        loading: true,
        authorized: false,
        suggestions: [],
        tierNames: {},
        processingId: null,
        error: null,
        feedback: null,
    }),
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 800px; margin: 0 auto;">

                <h1 style="text-align: center; margin-bottom: 1.5rem;">Pack Suggestions</h1>

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

                    <p v-if="suggestions.length === 0" style="opacity: 0.6; margin-top: 1rem; text-align: center;">
                        No pending pack suggestions.
                    </p>

                    <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
                    <div v-for="sug in suggestions" :key="sug.id" class="claim-request-card" style="flex-direction: column; align-items: stretch; gap: 0.75rem;">
                        <div style="flex: none;">
                            <p class="type-label-lg" style="margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                                <span v-if="sug.icon_emoji">{{ sug.icon_emoji }}</span>
                                <img v-else-if="sug.icon_image_url" :src="sug.icon_image_url" style="width: 1.4rem; height: 1.4rem; border-radius: 50%; object-fit: cover;">
                                {{ sug.name }}
                            </p>
                            <p v-if="sug.tagline" style="opacity: 0.7; font-size: 0.85rem; margin: 0.25rem 0 0;">{{ sug.tagline }}</p>
                            <p style="opacity: 0.6; font-size: 0.85rem; margin: 0.25rem 0 0;">
                                Suggested by {{ sug.suggesterLabel || sug.owner_id }} · Tier: {{ tierNames[sug.tier_id] || '—' }}
                            </p>
                            <p style="opacity: 0.5; font-size: 0.8rem; margin: 0.25rem 0 0;">
                                {{ new Date(sug.created_at).toLocaleString() }}
                            </p>
                        </div>

                        <div class="suggestion-section">
                            <label class="type-title-sm">Levels ({{ sug.levels.length }})</label>
                            <div v-for="lvl in sug.levels" :key="lvl.id" style="display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.85rem; padding: 0.2rem 0;">
                                <span>{{ lvl.level_name }} <span style="opacity: 0.5;">({{ LIST_LABELS_[lvl.list_type] }})</span></span>
                                <span style="opacity: 0.7; flex-shrink: 0;">{{ lvl.points }} pts</span>
                            </div>
                        </div>

                        <div style="display: flex; gap: 0.5rem; justify-content: center;">
                            <button
                                class="btn type-label-lg"
                                style="width: auto; padding: 0.5rem 1rem; background-color: #00b464; background-image: none;"
                                :disabled="processingId === sug.id"
                                @click="approve(sug)"
                            >{{ processingId === sug.id ? 'Working...' : 'Approve' }}</button>
                            <button
                                class="btn type-label-lg"
                                style="width: auto; padding: 0.5rem 1rem; background-color: var(--color-error); background-image: var(--error-gradient);"
                                :disabled="processingId === sug.id"
                                @click="reject(sug)"
                            >Reject</button>
                        </div>
                    </div>
                    </transition-group>
                </template>
            </div>
        </main>
    `,
    created() {
        this.LIST_LABELS_ = LIST_LABELS;
    },
    async mounted() {
        this.authorized = await hasRole('mod', 'admin');

        if (!this.authorized) {
            this.loading = false;
            return;
        }

        await this.loadTierNames();
        await this.loadSuggestions();
        this.loading = false;
    },
    methods: {
        async loadTierNames() {
            const { data } = await supabase.from('pack_tiers').select('id, name');
            const map = {};
            (data || []).forEach((t) => { map[t.id] = t.name; });
            this.tierNames = map;
        },

        async loadSuggestions() {
            const { data, error } = await supabase
                .from('packs')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (error) {
                this.error = 'Failed to load pack suggestions.';
                return;
            }

            this.suggestions = data || [];
            if (this.suggestions.length === 0) return;

            const { data: levels } = await supabase
                .from('pack_levels')
                .select('*')
                .in('pack_id', this.suggestions.map((s) => s.id))
                .order('sort_order', { ascending: true });

            this.suggestions.forEach((sug) => {
                sug.levels = (levels || []).filter((l) => l.pack_id === sug.id);
            });

            const userIds = [...new Set(this.suggestions.map((s) => s.owner_id))];
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, username, list_name')
                    .in('id', userIds);

                const profileMap = {};
                (profiles || []).forEach((p) => { profileMap[p.id] = p; });

                this.suggestions.forEach((sug) => {
                    const p = profileMap[sug.owner_id];
                    sug.suggesterLabel = p ? (p.list_name ? `${p.list_name} (${p.username})` : p.username) : sug.owner_id;
                });
            }
        },

        async approve(sug) {
            this.processingId = sug.id;
            this.error = null;
            this.feedback = null;

            const { error: updateError } = await supabase
                .from('packs')
                .update({ status: 'approved', reviewer_id: store.user.id, updated_at: new Date().toISOString() })
                .eq('id', sug.id);

            if (updateError) {
                this.feedback = { ok: false, message: 'Failed to approve pack.' };
                this.processingId = null;
                return;
            }

            await supabase.from('notifications').insert({
                user_id: sug.owner_id,
                type: 'pack_suggestion_approved',
                message: `Your pack "${sug.name}" was approved and is now live!`,
                link: '/packs',
            });

            this.feedback = { ok: true, message: `Approved "${sug.name}" — it's now live on Packs.` };
            this.suggestions = this.suggestions.filter((s) => s.id !== sug.id);
            this.processingId = null;
            clearTimeout(this._feedbackTimeout);
            this._feedbackTimeout = setTimeout(() => { this.feedback = null; }, 4000);
        },

        async reject(sug) {
            const reason = window.prompt('Reason for rejecting this pack (shown to whoever suggested it):');
            if (reason === null) return;

            this.processingId = sug.id;
            this.error = null;
            this.feedback = null;

            const { error: updateError } = await supabase
                .from('packs')
                .update({ status: 'rejected', reviewer_id: store.user.id, reject_reason: reason || null, updated_at: new Date().toISOString() })
                .eq('id', sug.id);

            if (updateError) {
                this.feedback = { ok: false, message: 'Failed to reject pack.' };
                this.processingId = null;
                return;
            }

            await supabase.from('notifications').insert({
                user_id: sug.owner_id,
                type: 'pack_suggestion_rejected',
                message: reason ? `Your pack "${sug.name}" was rejected: ${reason}` : `Your pack "${sug.name}" was rejected.`,
                link: '/packs/new',
            });

            this.feedback = { ok: true, message: `Rejected "${sug.name}".` };
            this.suggestions = this.suggestions.filter((s) => s.id !== sug.id);
            this.processingId = null;
            clearTimeout(this._feedbackTimeout);
            this._feedbackTimeout = setTimeout(() => { this.feedback = null; }, 4000);
        },
    },
};
