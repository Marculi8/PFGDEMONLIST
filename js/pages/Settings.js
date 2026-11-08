import { supabase } from '../supabase.js';
import { store } from '../main.js';
import AvatarCropper from '../components/AvatarCropper.js';
import {
    fetchLeaderboard,
    fetchPlatformerLeaderboard,
    fetchChallengeLeaderboard,
    fetchImpossibleLeaderboard,
} from '../content.js';
import { embed, getYoutubeIdFromUrl } from '../util.js';

const LEADERBOARD_FETCHERS = {
    classic: fetchLeaderboard,
    platformer: fetchPlatformerLeaderboard,
    challenge: fetchChallengeLeaderboard,
    impossible: fetchImpossibleLeaderboard,
};

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default {
    components: { AvatarCropper },
    data: () => ({
        store,
        tab: 'profile',
        loading: true,

        saving: false,
        uploading: false,
        error: null,
        success: null,
        avatar: '',
        bio: '',
        youtube: '',
        twitter: '',
        discord: '',
        cropperOpen: false,
        rawImageSrc: null,

        claimSearch: '',
        claimAvailableNames: [],
        claimSelected: null,
        claimSubmitting: false,
        claimError: null,
        claimSuccess: null,
        unclaiming: false,
        unclaimError: null,
        myClaimRequest: null,

        newName: '',
        renaming: false,
        renameError: null,
        renameSuccess: null,

        videosListType: 'classic',
        VIDEO_LIST_LABELS_: {
            classic: 'Classic',
            platformer: 'Platformer',
            challenge: 'Challenge',
            impossible: 'Impossible',
        },
        myCompletions: {
            classic: [],
            platformer: [],
            challenge: [],
            impossible: [],
        },
        myCompletionsLoading: false,
        videosMap: {},
        savingVideos: false,
        videosError: null,
        videosSuccess: null,

        editingVideoLevel: null,
        editingVideoLink: '',

        videosFilter: 'all', // 'all', 'custom', 'default'
        videosSearch: '',
    }),
    template: `
        <main class="page-list">
            <div class="page-settings" style="grid-column: span 3; padding: 2rem; max-width: 800px; margin: 0 auto;">

                <h1 style="text-align: center;">Settings</h1>

                <div v-if="!store.user" class="login-alert login-alert-error">
                    You need to <router-link to="/login" style="color: inherit; text-decoration: underline;">log in</router-link> first.
                </div>

                <template v-else-if="loading">
                    <p>Loading...</p>
                </template>

                <template v-else>
                    <div class="settings-layout">

                        <div class="settings-sidebar">
                            <button
                                class="settings-tab"
                                :class="{ active: tab === 'profile' }"
                                @click="tab = 'profile'"
                            >Profile</button>
                            <button
                                class="settings-tab"
                                :class="{ active: tab === 'claim' }"
                                @click="tab = 'claim'"
                            >Claim Account</button>
                            <button
                                class="settings-tab"
                                :class="{ active: tab === 'videos' }"
                                @click="tab = 'videos'; loadMyCompletions();"
                            >My Videos</button>

                            <div class="settings-sidebar-divider"></div>

                            <button class="settings-tab settings-tab-logout" @click="store.logout()">
                                Logout
                            </button>
                        </div>

                        <div class="settings-content">
                            <transition name="tab-fade" mode="out-in">
                            <div :key="tab">

                            <template v-if="tab === 'profile'">
                                <template v-if="!store.profile">
                                    <p>Loading...</p>
                                </template>

                                <template v-else>
                                    <p style="opacity: 0.6; margin-bottom: 1.5rem;">
                                        Editing profile for <strong>{{ store.profile.list_name || store.profile.username }}</strong>
                                    </p>

                                    <transition name="tab-fade"><div v-if="error" class="login-alert login-alert-error">{{ error }}</div></transition>
                                    <transition name="tab-fade"><div v-if="success" class="login-alert login-alert-success">{{ success }}</div></transition>

                                    <div style="display: flex; flex-direction: column; align-items: center; gap: 0.85rem; margin-bottom: 1.5rem; text-align: center;">
                                        <div class="player-avatar-wrapper" style="width: 72px; height: 72px;">
                                            <img v-if="avatar" :src="avatar" alt="avatar" class="player-avatar">
                                            <div v-else class="player-avatar-placeholder">
                                                {{ (store.profile.list_name || store.profile.username).charAt(0).toUpperCase() }}
                                            </div>
                                        </div>
                                        <div>
                                            <input
                                                type="file"
                                                ref="fileInput"
                                                accept="image/jpeg,image/png,image/webp"
                                                style="display: none;"
                                                @change="handleFileSelect"
                                            >
                                            <button
                                                class="login-btn"
                                                style="width: auto; padding: 0.5rem 1rem; margin: 0;"
                                                :disabled="uploading"
                                                @click="$refs.fileInput.click()"
                                            >
                                                {{ uploading ? 'Uploading...' : 'Upload Avatar' }}
                                            </button>
                                            <p style="opacity: 0.5; font-size: 0.75rem; margin: 0.4rem 0 0;">
                                                JPG, PNG or WEBP. Max 3MB.
                                            </p>
                                        </div>
                                    </div>

                                    <div class="login-field">
                                        <label class="type-title-sm">Bio</label>
                                        <textarea
                                            v-model="bio"
                                            placeholder="Tell people about yourself..."
                                            class="login-input"
                                            rows="3"
                                            style="resize: vertical; font-family: inherit;"
                                        ></textarea>
                                    </div>

                                    <div class="login-field">
                                        <label class="type-title-sm">YouTube</label>
                                        <input type="text" v-model="youtube" placeholder="https://youtube.com/@yourchannel" class="login-input">
                                    </div>

                                    <div class="login-field">
                                        <label class="type-title-sm">X / Twitter</label>
                                        <input type="text" v-model="twitter" placeholder="https://x.com/yourusername" class="login-input">
                                    </div>

                                    <div class="login-field">
                                        <label class="type-title-sm">Discord Username</label>
                                        <input type="text" v-model="discord" placeholder="yourusername" class="login-input">
                                    </div>

                                    <button class="login-btn" :disabled="saving" @click="saveProfile">
                                        {{ saving ? 'Saving...' : 'Save Changes' }}
                                    </button>

                                    <div class="settings-sidebar-divider" style="margin: 2rem 0;"></div>

                                    <h3 style="margin-bottom: 0.75rem;">List Name</h3>

                                    <template v-if="!store.profile.list_name">
                                        <p style="opacity: 0.6;">
                                            You don't have a list name yet — go to the "Claim Account" tab if you already have records on the list, or your list name will be set automatically once you get your first record.
                                        </p>
                                    </template>

                                    <template v-else>
                                        <p style="opacity: 0.6; margin-bottom: 1rem;">
                                            This is the name shown on the list, leaderboard, and your records. You can change it once every 7 days.
                                        </p>

                                        <transition name="tab-fade"><div v-if="renameError" class="login-alert login-alert-error">{{ renameError }}</div></transition>
                                        <transition name="tab-fade"><div v-if="renameSuccess" class="login-alert login-alert-success">{{ renameSuccess }}</div></transition>

                                        <transition name="tab-fade"><div v-if="renameCooldownDaysLeft > 0" class="login-alert" style="background-color: rgba(255,180,0,0.15); border: 1px solid orange; color: orange;">
                                            You can change your name again in {{ renameCooldownDaysLeft }} day{{ renameCooldownDaysLeft === 1 ? '' : 's' }}.
                                        </div></transition>

                                        <div class="login-field">
                                            <label class="type-title-sm">New Name</label>
                                            <input
                                                type="text"
                                                v-model="newName"
                                                :placeholder="store.profile.list_name"
                                                class="login-input"
                                                :disabled="renameCooldownDaysLeft > 0"
                                            >
                                        </div>

                                        <button
                                            class="login-btn"
                                            :disabled="renaming || renameCooldownDaysLeft > 0 || !newName.trim()"
                                            @click="submitRename"
                                        >
                                            {{ renaming ? 'Renaming...' : 'Change Name' }}
                                        </button>
                                    </template>
                                </template>
                            </template>

                            <template v-else-if="tab === 'claim'">
                                <p style="opacity: 0.7; margin-bottom: 1.5rem;">
                                    If you already have records on the list, find your name below and request to link it to your account.
                                </p>

                                <div v-if="store.profile && store.profile.list_name" style="display: flex; flex-direction: column; gap: 0.75rem;">
                                    <div class="login-alert login-alert-success" style="margin: 0;">
                                        Your account is already linked to "{{ store.profile.list_name }}".
                                    </div>

                                    <transition name="tab-fade"><div v-if="unclaimError" class="login-alert login-alert-error" style="margin: 0;">{{ unclaimError }}</div></transition>

                                    <button
                                        type="button"
                                        class="login-btn"
                                        style="margin: 0; background-color: var(--color-error); background-image: var(--error-gradient);"
                                        :disabled="unclaiming"
                                        @click="unclaimAccount"
                                    >{{ unclaiming ? 'Working...' : 'Unclaim Account' }}</button>
                                    <p style="opacity: 0.6; font-size: 0.8rem; margin: 0;">
                                        This only unlinks your account from "{{ store.profile.list_name }}" — it doesn't change or remove anything from the list itself.
                                    </p>
                                </div>

                                <div v-else-if="myClaimRequest" class="login-alert" style="background-color: rgba(255,180,0,0.15); border: 1px solid orange; color: orange;">
                                    Your request to claim "{{ myClaimRequest.list_name }}" is pending review.
                                </div>

                                <template v-else>
                                    <transition name="tab-fade"><div v-if="claimError" class="login-alert login-alert-error">{{ claimError }}</div></transition>
                                    <transition name="tab-fade"><div v-if="claimSuccess" class="login-alert login-alert-success">{{ claimSuccess }}</div></transition>

                                    <div class="login-field">
                                        <label class="type-title-sm">Search your name</label>
                                        <input
                                            type="text"
                                            v-model="claimSearch"
                                            placeholder="Type to search..."
                                            class="login-input"
                                        >
                                    </div>

                                    <div class="claim-list">
                                        <button
                                            v-for="name in filteredClaimNames"
                                            :key="name"
                                            class="claim-list-item"
                                            :class="{ selected: claimSelected === name }"
                                            @click="claimSelected = name"
                                        >
                                            {{ name }}
                                        </button>
                                        <p v-if="filteredClaimNames.length === 0" style="opacity: 0.5; padding: 1rem;">
                                            No matching names found.
                                        </p>
                                    </div>

                                    <button
                                        class="login-btn"
                                        :disabled="!claimSelected || claimSubmitting"
                                        @click="submitClaim"
                                        style="margin-top: 1rem;"
                                    >
                                        {{ claimSubmitting ? 'Submitting...' : (claimSelected ? 'Request claim for "' + claimSelected + '"' : 'Select a name above') }}
                                    </button>
                                </template>
                            </template>

                            <template v-else-if="tab === 'videos'">
                                <h3 style="margin-bottom: 0.85rem;">My Videos</h3>
                                <p style="opacity: 0.6; margin-bottom: 1rem;">
                                    Add your own video link for any level you have a record on. It'll show instead of the level's default verification video when someone views your profile.
                                </p>

                                <template v-if="!store.profile || !store.profile.list_name">
                                    <p style="opacity: 0.5;">You don't have any records yet — once you do, they'll show up here.</p>
                                </template>

                                <template v-else>
                                    <transition name="tab-fade"><div v-if="videosError" class="login-alert login-alert-error">{{ videosError }}</div></transition>
                                    <transition name="tab-fade"><div v-if="videosSuccess" class="login-alert login-alert-success">{{ videosSuccess }}</div></transition>

                                    <div class="list-tabs">
                                        <button
                                            v-for="type in Object.keys(VIDEO_LIST_LABELS_)"
                                            :key="type"
                                            class="list-tab"
                                            :class="{ active: videosListType === type }"
                                            @click="videosListType = type"
                                        >{{ VIDEO_LIST_LABELS_[type] }}</button>
                                    </div>

                                    <p v-if="myCompletionsLoading" style="opacity: 0.6; margin-top: 1rem;">Loading your records...</p>

                                    <template v-else>
                                        <p
                                            v-if="myCompletionsForType.length === 0"
                                            style="opacity: 0.5; padding: 1rem 0;"
                                        >No records on this list.</p>

                                        <template v-else>
                                            <div style="display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; margin-top: 1rem;">
                                                <input
                                                    type="text"
                                                    v-model="videosSearch"
                                                    placeholder="Search by name..."
                                                    class="login-input"
                                                    style="flex: 1; min-width: 10rem;"
                                                >
                                                <div class="list-tabs" style="margin: 0; border-bottom: none; padding-inline: 0;">
                                                    <button
                                                        v-for="f in ['all', 'custom', 'default']"
                                                        :key="f"
                                                        type="button"
                                                        class="list-tab"
                                                        :class="{ active: videosFilter === f }"
                                                        @click="videosFilter = f"
                                                    >{{ f === 'all' ? 'All' : (f === 'custom' ? 'Custom' : 'Default') }}</button>
                                                </div>
                                            </div>

                                            <div class="video-entries-scroll">
                                            <transition name="tab-fade">
                                            <p
                                                v-if="myCompletionsFiltered.length === 0"
                                                key="empty"
                                                style="opacity: 0.5; padding: 1rem;"
                                            >No levels match your search/filter.</p>
                                            </transition>
                                            <transition-group name="row-fade" tag="div">
                                            <div
                                                v-for="entry in myCompletionsFiltered"
                                                :key="entry.name"
                                                class="video-entry-row"
                                            >
                                                <div style="min-width: 0;">
                                                    <p class="type-title-sm" style="margin: 0; overflow-wrap: break-word;">{{ entry.name }}</p>
                                                    <p style="margin: 0.2rem 0 0; font-size: 0.8rem; opacity: 0.5;">
                                                        {{ videosMap[entry.name] ? 'Custom video set' : 'Using default video' }}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    class="login-btn"
                                                    style="width: auto; padding: 0.55rem 1rem; margin: 0; flex-shrink: 0;"
                                                    @click="openVideoEditor(entry)"
                                                >Edit Video</button>
                                            </div>
                                            </transition-group>
                                            </div>
                                        </template>

                                        <button
                                            class="login-btn"
                                            :disabled="savingVideos"
                                            @click="saveVideos"
                                            style="margin-top: 1.5rem;"
                                        >{{ savingVideos ? 'Saving...' : 'Save Videos' }}</button>
                                    </template>
                                </template>
                            </template>

                            </div>
                            </transition>
                        </div>
                    </div>
                </template>

            </div>

            <!-- ================= EDIT VIDEO POPUP ================= -->
            <transition name="tab-fade">
            <div
                v-if="editingVideoLevel"
                class="page-settings"
                style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem;"
                @click.self="closeVideoEditor"
            >
                <div style="background-color: var(--color-background); border: 1px solid var(--card-border); border-radius: 12px; width: 100%; max-width: 480px; box-sizing: border-box; padding: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p class="type-label-lg" style="margin: 0;">Edit Video — {{ editingVideoLevel.name }}</p>
                        <button type="button" @click="closeVideoEditor" style="background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer; opacity: 0.6;">✕</button>
                    </div>

                    <input
                        type="text"
                        v-model="editingVideoLink"
                        placeholder="https://youtu.be/... (leave empty to use the default video)"
                        class="login-input"
                        style="margin-top: 1rem;"
                    >

                    <div class="video-preview-box">
                        <transition name="tab-fade" mode="out-in">
                        <iframe
                            v-if="editingVideoPreviewSrc"
                            key="preview"
                            :src="editingVideoPreviewSrc"
                            frameborder="0"
                            allowfullscreen
                        ></iframe>
                        <p v-else key="empty" style="opacity: 0.4; font-size: 0.85rem; padding: 0 1rem; text-align: center;">
                            {{ editingVideoLink.trim() ? "Couldn't find a video for that link" : 'Paste a link above to preview it' }}
                        </p>
                        </transition>
                    </div>

                    <button
                        type="button"
                        class="login-btn"
                        style="margin-top: 1.25rem;"
                        @click="confirmVideoEditor"
                    >Confirm</button>
                </div>
            </div>
            </transition>

            <AvatarCropper
                v-if="cropperOpen"
                :image-src="rawImageSrc"
                @cropped="handleCropped"
                @cancel="closeCropper"
            ></AvatarCropper>
        </main>
    `,
    computed: {
        filteredClaimNames() {
            if (!this.claimSearch) return this.claimAvailableNames.slice(0, 50);
            const q = this.claimSearch.toLowerCase();
            return this.claimAvailableNames
                .filter((name) => name.toLowerCase().includes(q))
                .slice(0, 50);
        },
        renameCooldownDaysLeft() {
            if (!store.profile || !store.profile.name_changed_at) return 0;
            const last = new Date(store.profile.name_changed_at).getTime();
            const daysSince = (Date.now() - last) / (1000 * 60 * 60 * 24);
            return Math.max(0, Math.ceil(7 - daysSince));
        },
        myCompletionsForType() {
            return this.myCompletions[this.videosListType] || [];
        },
        myCompletionsFiltered() {
            let list = this.myCompletionsForType;
            if (this.videosFilter === 'custom') {
                list = list.filter((e) => !!this.videosMap[e.name]);
            } else if (this.videosFilter === 'default') {
                list = list.filter((e) => !this.videosMap[e.name]);
            }
            const q = this.videosSearch.trim().toLowerCase();
            if (q) {
                list = list.filter((e) => e.name.toLowerCase().includes(q));
            }
            return list;
        },
        editingVideoPreviewSrc() {
            const link = this.editingVideoLink.trim();
            if (!link) return null;
            const id = getYoutubeIdFromUrl(link);
            if (!id) return null;
            return embed(link);
        },
    },
    async mounted() {
        if (!store.user) {
            this.loading = false;
            return;
        }

        await store.refreshProfile();

        if (store.profile) {
            this.avatar = store.profile.avatar || '';
            this.bio = store.profile.bio || '';
            this.youtube = store.profile.youtube || '';
            this.twitter = store.profile.twitter || '';
            this.discord = store.profile.discord || '';
        }

        await this.loadClaimData();

        this.loading = false;
    },
    methods: {
        handleFileSelect(event) {
            const file = event.target.files[0];
            if (!file) return;

            this.error = null;

            if (!ALLOWED_TYPES.includes(file.type)) {
                this.error = 'Only JPG, PNG or WEBP images are allowed.';
                event.target.value = '';
                return;
            }

            if (file.size > MAX_FILE_SIZE) {
                this.error = 'File is too large. Max size is 3MB.';
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                this.rawImageSrc = e.target.result;
                this.cropperOpen = true;
            };
            reader.readAsDataURL(file);

            event.target.value = '';
        },

        closeCropper() {
            this.cropperOpen = false;
            this.rawImageSrc = null;
        },

        async handleCropped(blob) {
            this.cropperOpen = false;
            this.uploading = true;
            this.error = null;

            try {
                const userId = store.user.id;
                const filePath = userId + '/avatar.png';

                await supabase.storage
                    .from('avatars')
                    .remove([userId + '/avatar.jpg', userId + '/avatar.webp']);

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, blob, {
                        upsert: true,
                        contentType: 'image/png',
                    });

                if (uploadError) {
                    this.error = 'Failed to upload image. Try again.';
                    this.uploading = false;
                    return;
                }

                const { data: publicUrlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                this.avatar = publicUrlData.publicUrl + '?t=' + Date.now();
            } catch (err) {
                console.error('Avatar upload error:', err);
                this.error = 'Something went wrong uploading the image.';
            }

            this.uploading = false;
            this.rawImageSrc = null;
        },

        async saveProfile() {
            this.saving = true;
            this.error = null;
            this.success = null;

            const { error } = await supabase
                .from('profiles')
                .update({
                    avatar: this.avatar || null,
                    bio: this.bio || null,
                    youtube: this.youtube || null,
                    twitter: this.twitter || null,
                    discord: this.discord || null,
                })
                .eq('id', store.user.id);

            if (error) {
                this.error = 'Failed to save changes. Try again.';
                this.saving = false;
                return;
            }

            await store.refreshProfile();

            this.success = 'Profile updated successfully!';
            this.saving = false;
        },

        async submitRename() {
            if (!this.newName.trim()) return;

            this.renaming = true;
            this.renameError = null;
            this.renameSuccess = null;

            try {
                const { data: { session } } = await supabase.auth.getSession();
                const targetName = this.newName.trim();

                let body = { newName: targetName };
                let totalUpdated = 0;
                let done = false;

                while (!done) {
                    const res = await fetch('/api/rename-player', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify(body),
                    });

                    let result;
                    try {
                        result = await res.json();
                    } catch {
                        throw new Error('The server cut the response short (likely hit a request limit). Try again — it usually works on retry since each batch is smaller now.');
                    }

                    if (!res.ok) {
                        throw new Error(result.error || 'Failed to rename.');
                    }

                    totalUpdated += result.filesUpdated;
                    done = result.done;

                    if (!done) {
                        body = {
                            newName: targetName,
                            oldName: result.oldName,
                            phase: result.phase,
                            scanQueue: result.scanQueue,
                            updateQueue: result.updateQueue,
                            totalScanFiles: result.totalScanFiles,
                            scannedSoFar: result.scannedSoFar,
                            totalWriteFiles: result.totalWriteFiles,
                            writtenSoFar: result.writtenSoFar,
                        };
                        this.renameSuccess = result.progressLabel || 'Working...';
                    }
                }

                this.renameSuccess = `Renamed successfully! ${totalUpdated} level file${totalUpdated === 1 ? '' : 's'} updated.`;
                this.newName = '';
                await store.refreshProfile();
            } catch (err) {
                this.renameError = err.message;
                this.renameSuccess = null;
            } finally {
                this.renaming = false;
            }
        },

        async loadMyCompletions() {
            if (!store.profile || !store.profile.list_name) return;
            if (this.myCompletions[this.videosListType].length > 0) return; // already loaded once

            this.myCompletionsLoading = true;
            try {
                const { data: profileRow } = await supabase
                    .from('profiles')
                    .select('videos')
                    .eq('id', store.user.id)
                    .single();
                this.videosMap = { ...(profileRow?.videos || {}) };

                const name = store.profile.list_name.toLowerCase();

                for (const type of Object.keys(LEADERBOARD_FETCHERS)) {
                    if (this.myCompletions[type].length > 0) continue;

                    const [leaderboard] = await LEADERBOARD_FETCHERS[type]();
                    const entry = leaderboard.find((e) => e.user.toLowerCase() === name);
                    if (!entry) continue;

                    const rows = entry.completed.map((s) => ({ name: s.level, kind: 'completed' }));
                    this.myCompletions[type] = rows;

                    rows.forEach((r) => {
                        if (!(r.name in this.videosMap)) this.videosMap[r.name] = '';
                    });
                }
            } catch (err) {
                this.videosError = 'Failed to load your records.';
            } finally {
                this.myCompletionsLoading = false;
            }
        },

        async saveVideos() {
            this.savingVideos = true;
            this.videosError = null;
            this.videosSuccess = null;

            // Só manda links preenchidos — campos vazios não sobrescrevem com string vazia.
            const cleaned = {};
            Object.entries(this.videosMap).forEach(([name, link]) => {
                if (link && link.trim()) cleaned[name] = link.trim();
            });

            const { error } = await supabase
                .from('profiles')
                .update({ videos: cleaned })
                .eq('id', store.user.id);

            if (error) {
                this.videosError = 'Failed to save videos.';
            } else {
                this.videosSuccess = 'Videos saved!';
                await store.refreshProfile();
            }
            this.savingVideos = false;
        },

        openVideoEditor(entry) {
            this.editingVideoLevel = entry;
            this.editingVideoLink = this.videosMap[entry.name] || '';
        },
        closeVideoEditor() {
            this.editingVideoLevel = null;
            this.editingVideoLink = '';
        },
        confirmVideoEditor() {
            this.videosMap[this.editingVideoLevel.name] = this.editingVideoLink.trim();
            this.closeVideoEditor();
        },

        async loadClaimData() {
            if (store.profile && store.profile.list_name) return;

            try {
                const { data: existingRequest } = await supabase
                    .from('claim_requests')
                    .select('*')
                    .eq('user_id', store.user.id)
                    .eq('status', 'pending')
                    .maybeSingle();

                this.myClaimRequest = existingRequest || null;
                if (this.myClaimRequest) return;

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

                this.claimAvailableNames = [...allNames]
                    .filter((name) => !claimedSet.has(name.toLowerCase()))
                    .sort((a, b) => a.localeCompare(b));
            } catch (err) {
                console.error('Claim data error:', err);
                this.claimError = 'Failed to load claim data.';
            }
        },

        async submitClaim() {
            if (!this.claimSelected) return;
            this.claimSubmitting = true;
            this.claimError = null;

            const { error } = await supabase
                .from('claim_requests')
                .insert({
                    user_id: store.user.id,
                    list_name: this.claimSelected,
                });

            if (error) {
                this.claimError = 'Failed to submit request. Try again.';
                this.claimSubmitting = false;
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
                            message: `New claim request: "${this.claimSelected}"`,
                            link: '/admin/claims',
                        })),
                    );
                }
            } catch (notifErr) {
                console.error('Failed to notify staff:', notifErr);
            }

            this.claimSuccess = 'Request submitted! An admin will review it soon.';
            this.myClaimRequest = { list_name: this.claimSelected };
            this.claimSubmitting = false;
        },

        async unclaimAccount() {
            const name = store.profile.list_name;
            const confirmed = window.confirm(
                `Unlink your account from "${name}"? This won't change or remove anything from the list — you'll just need to claim a name again to see your records here.`
            );
            if (!confirmed) return;

            this.unclaiming = true;
            this.unclaimError = null;

            const { error } = await supabase
                .from('profiles')
                .update({ list_name: null })
                .eq('id', store.user.id);

            if (error) {
                this.unclaimError = 'Failed to unclaim account. Try again.';
                this.unclaiming = false;
                return;
            }

            await store.refreshProfile();
            this.myClaimRequest = null;
            this.claimSelected = '';
            this.unclaiming = false;
        },
    },
};
