import { supabase, hasRole } from '../supabase.js';
import { store } from '../main.js';
import { embed, getYoutubeIdFromUrl } from '../util.js';

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
        submissions: [],
        processingId: null,
        error: null,
        feedback: null,
    }),
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 800px; margin: 0 auto;">

                <h1 style="text-align: center; margin-bottom: 1.5rem;">Submissions</h1>

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

                    <p v-if="submissions.length === 0" style="opacity: 0.6; margin-top: 1rem; text-align: center;">
                        No pending submissions.
                    </p>

                    <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
                    <div v-for="sub in submissions" :key="sub.id" class="claim-request-card" style="flex-direction: column; align-items: stretch; gap: 0.75rem;">
                        <div style="flex: none;">
                            <p class="type-label-lg" style="margin: 0;">
                                {{ LIST_LABELS_[sub.list_type] }} — {{ sub.level_name }}
                            </p>
                            <p style="opacity: 0.6; font-size: 0.85rem; margin: 0.25rem 0 0;">
                                Submitted by {{ sub.submitterLabel || sub.user_id }}
                            </p>
                            <p style="opacity: 0.5; font-size: 0.8rem; margin: 0.25rem 0 0;">
                                {{ new Date(sub.created_at).toLocaleString() }}
                            </p>
                        </div>

                        <div class="suggestion-section">
                            <div style="font-size: 0.9rem; line-height: 1.6;">
                                <strong>Video:</strong>
                                <a :href="sub.completion_link" target="_blank" rel="noopener" style="color: inherit;">{{ sub.completion_link }}</a>
                            </div>
                            <div class="video-preview-box" style="margin-top: 0.5rem;">
                                <iframe
                                    v-if="getYoutubeIdFromUrl(sub.completion_link)"
                                    :src="embed(sub.completion_link)"
                                    frameborder="0"
                                    allowfullscreen
                                ></iframe>
                                <p v-else style="opacity: 0.4; font-size: 0.85rem; padding: 0 1rem; text-align: center;">
                                    Couldn't find a video for that link
                                </p>
                            </div>
                        </div>

                        <div class="suggestion-section" style="font-size: 0.9rem; line-height: 1.6;">
                            <div><strong>Percent:</strong> {{ sub.percent }}%</div>
                            <div><strong>Hz:</strong> {{ sub.hz }}</div>
                            <div v-if="sub.enjoyment !== null && sub.enjoyment !== undefined"><strong>Enjoyment:</strong> {{ sub.enjoyment }}</div>
                            <div v-if="sub.raw_footage">
                                <strong>Raw footage:</strong>
                                <a :href="sub.raw_footage" target="_blank" rel="noopener" style="color: inherit;">{{ sub.raw_footage }}</a>
                            </div>
                        </div>

                        <div v-if="sub.notes" class="suggestion-section">
                            <label class="type-title-sm">Notes</label>
                            <textarea
                                readonly
                                :value="sub.notes"
                                style="display: block; width: 100%; box-sizing: border-box; margin-top: 0.4rem; min-height: 5rem; padding: 0.65rem 0.85rem; border-radius: 8px; border: 2px solid #000; background-color: var(--card-bg); color: var(--color-on-background); font: inherit; resize: vertical;"
                            ></textarea>
                        </div>

                        <div style="display: flex; gap: 0.5rem; justify-content: center;">
                            <button
                                class="login-btn"
                                style="width: auto; padding: 0.5rem 1rem; background-color: #00b464;"
                                :disabled="processingId === sub.id"
                                @click="approve(sub)"
                            >{{ processingId === sub.id ? 'Working...' : 'Approve' }}</button>
                            <button
                                class="login-btn"
                                style="width: auto; padding: 0.5rem 1rem; background-color: var(--color-error);"
                                :disabled="processingId === sub.id"
                                @click="reject(sub)"
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
        this.embed = embed;
        this.getYoutubeIdFromUrl = getYoutubeIdFromUrl;
    },
    async mounted() {
        this.authorized = await hasRole('mod', 'admin');

        if (!this.authorized) {
            this.loading = false;
            return;
        }

        await this.loadSubmissions();
        this.loading = false;
    },
    methods: {
        async loadSubmissions() {
            const { data, error } = await supabase
                .from('submissions')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (error) {
                this.error = 'Failed to load submissions.';
                return;
            }

            this.submissions = data || [];

            const userIds = [...new Set(this.submissions.map((s) => s.user_id))];
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, username, list_name')
                    .in('id', userIds);

                const profileMap = {};
                (profiles || []).forEach((p) => { profileMap[p.id] = p; });

                this.submissions.forEach((sub) => {
                    const p = profileMap[sub.user_id];
                    sub.submitterLabel = p
                        ? (p.list_name ? `${p.list_name} (${p.username})` : p.username)
                        : sub.user_id;
                });
            }
        },

        async approve(sub) {
            this.processingId = sub.id;
            this.error = null;
            this.feedback = null;

            try {
                const { data: { session } } = await supabase.auth.getSession();

                const res = await fetch('/api/approve-submission', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ submissionId: sub.id }),
                });

                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.error || 'Failed to approve submission.');
                }

                this.showFeedback(true, `Approved "${sub.level_name}" and pushed the record to GitHub.`);
                await this.loadSubmissions();
            } catch (err) {
                this.showFeedback(false, err.message);
            } finally {
                this.processingId = null;
            }
        },

        async reject(sub) {
            const reason = window.prompt('Reason for rejecting this submission (shown to the player):');
            if (reason === null) return; // cancelled

            this.processingId = sub.id;
            this.error = null;
            this.feedback = null;

            const { error: updateError } = await supabase
                .from('submissions')
                .update({
                    status: 'rejected',
                    reviewer_id: store.user.id,
                    reject_reason: reason || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', sub.id);

            if (updateError) {
                this.showFeedback(false, 'Failed to reject submission.');
                this.processingId = null;
                return;
            }

            await supabase.from('submission_history').insert({
                submission_id: sub.id,
                changed_by: store.user.id,
                status: 'rejected',
                notes: reason || null,
            });

            const { error: notifError } = await supabase.from('notifications').insert({
                user_id: sub.user_id,
                type: 'submission_rejected',
                message: reason
                    ? `Your submission for "${sub.level_name}" was rejected: ${reason}`
                    : `Your submission for "${sub.level_name}" was rejected.`,
                link: '/submit',
            });
            if (notifError) console.error('Notification insert failed:', notifError);

            this.showFeedback(true, `Rejected "${sub.level_name}".`);
            await this.loadSubmissions();
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
