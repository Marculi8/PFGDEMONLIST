import { supabase, hasRole } from '../supabase.js';
import { store } from '../main.js';
import { fetchList, fetchPlatformerList, fetchChallengeList, fetchImpossibleList } from '../content.js';
import { embed, getYoutubeIdFromUrl } from '../util.js';

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

export default {
    data: () => ({
        loading: true,
        authorized: false,
        suggestions: [],
        positionOverrides: {},
        expandedPositionId: null,
        levelsCache: {},
        levelsLoading: false,
        processingId: null,
        error: null,
        feedback: null,
    }),
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 800px; margin: 0 auto;">

                <h1 style="text-align: center; margin-bottom: 1.5rem;">Level Suggestions</h1>

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
                        No pending level suggestions.
                    </p>

                    <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
                    <div v-for="sug in suggestions" :key="sug.id" class="claim-request-card" style="flex-direction: column; align-items: stretch; gap: 0.75rem;">
                        <div style="flex: none;">
                            <p class="type-label-lg" style="margin: 0;">
                                {{ LIST_LABELS_[sug.list_type] }} — {{ sug.name }}
                            </p>
                            <p style="opacity: 0.6; font-size: 0.85rem; margin: 0.25rem 0 0;">
                                Suggested by {{ sug.suggesterLabel || sug.user_id }}
                            </p>
                            <p style="opacity: 0.5; font-size: 0.8rem; margin: 0.25rem 0 0;">
                                {{ new Date(sug.created_at).toLocaleString() }}
                            </p>
                        </div>

                        <!-- Vídeo (showcase/verificação) + preview -->
                        <div class="suggestion-section">
                            <div style="font-size: 0.9rem; line-height: 1.6;">
                                <strong>{{ sug.list_type === 'impossible' ? 'Showcase' : 'Verification' }} Video:</strong>
                                <a :href="sug.verification_link || sug.showcase_link" target="_blank" rel="noopener" style="color: inherit;">{{ sug.verification_link || sug.showcase_link }}</a>
                            </div>
                            <div class="video-preview-box" style="margin-top: 0.5rem;">
                                <iframe
                                    v-if="getYoutubeIdFromUrl(sug.verification_link || sug.showcase_link)"
                                    :src="embed(sug.verification_link || sug.showcase_link)"
                                    frameborder="0"
                                    allowfullscreen
                                ></iframe>
                                <p v-else style="opacity: 0.4; font-size: 0.85rem; padding: 0 1rem; text-align: center;">
                                    Couldn't find a video for that link
                                </p>
                            </div>
                        </div>

                        <div class="suggestion-section" style="font-size: 0.9rem; line-height: 1.6;">
                            <div><strong>Path:</strong> {{ sug.path }}</div>
                            <div><strong>Level ID:</strong> {{ sug.level_id }}</div>
                        </div>

                        <div class="suggestion-section" style="font-size: 0.9rem; line-height: 1.6;">
                            <div><strong>Author:</strong> {{ sug.author }}</div>
                            <div><strong>Creators:</strong> {{ (sug.creators || []).join(', ') }}</div>
                            <div v-if="sug.list_type !== 'impossible'"><strong>Verifier:</strong> {{ sug.verifier || '—' }}</div>
                            <div v-if="sug.percent_to_qualify"><strong>% To Qualify:</strong> {{ sug.percent_to_qualify }}</div>
                            <div><strong>Password:</strong> {{ sug.password }}</div>
                        </div>

                        <!-- Notes: caixa não-editável, borda preta -->
                        <div v-if="sug.notes" class="suggestion-section">
                            <label class="type-title-sm">Notes</label>
                            <textarea
                                readonly
                                :value="sug.notes"
                                style="display: block; width: 100%; box-sizing: border-box; margin-top: 0.4rem; min-height: 5rem; padding: 0.65rem 0.85rem; border-radius: 8px; border: 2px solid #000; background-color: var(--card-bg); color: var(--color-on-background); font: inherit; resize: vertical;"
                            ></textarea>
                        </div>

                        <!-- Position to insert -->
                        <div style="margin-top: 0.5rem;">
                            <label class="type-title-sm">Position to insert at</label><br>
                            <input
                                type="number"
                                min="1"
                                v-model.number="positionOverrides[sug.id]"
                                class="login-input"
                                style="width: 120px; margin-top: 0.3rem;"
                                @focus="showPositionList(sug)"
                            >
                            <span style="opacity: 0.5; font-size: 0.8rem; margin-left: 0.5rem;">Suggested: #{{ sug.suggested_position }}</span>
                            <button
                                type="button"
                                @click="showPositionList(sug)"
                                style="background: none; border: none; color: inherit; opacity: 0.6; font-size: 0.8rem; cursor: pointer; margin-left: 0.5rem; text-decoration: underline;"
                            >{{ expandedPositionId === sug.id ? 'Hide list' : 'Show list' }}</button>

                            <div
                                v-if="expandedPositionId === sug.id"
                                style="margin-top: 0.6rem; max-height: 220px; overflow-y: auto; border: 1.5px solid var(--color-primary); border-radius: 8px; padding: 0.5rem 0.75rem; background-color: var(--color-background);"
                            >
                                <p v-if="levelsLoading" style="opacity: 0.6; margin: 0;">Loading current list...</p>
                                <div
                                    v-for="(lvl, i) in (levelsCache[sug.list_type] || [])"
                                    :key="lvl.path"
                                    style="display: flex; gap: 0.5rem; padding: 0.15rem 0; font-size: 0.85rem;"
                                    :style="{ fontWeight: (i + 1) === positionOverrides[sug.id] ? '700' : '400', color: (i + 1) === positionOverrides[sug.id] ? 'var(--color-primary)' : 'inherit' }"
                                >
                                    <span style="opacity: 0.6; min-width: 2rem; flex-shrink: 0;">#{{ i + 1 }}</span>
                                    <span style="min-width: 0; overflow-wrap: break-word;">{{ lvl.name }}</span>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 0.5rem; justify-content: center;">
                            <button
                                class="login-btn"
                                style="width: auto; padding: 0.5rem 1rem; background-color: #00b464;"
                                :disabled="processingId === sug.id"
                                @click="approve(sug)"
                            >{{ processingId === sug.id ? 'Working...' : 'Approve' }}</button>
                            <button
                                class="login-btn"
                                style="width: auto; padding: 0.5rem 1rem; background-color: var(--color-error);"
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
        this.embed = embed;
        this.getYoutubeIdFromUrl = getYoutubeIdFromUrl;
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
                .from('level_suggestions')
                .select('*')
                .eq('status', 'pending')
                .neq('list_type', 'verifications')
                .order('created_at', { ascending: true });

            if (error) {
                this.error = 'Failed to load level suggestions.';
                return;
            }

            this.suggestions = data || [];
            this.suggestions.forEach((sug) => {
                if (!(sug.id in this.positionOverrides)) {
                    this.positionOverrides[sug.id] = sug.suggested_position;
                }
            });

            const userIds = [...new Set(this.suggestions.map((s) => s.user_id))];
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, username, list_name')
                    .in('id', userIds);

                const profileMap = {};
                (profiles || []).forEach((p) => { profileMap[p.id] = p; });

                this.suggestions.forEach((sug) => {
                    const p = profileMap[sug.user_id];
                    sug.suggesterLabel = p
                        ? (p.list_name ? `${p.list_name} (${p.username})` : p.username)
                        : sug.user_id;
                });
            }
        },

        async showPositionList(sug) {
            this.expandedPositionId = this.expandedPositionId === sug.id ? null : sug.id;
            if (this.expandedPositionId === null) return;

            if (this.levelsCache[sug.list_type]) return; // já carregado

            this.levelsLoading = true;
            try {
                const fetcher = LIST_FETCHERS[sug.list_type];
                const result = await fetcher();
                this.levelsCache[sug.list_type] = (result || [])
                    .filter(([level]) => level !== null)
                    .map(([level]) => ({ path: level.path, name: level.name }));
            } finally {
                this.levelsLoading = false;
            }
        },

        async approve(sug) {
            this.processingId = sug.id;
            this.error = null;
            this.feedback = null;

            try {
                const { data: { session } } = await supabase.auth.getSession();

                const res = await fetch('/api/approve-level-suggestion', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        suggestionId: sug.id,
                        position: this.positionOverrides[sug.id],
                    }),
                });

                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.error || 'Failed to approve suggestion.');
                }

                this.showFeedback(true, `Approved "${sug.name}" at position #${result.position}.`);
                await this.loadSuggestions();
            } catch (err) {
                this.showFeedback(false, err.message);
            } finally {
                this.processingId = null;
            }
        },

        async reject(sug) {
            const reason = window.prompt('Reason for rejecting this suggestion (shown to the player):');
            if (reason === null) return; // cancelled

            this.processingId = sug.id;
            this.error = null;
            this.feedback = null;

            const { error: updateError } = await supabase
                .from('level_suggestions')
                .update({
                    status: 'rejected',
                    reviewer_id: store.user.id,
                    reject_reason: reason || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', sug.id);

            if (updateError) {
                this.showFeedback(false, 'Failed to reject suggestion.');
                this.processingId = null;
                return;
            }

            const { error: notifError } = await supabase.from('notifications').insert({
                user_id: sug.user_id,
                type: 'level_suggestion_rejected',
                message: reason
                    ? `Your level suggestion "${sug.name}" was rejected: ${reason}`
                    : `Your level suggestion "${sug.name}" was rejected.`,
                link: '/submit',
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
