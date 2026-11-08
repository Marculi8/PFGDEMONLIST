import { supabase } from '../supabase.js';

export default {
    data: () => ({
        password: '',
        confirm: '',
        loading: false,
        checkingLink: true,
        linkValid: false,
        error: null,
        success: null,
    }),
    template: `
        <main class="page-login">
            <div class="login-card">
                <h2 style="margin: 0 0 1.5rem;">Reset Password</h2>

                <transition name="alert-fade"><div v-if="error" class="login-alert login-alert-error">{{ error }}</div></transition>
                <transition name="alert-fade"><div v-if="success" class="login-alert login-alert-success">{{ success }}</div></transition>

                <p v-if="checkingLink" style="opacity: 0.7;">Checking your link...</p>

                <template v-if="!checkingLink && linkValid && !success">
                    <div class="login-field">
                        <label class="type-title-sm">New Password</label>
                        <input
                            type="password"
                            v-model="password"
                            placeholder="Min. 6 characters"
                            class="login-input"
                        >
                    </div>
                    <div class="login-field">
                        <label class="type-title-sm">Confirm Password</label>
                        <input
                            type="password"
                            v-model="confirm"
                            placeholder="Repeat your password"
                            class="login-input"
                            @keyup.enter="handleReset"
                        >
                    </div>
                    <button class="login-btn" :disabled="loading" @click="handleReset">
                        {{ loading ? 'Saving...' : 'Save New Password' }}
                    </button>
                </template>

                <router-link
                    v-if="success || (!checkingLink && !linkValid)"
                    to="/login"
                    class="login-btn"
                    style="display: block; text-align: center; text-decoration: none; margin-top: 0.5rem;"
                >{{ success ? 'Go to Login' : 'Back to Login' }}</router-link>
            </div>
        </main>
    `,
    async mounted() {
        // A URL vem como "#/reset-password#access_token=...&refresh_token=...&type=recovery"
        // (o Vue Router já usa "#" pra navegação, e o Supabase manda o token depois de
        // outro "#" — a detecção automática do Supabase não entende esse formato duplicado,
        // então extraímos o token manualmente e criamos a sessão nós mesmos.
        const hash = window.location.hash;
        const secondHashIndex = hash.indexOf('#', 1);

        if (secondHashIndex === -1) {
            this.checkingLink = false;
            this.linkValid = false;
            this.error = 'This reset link is invalid or has expired. Please request a new one.';
            return;
        }

        const params = new URLSearchParams(hash.substring(secondHashIndex + 1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (!access_token || !refresh_token) {
            this.checkingLink = false;
            this.linkValid = false;
            this.error = 'This reset link is invalid or has expired. Please request a new one.';
            return;
        }

        const { error } = await supabase.auth.setSession({ access_token, refresh_token });

        this.checkingLink = false;
        if (error) {
            this.linkValid = false;
            this.error = 'This reset link is invalid or has expired. Please request a new one.';
        } else {
            this.linkValid = true;
        }
    },
    methods: {
        async handleReset() {
            if (!this.password || !this.confirm) {
                this.error = 'Please fill in all fields.';
                return;
            }
            if (this.password.length < 6) {
                this.error = 'Password must be at least 6 characters.';
                return;
            }
            if (this.password !== this.confirm) {
                this.error = 'Passwords do not match.';
                return;
            }

            this.loading = true;
            this.error = null;

            const { error } = await supabase.auth.updateUser({
                password: this.password,
            });

            if (error) {
                this.error = error.message || 'Failed to reset password. The link may have expired.';
                this.loading = false;
                return;
            }

            this.success = 'Password updated successfully!';
            this.loading = false;
        },
    },
};
