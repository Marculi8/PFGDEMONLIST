import { store } from '../main.js';
import { supabase, hasRole } from '../supabase.js';
import { NEW_BADGE_DAYS } from '../newBadge.js';
import {
    fetchList,
    fetchPlatformerList,
    fetchChallengeList,
    fetchImpossibleList,
} from '../content.js';

const LIST_FETCHERS = {
    classic: fetchList,
    platformer: fetchPlatformerList,
    challenge: fetchChallengeList,
    impossible: fetchImpossibleList,
};

const TARGET_LABELS = {
    classic: 'Classic',
    platformer: 'Platformer',
    challenge: 'Challenge',
    impossible: 'Impossible',
};

const inputStyle = 'width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background); color: var(--color-on-background);';

export default {
    data: () => ({
        store,
        inputStyle,
        loading: true,
        isStaff: false,
        isAdmin: false,
        myName: '',
        projects: [],
        deletingId: null,
        error: null,
        feedback: null,

        editingProjectId: null,
        resetNewBadge: false,
        newBadgeDays: 14,
        editName: '',
        editDescription: '',
        editCreators: [],
        editVisibility: 'public',
        editAccessNames: [],
        editIdSeed: 1,
        savingEdit: false,
        editError: null,

        staticNames: [],
        registeredNames: [],
        namesLoading: false,
        managePicker: {
            field: null, // 'creators' | 'accessNames' | null
            index: null,
            search: '',
            newName: '',
        },
    }),
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 800px; margin: 0 auto;">

                <h1 style="text-align: center; margin-bottom: 1.5rem;">Manage Projects</h1>

                <template v-if="loading">
                    <p>Loading...</p>
                </template>

                <template v-else-if="!store.user">
                    <div class="login-alert login-alert-error">
                        You need to <router-link to="/login" style="color: inherit; text-decoration: underline;">log in</router-link> first.
                    </div>
                </template>

                <template v-else>
                    <transition name="alert-fade"><div v-if="error" class="login-alert login-alert-error">{{ error }}</div></transition>
                    <transition name="alert-fade"><div v-if="feedback" :class="['login-alert', feedback.ok ? 'login-alert-success' : 'login-alert-error']">{{ feedback.message }}</div></transition>

                    <p style="opacity: 0.6; text-align: center; margin-top: 0.5rem; font-size: 0.85rem;">
                        {{ isStaff ? 'Showing every project.' : 'Showing projects you host.' }}
                    </p>

                    <p v-if="projects.length === 0" style="opacity: 0.6; margin-top: 1rem; text-align: center;">
                        {{ isStaff ? 'No projects yet.' : "You don't host any projects." }}
                    </p>

                    <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
                    <div v-for="p in projects" :key="p.id" class="claim-request-card" style="flex-direction: column; align-items: stretch; gap: 0.6rem;">
                        <div style="flex: none;">
                            <p class="type-label-lg" style="margin: 0;">{{ p.name }}</p>
                            <p style="opacity: 0.6; font-size: 0.85rem; margin: 0.25rem 0 0;">
                                Host: {{ p.host_name }} · {{ TARGET_LABELS_[p.target_list_type] }} ·
                                <span :style="{ color: p.status === 'pending' ? 'orange' : (p.status === 'rejected' ? 'var(--color-error)' : 'inherit') }">{{ p.status }}</span>
                                <span v-if="p.finished"> · Finished</span>
                            </p>
                        </div>

                        <div style="display: flex; justify-content: center; gap: 0.5rem;">
                            <button
                                type="button"
                                class="btn type-label-lg"
                                style="width: auto; padding: 0.5rem 1rem;"
                                @click="toggleEdit(p)"
                            >{{ editingProjectId === p.id ? 'Close' : 'Manage' }}</button>
                            <button
                                v-if="isAdmin"
                                type="button"
                                class="btn type-label-lg"
                                style="width: auto; padding: 0.5rem 1rem; background-color: var(--color-error); background-image: var(--error-gradient);"
                                :disabled="deletingId === p.id"
                                @click="deleteProject(p)"
                            >{{ deletingId === p.id ? 'Deleting...' : 'Delete' }}</button>
                        </div>

                        <transition name="collapse-fade">
                        <div v-if="editingProjectId === p.id" style="text-align: center; position: relative; border-top: 1px solid var(--card-border); padding-top: 0.85rem;">
                            <transition name="alert-fade"><div v-if="editError" class="login-alert login-alert-error" style="margin: 0 0 0.6rem;">{{ editError }}</div></transition>

                            <label>Name</label>
                            <input type="text" v-model="editName" :style="inputStyle + ' margin-top: 0.4rem;'">

                            <label style="display: block; margin-top: 1rem;">Description</label>
                            <textarea v-model="editDescription" rows="3" :style="inputStyle + ' margin-top: 0.4rem; resize: vertical; font: inherit;'"></textarea>

                            <label style="display: block; margin-top: 1rem;">Creators</label>
                            <transition-group name="creator-row-fade" tag="div" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
                                <div v-for="(c, i) in editCreators" :key="c.id" style="display: flex; gap: 0.5rem; align-items: center;">
                                    <input type="text" :value="c.name" readonly @click="openManagePicker('creators', i)" :style="inputStyle + ' cursor: pointer;'">
                                    <button type="button" @click="editCreators.splice(i, 1)" class="creator-slot-btn" aria-label="Remove creator">−</button>
                                </div>
                                <button key="add-edit-creator-btn" type="button" @click="openManagePicker('creators', editCreators.length)" class="creator-add-btn">+ Add creator</button>
                            </transition-group>

                            <label style="display: block; margin-top: 1.25rem;">Visibility</label>
                            <div style="display: flex; gap: 0.4rem; margin-top: 0.4rem; flex-wrap: wrap; justify-content: center;">
                                <button
                                    v-for="v in ['public', 'private', 'restricted']"
                                    :key="v"
                                    type="button"
                                    @click="editVisibility = v"
                                    :style="{
                                        fontSize: '0.8rem', padding: '0.4rem 0.85rem', borderRadius: '999px', cursor: 'pointer',
                                        border: '1px solid var(--card-border)',
                                        backgroundColor: editVisibility === v ? 'var(--color-primary)' : 'transparent',
                                        color: editVisibility === v ? 'white' : 'inherit',
                                    }"
                                >{{ v }}</button>
                            </div>

                            <transition name="collapse-fade">
                            <div v-if="editVisibility === 'restricted'" style="margin-top: 1rem;">
                                <label>Who else can see it</label>
                                <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">Host and creators already have access — no need to add them here.</p>
                                <transition-group name="creator-row-fade" tag="div" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
                                    <div v-for="(n, i) in editAccessNames" :key="n.id" style="display: flex; gap: 0.5rem; align-items: center;">
                                        <input type="text" :value="n.name" readonly @click="openManagePicker('accessNames', i)" :style="inputStyle + ' cursor: pointer;'">
                                        <button type="button" @click="editAccessNames.splice(i, 1)" class="creator-slot-btn" aria-label="Remove access">−</button>
                                    </div>
                                    <button key="add-edit-access-btn" type="button" @click="openManagePicker('accessNames', editAccessNames.length)" class="creator-add-btn">+ Add player</button>
                                </transition-group>
                            </div>
                            </transition>

                            <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover);">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="checkbox" v-model="resetNewBadge">
                                    Mark as "New" again
                                </label>
                                <transition name="collapse-fade">
                                <div v-if="resetNewBadge" style="margin-top: 0.75rem;">
                                    <label for="projectNewBadgeDays">For how many days (max 14)</label><br>
                                    <input
                                        id="projectNewBadgeDays"
                                        type="number"
                                        v-model.number="newBadgeDays"
                                        min="1"
                                        max="14"
                                        style="width: 100px; box-sizing: border-box; margin-top: 0.4rem; padding: 0.5rem 0.7rem; border-radius: 8px; border: 1.5px solid var(--card-border); background-color: var(--color-background); color: var(--color-on-background); text-align: center;"
                                    >
                                </div>
                                </transition>
                            </div>

                            <button
                                type="button"
                                @click="saveEdit(p)"
                                class="login-btn"
                                style="width: auto; padding: 0.55rem 1.1rem; margin: 1.25rem 0 0;"
                                :disabled="savingEdit"
                            >{{ savingEdit ? 'Saving...' : 'Save changes' }}</button>
                        </div>
                        </transition>
                    </div>
                    </transition-group>
                </template>
            </div>

            <!-- ================= NAME PICKER POPUP ================= -->
            <transition name="tab-fade">
            <div v-if="managePicker.field" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="closeManagePicker">
                <div style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Pick a name</p>
                        <button @click="closeManagePicker" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>

                    <input type="text" v-model="managePicker.search" placeholder="Search..." :style="inputStyle + ' margin-top: 0.75rem;'">

                    <div style="overflow-y: auto; margin-top: 0.75rem; padding-top: 0.2rem; flex: 1;">
                        <p class="type-label-md" style="opacity: 0.6; margin: 0 0 0.4rem;">Static Accounts <span style="opacity: 0.6;">(from level files)</span></p>
                        <p v-if="namesLoading" style="opacity: 0.5; font-size: 0.85rem;">Loading...</p>
                        <button
                            v-for="n in filteredManageStatic"
                            :key="'s-' + n"
                            type="button"
                            @click="selectManageName(n)"
                            style="display: block; width: 100%; text-align: left; padding: 0.4rem 0.5rem; border: none; background: none; color: inherit; cursor: pointer; border-radius: 6px;"
                            onmouseover="this.style.backgroundColor='var(--color-background-hover)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                        >{{ n }}</button>
                        <p v-if="!namesLoading && filteredManageStatic.length === 0" style="opacity: 0.4; font-size: 0.85rem;">No matches.</p>

                        <p class="type-label-md" style="opacity: 0.6; margin: 1rem 0 0.4rem;">Registered Accounts</p>
                        <button
                            v-for="n in filteredManageRegistered"
                            :key="'r-' + n"
                            type="button"
                            @click="selectManageName(n)"
                            style="display: block; width: 100%; text-align: left; padding: 0.4rem 0.5rem; border: none; background: none; color: inherit; cursor: pointer; border-radius: 6px;"
                            onmouseover="this.style.backgroundColor='var(--color-background-hover)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                        >{{ n }}</button>
                        <p v-if="!namesLoading && filteredManageRegistered.length === 0" style="opacity: 0.4; font-size: 0.85rem;">No matches.</p>
                    </div>

                    <div style="border-top: 1px solid var(--card-border); margin-top: 0.75rem; padding-top: 0.75rem;">
                        <label style="font-size: 0.85rem; opacity: 0.7;">Not listed? Add a new name:</label>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem; align-items: stretch;">
                            <input type="text" v-model="managePicker.newName" placeholder="New name" @keyup.enter="confirmManageNewName" :style="inputStyle + ' flex: 1;'">
                            <button type="button" @click="confirmManageNewName" class="nav__cta type-label-lg" style="border: none; border-radius: 8px; cursor: pointer; padding: 0 1rem; white-space: nowrap;">Add</button>
                        </div>
                    </div>
                </div>
            </div>
            </transition>
        </main>
    `,
    created() {
        this.TARGET_LABELS_ = TARGET_LABELS;
    },
    async mounted() {
        this.isStaff = await hasRole('mod', 'admin');
        this.isAdmin = await hasRole('admin');
        this.myName = store.profile ? (store.profile.list_name || store.profile.username) : '';

        if (store.user) {
            await this.loadProjects();
        }
        this.loading = false;
    },
    computed: {
        managePickerExcluded() {
            const names = new Set();
            this.editCreators.forEach((c) => c.name && names.add(c.name));
            return names;
        },
        filteredManageStatic() {
            const q = this.managePicker.search.trim().toLowerCase();
            let list = this.staticNames;
            if (this.managePicker.field === 'accessNames') {
                list = list.filter((n) => !this.managePickerExcluded.has(n));
            }
            if (q) list = list.filter((n) => n.toLowerCase().includes(q));
            return list.slice(0, 100);
        },
        filteredManageRegistered() {
            const q = this.managePicker.search.trim().toLowerCase();
            let list = this.registeredNames;
            if (this.managePicker.field === 'accessNames') {
                list = list.filter((n) => !this.managePickerExcluded.has(n));
            }
            if (q) list = list.filter((n) => n.toLowerCase().includes(q));
            return list.slice(0, 100);
        },
    },
    methods: {
        async loadProjects() {
            let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
            if (!this.isStaff) {
                query = query.eq('host_name', this.myName);
            }
            const { data, error } = await query;

            if (error) {
                this.error = 'Failed to load projects.';
                return;
            }
            this.projects = data || [];
        },

        toggleEdit(p) {
            if (this.editingProjectId === p.id) {
                this.editingProjectId = null;
                return;
            }
            this.editingProjectId = p.id;
            this.editName = p.name;
            this.editDescription = p.description || '';
            this.editCreators = (p.creators || []).map((name) => ({ id: this.editIdSeed++, name }));
            this.editVisibility = p.visibility || 'public';
            this.editAccessNames = (p.access_names || []).map((name) => ({ id: this.editIdSeed++, name }));
            this.editError = null;
            this.resetNewBadge = false;
            this.newBadgeDays = 14;
        },

        async loadAllNames() {
            if (this.staticNames.length > 0 || this.registeredNames.length > 0) return;
            this.namesLoading = true;
            try {
                const registeredSet = new Set();
                const { data: profiles } = await supabase.from('profiles').select('username, list_name');
                (profiles || []).forEach((p) => {
                    const name = p.list_name || p.username;
                    if (name) registeredSet.add(name);
                });

                const staticSet = new Set();
                const allLists = await Promise.all(Object.values(LIST_FETCHERS).map((fetcher) => fetcher()));
                allLists.forEach((result) => {
                    (result || []).forEach(([level]) => {
                        if (!level) return;
                        if (level.author) staticSet.add(level.author);
                        (level.creators || []).forEach((c) => staticSet.add(c));
                        if (level.verifier) staticSet.add(level.verifier);
                        (level.records || []).forEach((r) => { if (r.user) staticSet.add(r.user); });
                    });
                });
                registeredSet.forEach((n) => staticSet.delete(n));

                this.registeredNames = Array.from(registeredSet).sort((a, b) => a.localeCompare(b));
                this.staticNames = Array.from(staticSet).sort((a, b) => a.localeCompare(b));
            } finally {
                this.namesLoading = false;
            }
        },

        openManagePicker(field, index = null) {
            this.managePicker.field = field;
            this.managePicker.index = index;
            this.managePicker.search = '';
            this.managePicker.newName = '';
            this.loadAllNames();
        },
        closeManagePicker() {
            this.managePicker.field = null;
            this.managePicker.index = null;
        },
        selectManageName(name) {
            this.applyManageName(name);
            this.closeManagePicker();
        },
        confirmManageNewName() {
            const name = this.managePicker.newName.trim();
            if (!name) return;
            this.applyManageName(name);
            this.managePicker.newName = '';
            this.closeManagePicker();
        },
        applyManageName(name) {
            const target = this.managePicker.field === 'creators' ? this.editCreators : this.editAccessNames;
            const idx = this.managePicker.index;
            if (idx === null || idx === undefined || idx >= target.length) {
                if (!target.some((c) => c.name === name)) {
                    target.push({ id: this.editIdSeed++, name });
                }
            } else {
                target[idx].name = name;
            }
        },

        async saveEdit(p) {
            this.editError = null;
            this.savingEdit = true;
            try {
                const creators = this.editCreators.map((c) => c.name.trim()).filter(Boolean);
                const accessNames = this.editAccessNames.map((n) => n.name.trim()).filter(Boolean);

                // Se marcado, "faz de conta" que o projeto foi criado há menos
                // dias que o máximo — o New aparece só pelos N dias pedidos.
                // Nesse caso a gente NÃO grava updated_at, pra não virar
                // "Updated" sozinho assim que o New expirar.
                const payload = {
                    name: this.editName.trim(),
                    description: this.editDescription.trim() || null,
                    creators,
                    visibility: this.editVisibility,
                    access_names: this.editVisibility === 'restricted' ? accessNames : [],
                };
                if (this.resetNewBadge) {
                    const maxDays = NEW_BADGE_DAYS.project;
                    const desiredDays = Math.min(Math.max(this.newBadgeDays || 1, 1), maxDays);
                    const backdateDays = maxDays - desiredDays;
                    payload.created_at = new Date(Date.now() - backdateDays * 24 * 60 * 60 * 1000).toISOString();
                } else {
                    payload.updated_at = new Date().toISOString();
                }

                const { error } = await supabase
                    .from('projects')
                    .update(payload)
                    .eq('id', p.id);

                if (error) throw error;

                p.name = this.editName.trim();
                p.description = this.editDescription.trim() || null;
                p.creators = creators;
                p.visibility = this.editVisibility;
                p.access_names = this.editVisibility === 'restricted' ? accessNames : [];
                if (payload.created_at) p.created_at = payload.created_at;
                if (payload.updated_at) p.updated_at = payload.updated_at;
                this.editingProjectId = null;
                this.feedback = { ok: true, message: 'Saved.' };
            } catch (err) {
                this.editError = err.message || 'Something went wrong saving these changes.';
            } finally {
                this.savingEdit = false;
                clearTimeout(this._feedbackTimeout);
                this._feedbackTimeout = setTimeout(() => { this.feedback = null; }, 4000);
            }
        },

        async deleteProject(p) {
            if (!window.confirm(`Delete "${p.name}"? This also deletes all its progress reports and can't be undone.`)) return;

            this.deletingId = p.id;
            this.error = null;
            this.feedback = null;

            const { error } = await supabase.from('projects').delete().eq('id', p.id);

            if (error) {
                this.feedback = { ok: false, message: 'Failed to delete project.' };
            } else {
                this.projects = this.projects.filter((x) => x.id !== p.id);
                this.feedback = { ok: true, message: `Deleted "${p.name}".` };
            }

            clearTimeout(this._feedbackTimeout);
            this._feedbackTimeout = setTimeout(() => { this.feedback = null; }, 4000);
            this.deletingId = null;
        },
    },
};
