import { supabase, hasRole } from '../supabase.js';
import { store } from '../main.js';

const TARGET_LABELS = {
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
        processingId: null,
        error: null,
        feedback: null,
    }),
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 800px; margin: 0 auto;">

                <h1 style="text-align: center; margin-bottom: 1.5rem;">Project Suggestions</h1>

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
                        No pending project suggestions.
                    </p>

                    <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
                    <div v-for="sug in suggestions" :key="sug.id" class="claim-request-card" style="flex-direction: column; align-items: stretch; gap: 0.75rem;">
                        <div style="flex: none;">
                            <p class="type-label-lg" style="margin: 0;">
                                {{ sug.name }}
                            </p>
                            <p style="opacity: 0.6; font-size: 0.85rem; margin: 0.25rem 0 0;">
                                Suggested by {{ sug.suggesterLabel || sug.owner_id }}
                            </p>
                            <p style="opacity: 0.5; font-size: 0.8rem; margin: 0.25rem 0 0;">
                                {{ new Date(sug.created_at).toLocaleString() }}
                            </p>
                        </div>

                        <div class="suggestion-section" style="font-size: 0.9rem; line-height: 1.6;">
                            <div><strong>Destination:</strong> {{ TARGET_LABELS_[sug.target_list_type] }}</div>
                            <div><strong>Host:</strong> {{ sug.host_name }}</div>
                            <div><strong>Creators:</strong> {{ (sug.creators || []).join(', ') || '—' }}</div>
                        </div>

                        <div v-if="sug.description" class="suggestion-section">
                            <label class="type-title-sm">Description</label>
                            <textarea
                                readonly
                                :value="sug.description"
                                style="display: block; width: 100%; box-sizing: border-box; margin-top: 0.4rem; min-height: 4rem; padding: 0.65rem 0.85rem; border-radius: 8px; border: 2px solid #000; background-color: var(--card-bg); color: var(--color-on-background); font: inherit; resize: vertical;"
                            ></textarea>
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
        this.TARGET_LABELS_ = TARGET_LABELS;
    },
    async mounted() {
        this.authorized = await hasRole('mod', 'admin');

        if (!this.authorized) {
            this.loading = false;
            return;
        }

        await this.loadSuggestions();
        this.loading = false;
    },
    methods: {
        async loadSuggestions() {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (error) {
                this.error = 'Failed to load project suggestions.';
                return;
            }

            this.suggestions = data || [];

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
                    sug.suggesterLabel = p
                        ? (p.list_name ? `${p.list_name} (${p.username})` : p.username)
                        : sug.owner_id;
                });
            }
        },

        async approve(sug) {
            this.processingId = sug.id;
            this.error = null;
            this.feedback = null;

            const { error: updateError } = await supabase
                .from('projects')
                .update({
                    status: 'approved',
                    reviewer_id: store.user.id,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', sug.id);

            if (updateError) {
                this.showFeedback(false, 'Failed to approve project.');
                this.processingId = null;
                return;
            }

            const { error: notifError } = await supabase.from('notifications').insert({
                user_id: sug.owner_id,
                type: 'project_suggestion_approved',
                message: `Your project "${sug.name}" was approved and is now live!`,
                link: '/projects',
            });
            if (notifError) console.error('Notification insert failed:', notifError);

            this.showFeedback(true, `Approved "${sug.name}" — it's now live on Projects.`);
            await this.loadSuggestions();
            this.processingId = null;
        },

        async reject(sug) {
            const reason = window.prompt('Reason for rejecting this project (shown to the host):');
            if (reason === null) return; // cancelled

            this.processingId = sug.id;
            this.error = null;
            this.feedback = null;

            const { error: updateError } = await supabase
                .from('projects')
                .update({
                    status: 'rejected',
                    reviewer_id: store.user.id,
                    reject_reason: reason || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', sug.id);

            if (updateError) {
                this.showFeedback(false, 'Failed to reject project.');
                this.processingId = null;
                return;
            }

            const { error: notifError } = await supabase.from('notifications').insert({
                user_id: sug.owner_id,
                type: 'project_suggestion_rejected',
                message: reason
                    ? `Your project "${sug.name}" was rejected: ${reason}`
                    : `Your project "${sug.name}" was rejected.`,
                link: '/projects/new',
            });
            if (notifError) console.error('Notification insert failed:', notifError);

            this.showFeedback(true, `Rejected "${sug.name}".`);
            await this.loadSuggestions();
            this.processingId = null;
        },

        showFeedback(ok, message) {
            this.feedback = { ok, message };
            clearTimeout(this._feedbackTimeout);
            this._feedbackTimeout = setTimeout(() => {
                this.feedback = null;
            }, 4000);
        },
    },
};
