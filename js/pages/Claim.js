import { supabase } from '../supabase.js';
import { store } from '../main.js';
import {
    fetchLeaderboard,
    fetchPlatformerLeaderboard,
    fetchChallengeLeaderboard,
    fetchImpossibleLeaderboard,
} from '../content.js';

export default {
    data: () => ({
        store, // ✅ precisa ser exposto aqui para o template acessar
        loading: true,
        search: '',
        availableNames: [],
        myRequest: null,
        selected: null,
        submitting: false,
        error: null,
        success: null,
    }),
    template: `
        <main class="page-list">
            <div class="claim-container" style="grid-column: span 3; padding: 2rem; max-width: 600px; margin: 0 auto;">

                <h1>Claim Your Profile</h1>
                <p style="opacity: 0.7; margin-bottom: 1.5rem;">
                    If you already have records on the list, find your name below and request to link it to your account.
                </p>

                <div v-if="!store.user" class="login-alert login-alert-error">
                    You need to <router-link to="/login" style="color: inherit; text-decoration: underline;">log in</router-link> first.
                </div>

                <template v-else-if="loading">
                    <p>Loading...</p>
                </template>

                <template v-else>

                    <div v-if="store.profile && store.profile.list_name" class="login-alert login-alert-success">
                        Your account is already linked to "{{ store.profile.list_name }}".
                    </div>

                    <div v-else-if="myRequest" class="login-alert" style="background-color: rgba(255,180,0,0.15); border: 1px solid orange; color: orange;">
                        Your request to claim "{{ myRequest.list_name }}" is pending review.
                    </div>

                    <template v-else>
                        <transition name="alert-fade"><div v-if="error" class="login-alert login-alert-error">{{ error }}</div></transition>
                        <transition name="alert-fade"><div v-if="success" class="login-alert login-alert-success">{{ success }}</div></transition>

                        <div class="login-field">
                            <label class="type-title-sm">Search your name</label>
                            <input
                                type="text"
                                v-model="search"
                                placeholder="Type to search..."
                                class="login-input"
                            >
                        </div>

                        <div class="claim-list">
                            <button
                                v-for="name in filteredNames"
                                :key="name"
                                class="claim-list-item"
                                :class="{ selected: selected === name }"
                                @click="selected = name"
                            >
                                {{ name }}
                            </button>
                            <p v-if="filteredNames.length === 0" style="opacity: 0.5; padding: 1rem;">
                                No matching names found.
                            </p>
                        </div>

                        <button
                            class="login-btn"
                            :disabled="!selected || submitting"
                            @click="submitClaim"
                            style="margin-top: 1rem;"
                        >
                            {{ submitting ? 'Submitting...' : (selected ? 'Request claim for "' + selected + '"' : 'Select a name above') }}
                        </button>
                    </template>

                </template>
            </div>
        </main>
    `,
    computed: {
        filteredNames() {
            if (!this.search) return this.availableNames.slice(0, 50);
            const q = this.search.toLowerCase();
            return this.availableNames
                .filter((name) => name.toLowerCase().includes(q))
                .slice(0, 50);
        },
    },
    async mounted() {
        if (!store.user) {
            this.loading = false;
            return;
        }

        // ✅ Garante que o perfil está atualizado (caso um claim tenha sido aprovado
        // enquanto o usuário estava navegando em outra aba/página)
        await store.refreshProfile();

        try {
            const { data: existingRequest } = await supabase
                .from('claim_requests')
                .select('*')
                .eq('user_id', store.user.id)
                .eq('status', 'pending')
                .maybeSingle();

            this.myRequest = existingRequest || null;

            const { data: claimedProfiles } = await supabase
                .from('profiles')
                .select('list_name')
                .not('list_name', 'is', null);

            const claimedSet = new Set(
                (claimedProfiles || [])
                    .filter((p) => p.list_name)
                    .map((p) => p.list_name.toLowerCase())
            );

            const [classic, platformer, challenge, impossible] = await Promise.all([
                fetchLeaderboard(),
                fetchPlatformerLeaderboard(),
                fetchChallengeLeaderboard(),
                fetchImpossibleLeaderboard(),
            ]);

            const allNames = new Set();
            [classic[0], platformer[0], challenge[0], impossible[0]].forEach((lb) => {
                lb.forEach((entry) => allNames.add(entry.user));
            });

            this.availableNames = [...allNames]
                .filter((name) => !claimedSet.has(name.toLowerCase()))
                .sort((a, b) => a.localeCompare(b));
        } catch (err) {
            console.error('Claim page error:', err);
            this.error = 'Failed to load claim data.';
        }

        this.loading = false;
    },
    methods: {
        async submitClaim() {
            if (!this.selected) return;
            this.submitting = true;
            this.error = null;

            const { error } = await supabase
                .from('claim_requests')
                .insert({
                    user_id: store.user.id,
                    list_name: this.selected,
                });

            if (error) {
                this.error = 'Failed to submit request. Try again.';
                this.submitting = false;
                return;
            }

            // Avisa os mods/admins que tem um claim novo pra revisar.
            try {
                const { data: staff } = await supabase
                    .from('profiles')
                    .select('id')
                    .in('role', ['mod', 'admin']);

                if (staff && staff.length > 0) {
                    await supabase.from('notifications').insert(
                        staff.map((s) => ({
                            user_id: s.id,
                            type: 'new_claim',
                            message: `New claim request: "${this.selected}"`,
                            link: '/admin/claims',
                        })),
                    );
                }
            } catch (notifErr) {
                console.error('Failed to notify staff:', notifErr);
            }

            this.success = 'Request submitted! An admin will review it soon.';
            this.myRequest = { list_name: this.selected };
            this.submitting = false;
        },
    },
};
