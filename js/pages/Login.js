import { supabase } from '../supabase.js';

export default {
    data: () => ({
        mode: 'login', // 'login', 'register', 'forgot'
        identifier: '', // email ou username
        email: '',
        password: '',
        username: '',
        loading: false,
        error: null,
        success: null,
        contentHeight: 'auto',
        contentVisible: true,
    }),
    template: `
        <main class="page-login">
            <div class="login-card">

                <!-- Abas Login / Cadastro -->
                <div class="slide-tabs" style="margin-bottom: 1.5rem;">
                    <button
                        class="slide-tab"
                        :class="{ active: mode === 'login' }"
                        @click="setMode('login')"
                    >Login</button>
                    <button
                        class="slide-tab"
                        :class="{ active: mode === 'register' }"
                        @click="setMode('register')"
                    >Create Account</button>
                    <div class="slide-tab-indicator" :style="{ transform: mode === 'register' ? 'translateX(100%)' : 'translateX(0)' }"></div>
                </div>

                <!-- Erro -->
                <transition name="alert-fade"><div v-if="error" class="login-alert login-alert-error">{{ error }}</div></transition>

                <!-- Sucesso -->
                <transition name="alert-fade"><div v-if="success" class="login-alert login-alert-success">{{ success }}</div></transition>

                <div ref="formBody" class="login-mode-body" :style="{ height: contentHeight, opacity: contentVisible ? 1 : 0, overflow: contentHeight === 'auto' ? 'visible' : 'hidden' }">
                <!-- Formulário de Login -->
                <template v-if="mode === 'login'">
                    <div class="login-field">
                        <label class="type-title-sm">Email or Username</label>
                        <input
                            type="text"
                            v-model="identifier"
                            placeholder="your@email.com or YourUsername"
                            class="login-input"
                            @keyup.enter="handleLogin"
                        >
                    </div>
                    <div class="login-field">
                        <label class="type-title-sm">Password</label>
                        <input
                            type="password"
                            v-model="password"
                            placeholder="••••••••"
                            class="login-input"
                            @keyup.enter="handleLogin"
                        >
                    </div>
                    <button class="login-btn" :disabled="loading" @click="handleLogin">
                        {{ loading ? 'Logging in...' : 'Login' }}
                    </button>
                    <button class="login-forgot" @click="setMode('forgot')">
                        Forgot your password?
                    </button>
                </template>

                <!-- Formulário de Cadastro -->
                <template v-else-if="mode === 'register'">
                    <div class="login-field">
                        <label class="type-title-sm">Username</label>
                        <input
                            type="text"
                            v-model="username"
                            placeholder="YourUsername"
                            class="login-input"
                        >
                    </div>
                    <div class="login-field">
                        <label class="type-title-sm">Email</label>
                        <input
                            type="email"
                            v-model="email"
                            placeholder="your@email.com"
                            class="login-input"
                        >
                    </div>
                    <div class="login-field">
                        <label class="type-title-sm">Password</label>
                        <input
                            type="password"
                            v-model="password"
                            placeholder="Min. 6 characters"
                            class="login-input"
                            @keyup.enter="handleRegister"
                        >
                    </div>
                    <button class="login-btn" :disabled="loading" @click="handleRegister">
                        {{ loading ? 'Creating account...' : 'Create Account' }}
                    </button>
                </template>

                <!-- Formulário de Forgot Password -->
                <template v-else>
                    <p style="opacity: 0.7; font-size: 0.9rem; margin: 0 0 1rem;">
                        Enter your email and we'll send you a link to reset your password.
                    </p>
                    <div class="login-field">
                        <label class="type-title-sm">Email</label>
                        <input
                            type="email"
                            v-model="email"
                            placeholder="your@email.com"
                            class="login-input"
                            @keyup.enter="handleForgot"
                        >
                    </div>
                    <button class="login-btn" :disabled="loading" @click="handleForgot">
                        {{ loading ? 'Sending...' : 'Send Reset Link' }}
                    </button>
                    <button class="login-forgot" @click="setMode('login')">
                        ← Back to Login
                    </button>
                </template>
                </div>

            </div>
        </main>
    `,
    methods: {
        setMode(newMode) {
            if (this.mode === newMode) return;

            const el = this.$refs.formBody;
            const FADE_MS = 150;

            if (el) this.contentHeight = (el.offsetHeight + 2) + 'px';
            this.contentVisible = false;

            clearTimeout(this._modeSwitchTimeout);
            clearTimeout(this._heightResetTimeout);

            this._modeSwitchTimeout = setTimeout(() => {
                this.mode = newMode;
                this.error = null;
                this.success = null;

                this.$nextTick(() => {
                    if (!el) { this.contentVisible = true; return; }

                    // Solta a altura fixa antes de medir — senão o scrollHeight
                    // fica "preso" no valor antigo quando o conteúdo novo é
                    // MENOR (é isso que fazia a animação de diminuir não rolar).
                    const previousHeight = el.style.height;
                    el.style.height = 'auto';
                    const targetHeight = el.scrollHeight + 2; // +2px: folga pro leading-trim dos labels não cortar
                    el.style.height = previousHeight;

                    requestAnimationFrame(() => {
                        this.contentHeight = targetHeight + 'px';
                        this.contentVisible = true;
                        this._heightResetTimeout = setTimeout(() => {
                            this.contentHeight = 'auto';
                        }, 300);
                    });
                });
            }, FADE_MS);
        },
        async handleLogin() {
            if (!this.identifier || !this.password) {
                this.error = 'Please fill in all fields.';
                return;
            }
            this.loading = true;
            this.error = null;

            let emailToUse = this.identifier;

            if (!this.identifier.includes('@')) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('username', this.identifier)
                    .single();

                if (!profile) {
                    this.error = 'Username not found.';
                    this.loading = false;
                    return;
                }

                const { data: emailData } = await supabase
                    .rpc('get_email_by_profile_id', { profile_id: profile.id });

                if (!emailData) {
                    this.error = 'Could not resolve username. Try logging in with your email.';
                    this.loading = false;
                    return;
                }

                emailToUse = emailData;
            }

            const { error } = await supabase.auth.signInWithPassword({
                email: emailToUse,
                password: this.password,
            });

            if (error) {
                this.error = 'Invalid credentials.';
                this.loading = false;
                return;
            }

            this.$router.push('/');
        },

        async handleRegister() {
            if (!this.username || !this.email || !this.password) {
                this.error = 'Please fill in all fields.';
                return;
            }
            if (this.password.length < 6) {
                this.error = 'Password must be at least 6 characters.';
                return;
            }

            this.loading = true;
            this.error = null;

            const { data: existing } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', this.username)
                .single();

            if (existing) {
                this.error = 'This username is already taken.';
                this.loading = false;
                return;
            }

            const { data, error } = await supabase.auth.signUp({
                email: this.email,
                password: this.password,
            });

            if (error) {
                this.error = error.message;
                this.loading = false;
                return;
            }

            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: data.user.id,
                    username: this.username,
                    role: 'player',
                });

            if (profileError) {
                this.error = 'Account created but failed to save profile. Contact an admin.';
                this.loading = false;
                return;
            }

            this.success = 'Account created successfully! You can now log in.';
            this.loading = false;
            this.mode = 'login';
            this.email = '';
            this.password = '';
            this.username = '';
            this.identifier = '';
        },

        async handleForgot() {
            if (!this.email) {
                this.error = 'Please enter your email.';
                return;
            }
            this.loading = true;
            this.error = null;

            const { error } = await supabase.auth.resetPasswordForEmail(
                this.email,
                { redirectTo: 'https://reborndemonlist.pages.dev/#/reset-password' }
            );

            if (error) {
                this.error = error.message || 'Failed to send reset email. Try again later.';
                this.loading = false;
                return;
            }

            this.success = 'Reset link sent! Check your email.';
            this.loading = false;
        },
    },
};
