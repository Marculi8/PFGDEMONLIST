import { supabase, hasRole } from '../supabase.js';
import { store } from '../main.js';

export default {
    data: () => ({
        loading: true,
        authorized: false,
        requests: [],
        processingId: null,
        error: null,
        feedback: null,
    }),
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 700px; margin: 0 auto;">

                <h1 style="text-align: center; margin-bottom: 1.5rem;">Claim Requests</h1>

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

                    <p v-if="requests.length === 0" style="opacity: 0.6; margin-top: 1rem; text-align: center;">
                        No pending claim requests.
                    </p>

                    <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
                    <div v-for="req in requests" :key="req.id" class="claim-request-card">
                        <div>
                            <p class="type-label-lg" style="margin: 0;">{{ req.list_name }}</p>
                            <p style="opacity: 0.6; font-size: 0.85rem; margin: 0.25rem 0 0;">
                                Requested by {{ req.requesterLabel || req.user_id }}
                            </p>
                            <p style="opacity: 0.5; font-size: 0.8rem; margin: 0.25rem 0 0;">
                                {{ new Date(req.created_at).toLocaleString() }}
                            </p>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button
                                class="login-btn"
                                style="width: auto; padding: 0.5rem 1rem; background-color: #00b464;"
                                :disabled="processingId === req.id"
                                @click="approve(req)"
                            >Approve</button>
                            <button
                                class="login-btn"
                                style="width: auto; padding: 0.5rem 1rem; background-color: var(--color-error);"
                                :disabled="processingId === req.id"
                                @click="reject(req)"
                            >Reject</button>
                        </div>
                    </div>
                    </transition-group>
                </template>
            </div>
        </main>
    `,
    async mounted() {
        this.authorized = await hasRole('mod', 'admin');

        if (!this.authorized) {
            this.loading = false;
            return;
        }

        await this.loadRequests();
        this.loading = false;
    },
    methods: {
        async loadRequests() {
            const { data, error } = await supabase
                .from('claim_requests')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true });

            if (error) {
                this.error = 'Failed to load requests.';
                return;
            }

            this.requests = data || [];

            const userIds = [...new Set(this.requests.map((r) => r.user_id))];
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, username, list_name')
                    .in('id', userIds);

                const profileMap = {};
                (profiles || []).forEach((p) => { profileMap[p.id] = p; });

                this.requests.forEach((req) => {
                    const p = profileMap[req.user_id];
                    req.requesterLabel = p
                        ? (p.list_name ? `${p.list_name} (${p.username})` : p.username)
                        : req.user_id;
                });
            }
        },

        async approve(req) {
            this.processingId = req.id;
            this.error = null;
            this.feedback = null;

            try {
                const { data: { session } } = await supabase.auth.getSession();

                const res = await fetch('/api/approve-claim', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ requestId: req.id }),
                });

                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.error || 'Failed to approve claim.');
                }

                this.feedback = { ok: true, message: `Linked "${req.list_name}" to their account.` };
                await this.loadRequests();
            } catch (err) {
                this.feedback = { ok: false, message: err.message };
            } finally {
                this.processingId = null;
            }
        },

        async reject(req) {
            this.processingId = req.id;
            this.feedback = null;

            await supabase
                .from('claim_requests')
                .update({
                    status: 'rejected',
                    reviewed_by: store.user.id,
                    reviewed_at: new Date().toISOString(),
                })
                .eq('id', req.id);

            const { error: notifError } = await supabase.from('notifications').insert({
                user_id: req.user_id,
                type: 'claim_rejected',
                message: `Your claim for "${req.list_name}" was rejected.`,
                link: '/claim',
            });
            if (notifError) console.error('Notification insert failed:', notifError);

            this.feedback = { ok: true, message: `Rejected claim for "${req.list_name}".` };
            await this.loadRequests();
            this.processingId = null;
        },
    },
};
