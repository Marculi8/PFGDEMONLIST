import { supabase } from '../supabase.js';
import { store } from '../main.js';
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

const inputStyle = 'width: 100%; padding: 0.65rem 0.85rem; margin-top: 0.4rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); color: var(--color-on-background);';

export default {
    data: () => ({
        store,
        inputStyle,

        name: '',
        description: '',
        targetListType: 'classic',
        targetMenuOpen: false,
        hostName: '',
        creators: [],
        creatorIdSeed: 1,

        staticNames: [],
        registeredNames: [],
        namesLoading: false,
        picker: {
            field: null, // 'hostName' | 'creators' | null
            index: null,
            search: '',
            newName: '',
        },

        submitting: false,
        error: null,
        success: null,
    }),
    template: `
        <main class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 600px; margin: 0 auto;">

                <h1 style="text-align: center;">New Project</h1>

                <div v-if="!store.user" class="login-alert login-alert-error">
                    You need to <router-link to="/login" style="color: inherit; text-decoration: underline;">log in</router-link> first.
                </div>

                <template v-else>
                    <transition name="alert-fade"><div v-if="error" class="login-alert login-alert-error">{{ error }}</div></transition>
                    <transition name="alert-fade"><div v-if="success" class="login-alert login-alert-success">{{ success }}</div></transition>

                    <template v-if="!success">
                        <p style="opacity: 0.6; margin-top: 1rem; font-size: 0.9rem;">
                            Working on something big? Suggest a project to share progress with the community as you go. A mod/admin will review it before it goes live.
                        </p>

                        <form @submit.prevent="submitProject" class="add-level-form-card">
                            <div style="padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box;">
                                <label for="name">Project Name</label><br>
                                <input id="name" type="text" v-model="name" required :style="inputStyle">

                                <label for="description" style="display: block; margin-top: 1.25rem;">Description <span style="opacity: 0.5;">(optional)</span></label>
                                <textarea id="description" v-model="description" rows="3" :style="inputStyle + ' resize: vertical; font-family: inherit;'"></textarea>
                            </div>

                            <div style="margin-top: 1.25rem;">
                                <label>Destination List</label>
                                <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">Impossible goes straight to the Impossible List when finished. Everything else goes through Verifications first.</p>
                                <div style="position: relative; margin-top: 0.4rem;">
                                    <button
                                        type="button"
                                        class="list-tab"
                                        @click="targetMenuOpen = !targetMenuOpen"
                                        style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 0.65rem 0.9rem;"
                                    >
                                        <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ TARGET_LABELS_[targetListType] }}</span>
                                        <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: targetMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                                            <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                                        </svg>
                                    </button>
                                    <transition name="dropdown-fade">
                                    <div
                                        v-if="targetMenuOpen"
                                        style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; overflow: hidden; z-index: 20;"
                                    >
                                        <button
                                            type="button"
                                            v-for="t in Object.keys(TARGET_LABELS_)"
                                            :key="t"
                                            @click="targetListType = t; targetMenuOpen = false;"
                                            class="type-label-lg"
                                            :style="{
                                                display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                                border: 'none', cursor: 'pointer',
                                                backgroundColor: targetListType === t ? 'var(--color-primary)' : 'transparent',
                                                color: targetListType === t ? '#ffffff' : 'inherit',
                                            }"
                                        >{{ TARGET_LABELS_[t] }}</button>
                                    </div>
                                    </transition>
                                    <div v-if="targetMenuOpen" @click="targetMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                                </div>
                            </div>

                            <div style="margin-top: 1.25rem; padding: 1rem; border-radius: 8px; border: 1.5px solid var(--form-border-gray); background-color: var(--color-background-hover); background-image: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(150, 150, 150, 0.1) 60%); text-align: center; box-sizing: border-box; position: relative;">
                                <label for="hostName">Host</label><br>
                                <input id="hostName" type="text" v-model="hostName" @click="openPicker('hostName')" readonly required :style="inputStyle + ' cursor: pointer;'">
                                <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.3rem 0 0;">That's you (or who you're posting this for) — manages the project, creators and reports.</p>

                                <label style="display: block; margin-top: 1.25rem;">Creators</label>
                                <p style="opacity: 0.45; font-size: 0.75rem; margin: 0.2rem 0 0;">Collaborators — they'll be able to post progress reports too.</p>

                                <transition-group name="creator-row-fade" tag="div" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
                                    <div v-for="(c, i) in creators" :key="c.id" style="display: flex; gap: 0.5rem; align-items: center;">
                                        <input type="text" :value="c.name" @click="openPicker('creators', i)" readonly :style="inputStyle + ' cursor: pointer; flex: 1; margin-top: 0;'">
                                        <button type="button" @click="creators.splice(i, 1)" class="creator-slot-btn" aria-label="Remove creator">−</button>
                                    </div>
                                    <button key="add-creator-btn" type="button" @click="openPicker('creators', creators.length)" class="creator-add-btn">+ Add creator</button>
                                </transition-group>
                            </div>

                            <button
                                type="submit"
                                class="nav__cta type-label-lg"
                                :disabled="submitting"
                                style="margin-top: 1.75rem; width: 100%; padding: 0.85rem; border: none; border-radius: 8px; cursor: pointer; background-color: #767676;"
                            >{{ submitting ? 'Sending...' : 'Suggest Project' }}</button>
                        </form>
                    </template>
                </template>

            </div>

            <!-- ================= NAME PICKER POPUP ================= -->
            <transition name="tab-fade">
            <div v-if="picker.field" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;" @click.self="closePicker">
                <div style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Pick a name for {{ pickerLabel }}</p>
                        <button @click="closePicker" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>

                    <input
                        type="text"
                        v-model="picker.search"
                        placeholder="Search..."
                        :style="inputStyle + ' margin-top: 0.75rem;'"
                    >

                    <div style="overflow-y: auto; margin-top: 0.75rem; padding-top: 0.2rem; flex: 1;">
                        <p class="type-label-md" style="opacity: 0.6; margin: 0 0 0.4rem;">Static Accounts <span style="opacity: 0.6;">(from level files)</span></p>
                        <p v-if="namesLoading" style="opacity: 0.5; font-size: 0.85rem;">Loading...</p>
                        <button
                            v-for="n in filteredStatic"
                            :key="'s-' + n"
                            type="button"
                            @click="selectName(n)"
                            style="display: block; width: 100%; text-align: left; padding: 0.4rem 0.5rem; border: none; background: none; color: inherit; cursor: pointer; border-radius: 6px;"
                            onmouseover="this.style.backgroundColor='var(--color-background-hover)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                        >{{ n }}</button>
                        <p v-if="!namesLoading && filteredStatic.length === 0" style="opacity: 0.4; font-size: 0.85rem;">No matches.</p>

                        <p class="type-label-md" style="opacity: 0.6; margin: 1rem 0 0.4rem;">Registered Accounts</p>
                        <button
                            v-for="n in filteredRegistered"
                            :key="'r-' + n"
                            type="button"
                            @click="selectName(n)"
                            style="display: block; width: 100%; text-align: left; padding: 0.4rem 0.5rem; border: none; background: none; color: inherit; cursor: pointer; border-radius: 6px;"
                            onmouseover="this.style.backgroundColor='var(--color-background-hover)'"
                            onmouseout="this.style.backgroundColor='transparent'"
                        >{{ n }}</button>
                        <p v-if="!namesLoading && filteredRegistered.length === 0" style="opacity: 0.4; font-size: 0.85rem;">No matches.</p>
                    </div>

                    <div style="border-top: 1px solid var(--card-border); margin-top: 0.75rem; padding-top: 0.75rem;">
                        <label style="font-size: 0.85rem; opacity: 0.7;">Not listed? Add a new name:</label>
                        <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem; align-items: stretch;">
                            <input
                                type="text"
                                v-model="picker.newName"
                                placeholder="New name"
                                @keyup.enter="confirmNewName"
                                :style="inputStyle + ' margin-top: 0; flex: 1;'"
                            >
                            <button
                                type="button"
                                @click="confirmNewName"
                                class="nav__cta type-label-lg"
                                style="border: none; border-radius: 8px; cursor: pointer; padding: 0 1rem; white-space: nowrap;"
                            >Add</button>
                        </div>
                    </div>
                </div>
            </div>
            </transition>
        </main>
    `,
    computed: {
        pickerLabel() {
            const labels = { hostName: 'Host', creators: 'Creators' };
            return labels[this.picker.field] || '';
        },
        filteredStatic() {
            const q = this.picker.search.trim().toLowerCase();
            const list = q
                ? this.staticNames.filter((n) => n.toLowerCase().includes(q))
                : this.staticNames;
            return list.slice(0, 100);
        },
        filteredRegistered() {
            const q = this.picker.search.trim().toLowerCase();
            const list = q
                ? this.registeredNames.filter((n) => n.toLowerCase().includes(q))
                : this.registeredNames;
            return list.slice(0, 100);
        },
    },
    created() {
        this.TARGET_LABELS_ = TARGET_LABELS;
    },
    methods: {
        async loadAllNames() {
            if (this.staticNames.length > 0 || this.registeredNames.length > 0) return;
            this.namesLoading = true;
            try {
                const registeredSet = new Set();
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('list_name')
                    .not('list_name', 'is', null);
                (profiles || []).forEach((p) => registeredSet.add(p.list_name));

                const staticSet = new Set();
                const allLists = await Promise.all(
                    Object.values(LIST_FETCHERS).map((fetcher) => fetcher()),
                );
                allLists.forEach((result) => {
                    (result || []).forEach(([level]) => {
                        if (!level) return;
                        if (level.author) staticSet.add(level.author);
                        (level.creators || []).forEach((c) => staticSet.add(c));
                        if (level.verifier) staticSet.add(level.verifier);
                        (level.records || []).forEach((r) => {
                            if (r.user) staticSet.add(r.user);
                        });
                    });
                });
                registeredSet.forEach((n) => staticSet.delete(n));

                this.registeredNames = Array.from(registeredSet).sort((a, b) => a.localeCompare(b));
                this.staticNames = Array.from(staticSet).sort((a, b) => a.localeCompare(b));
            } finally {
                this.namesLoading = false;
            }
        },
        openPicker(field, index = null) {
            this.picker.field = field;
            this.picker.index = index;
            this.picker.search = '';
            this.picker.newName = '';
            this.loadAllNames();
        },
        closePicker() {
            this.picker.field = null;
            this.picker.index = null;
        },
        selectName(name) {
            this.applyName(name);
            this.closePicker();
        },
        confirmNewName() {
            const name = this.picker.newName.trim();
            if (!name) return;
            this.applyName(name);
            this.picker.newName = '';
            this.closePicker();
        },
        applyName(name) {
            if (this.picker.field === 'creators') {
                const idx = this.picker.index;
                if (idx === null || idx === undefined || idx >= this.creators.length) {
                    const exists = this.creators.some((c) => c.name === name);
                    if (!exists) {
                        this.creators.push({ id: this.creatorIdSeed++, name });
                    }
                } else {
                    this.creators[idx].name = name;
                }
            } else if (this.picker.field) {
                this[this.picker.field] = name;
            }
        },
        async notifyStaff(type, message, link) {
            try {
                const { data: staff } = await supabase
                    .from('profiles')
                    .select('id')
                    .in('role', ['mod', 'admin']);

                if (staff && staff.length > 0) {
                    await supabase.from('notifications').insert(
                        staff.map((s) => ({ user_id: s.id, type, message, link })),
                    );
                }
            } catch (notifErr) {
                console.error('Failed to notify staff:', notifErr);
            }
        },
        async submitProject() {
            this.error = null;

            if (!this.name.trim() || !this.hostName.trim()) {
                this.error = 'Please fill in the project name and host.';
                return;
            }

            this.submitting = true;
            try {
                const creatorsArr = this.creators
                    .map((c) => c.name.trim())
                    .filter(Boolean);

                const { error: insertError } = await supabase
                    .from('projects')
                    .insert({
                        owner_id: store.user.id,
                        name: this.name.trim(),
                        description: this.description.trim() || null,
                        target_list_type: this.targetListType,
                        host_name: this.hostName.trim(),
                        creators: creatorsArr,
                        status: 'pending',
                    });

                if (insertError) throw insertError;

                await this.notifyStaff(
                    'new_project_suggestion',
                    `New project suggestion: ${this.name.trim()} (${TARGET_LABELS[this.targetListType]})`,
                    '/admin/project-suggestions',
                );

                this.success = 'Your project was sent for review! A mod/admin will take a look soon.';
            } catch (err) {
                this.error = err.message || 'Something went wrong suggesting this project.';
            } finally {
                this.submitting = false;
            }
        },
    },
};
