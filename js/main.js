import routes from './routes.js';
import { supabase } from './supabase.js';

let routerInstance = null;

export const store = Vue.reactive({
    dark: JSON.parse(localStorage.getItem('dark')) || false,
    user: null,
    profile: null,
    profileMenuOpen: false,
    listMenuOpen: false,
    notifications: [],
    notificationsOpen: false,
    pageLoading: false,
    pageLoadProgress: 0,

    toggleDark() {
        this.dark = !this.dark;
        localStorage.setItem('dark', JSON.stringify(this.dark));
        document.body.classList.toggle('dark', this.dark);
    },

    toggleProfileMenu() {
        this.profileMenuOpen = !this.profileMenuOpen;
    },

    toggleListMenu() {
        this.listMenuOpen = !this.listMenuOpen;
    },

    toggleNotifications() {
        this.notificationsOpen = !this.notificationsOpen;
        if (this.notificationsOpen) {
            this.loadNotifications();
        }
    },

    get unreadNotificationsCount() {
        return this.notifications.filter((n) => !n.read).length;
    },

    async loadNotifications() {
        if (!this.user) {
            this.notifications = [];
            return;
        }
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);
        this.notifications = data || [];
    },

    async markNotificationRead(notification) {
        if (notification.read) return;
        notification.read = true; // atualização otimista
        await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notification.id);
    },

    async markAllNotificationsRead() {
        const unread = this.notifications.filter((n) => !n.read);
        if (unread.length === 0) return;
        unread.forEach((n) => { n.read = true; });
        await supabase
            .from('notifications')
            .update({ read: true })
            .in('id', unread.map((n) => n.id));
    },

    async clearReadNotifications() {
        const readIds = this.notifications.filter((n) => n.read).map((n) => n.id);
        if (readIds.length === 0) return;
        this.notifications = this.notifications.filter((n) => !n.read);
        await supabase
            .from('notifications')
            .delete()
            .in('id', readIds);
    },

    async refreshProfile() {
        await loadProfile(this.user);
    },

    async logout() {
        await supabase.auth.signOut();
        this.user = null;
        this.profile = null;
        this.profileMenuOpen = false;
        this.notifications = [];
        if (routerInstance) routerInstance.push('/login');
    },
});

// Aplica a classe "dark" no <body> assim que o script carrega — Vue não
// controla a tag onde ele é montado, então isso precisa ser feito manualmente.
document.body.classList.toggle('dark', store.dark);

async function loadProfile(user) {
    if (!user) {
        store.profile = null;
        return;
    }
    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    store.profile = data || null;
}

supabase.auth.onAuthStateChange(async (event, session) => {
    store.user = session?.user || null;
    await loadProfile(store.user);
    await store.loadNotifications();
});

// Recarrega o perfil e as notificações automaticamente sempre que a aba volta a ficar ativa
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && store.user) {
        loadProfile(store.user);
        store.loadNotifications();
    }
});

// ─── Overlay de carregamento entre páginas ─────────────────────
// Como uma SPA não tem como medir progresso "real" de carregamento,
// a barra sobe sozinha até ~90% e só completa quando a navegação termina.
const MIN_OVERLAY_MS = 900; // tempo mínimo que o overlay fica visível

let progressInterval = null;
let navStartedAt = 0;

function startPageLoad() {
    navStartedAt = Date.now();
    store.pageLoading = true;
    store.pageLoadProgress = 0;

    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        store.pageLoadProgress += (90 - store.pageLoadProgress) * 0.15;
    }, 100);
}

function finishPageLoad() {
    const elapsed = Date.now() - navStartedAt;
    const remaining = Math.max(0, MIN_OVERLAY_MS - elapsed);

    setTimeout(() => {
        clearInterval(progressInterval);
        store.pageLoadProgress = 100;

        setTimeout(() => {
            store.pageLoading = false;
        }, 200); // deixa o "100%" visível um instante antes de sumir
    }, remaining);
}

async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    store.user = user;
    await loadProfile(user);
    await store.loadNotifications();

    const app = Vue.createApp({
        data: () => ({ store }),
    });

    const router = VueRouter.createRouter({
        history: VueRouter.createWebHashHistory(),
        routes,
    });
    routerInstance = router;

    router.beforeEach((to, from, next) => {
        if (to.path !== from.path) {
            startPageLoad();
        }
        next();
    });

    router.afterEach(() => {
        finishPageLoad();
        store.mobileMenuOpen = false;
        store.listMenuOpen = false;
        store.profileMenuOpen = false;
        store.notificationsOpen = false;
    });

    app.use(router);
    app.mount('#app');
}

init();
