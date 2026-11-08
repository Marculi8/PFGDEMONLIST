import { store } from "../main.js";
import { supabase } from "../supabase.js";
import {
    fetchList,
    fetchPlatformerList,
    fetchChallengeList,
    fetchImpossibleList,
} from "../content.js";

import Spinner from "../components/Spinner.js";

const LIST_FETCHERS = {
    classic: fetchList,
    platformer: fetchPlatformerList,
    challenge: fetchChallengeList,
    impossible: fetchImpossibleList,
};

const LIST_LABELS = {
    classic: "Classic",
    platformer: "Platformer",
    challenge: "Challenge",
    impossible: "Impossible",
};

export default {
    components: { Spinner },
    props: {
        id: { type: String, required: true },
    },
    template: `
        <transition name="tab-fade" mode="out-in">
        <main v-if="loading" key="loading">
            <Spinner></Spinner>
        </main>
        <main v-else-if="!pack" key="notfound">
            <div style="grid-column: span 3; padding: 2rem; text-align: center;">
                <p>Pack not found.</p>
                <router-link to="/packs" style="color: inherit; text-decoration: underline;">Back to Packs</router-link>
            </div>
        </main>
        <main v-else key="loaded" class="page-list">
            <div style="grid-column: span 3; padding: 2rem; max-width: 700px; margin: 0 auto;">

                <div style="text-align: center;">
                    <span v-if="pack.icon_emoji" style="font-size: 2.5rem; display: block;">{{ pack.icon_emoji }}</span>
                    <img v-else-if="pack.icon_image_url" :src="pack.icon_image_url" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto;">
                    <h1 style="margin: 0.5rem 0 0;">{{ pack.name }}</h1>
                    <p v-if="pack.tagline" style="opacity: 0.7; margin: 0.5rem 0 0;">{{ pack.tagline }}</p>

                    <span
                        v-if="tier"
                        class="type-label-lg"
                        :style="{
                            display: 'inline-block', marginTop: '0.85rem', padding: '0.4rem 1rem', borderRadius: '999px',
                            color: '#14141a', textShadow: '0 1px 2px rgba(255,255,255,0.35)',
                            backgroundImage: 'linear-gradient(135deg, ' + tier.gradient_from + ', ' + tier.gradient_to + ')',
                        }"
                    >{{ tier.name }} Tier</span>
                </div>

                <div v-if="store.user" style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <p class="type-label-lg" style="margin: 0;">Progress</p>
                        <span style="opacity: 0.7;">{{ completedCount }}/{{ levels.length }}</span>
                    </div>
                    <div style="margin-top: 0.5rem; height: 8px; border-radius: 999px; background-color: var(--card-bg); overflow: hidden;">
                        <div
                            v-if="tier"
                            :style="{ width: percent + '%', height: '100%', backgroundImage: 'linear-gradient(90deg, ' + tier.gradient_from + ', ' + tier.gradient_to + ')', transition: 'width 0.3s ease' }"
                        ></div>
                    </div>
                    <p v-if="justCompleted" style="text-align: center; opacity: 0.8; margin-top: 0.6rem; font-size: 0.85rem;">🎉 You just completed this pack!</p>
                </div>

                <h2 style="margin-top: 1.75rem;">Levels</h2>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem;">
                    <div
                        v-for="lvl in levels"
                        :key="lvl.id"
                        style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 10px; background-color: var(--card-bg); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.08), transparent 60%);"
                    >
                        <svg v-if="lvl.done" width="20" height="20" viewBox="0 0 24 24" style="flex-shrink: 0;">
                            <circle cx="12" cy="12" r="11" fill="#22c55e" />
                            <path d="M7 12.5 L10.5 16 L17 8.5" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <span v-else style="flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--card-border); box-sizing: border-box;"></span>

                        <span style="flex: 1; min-width: 0;">{{ lvl.level_name }} <span style="opacity: 0.5; font-size: 0.8rem;">({{ LIST_LABELS_[lvl.list_type] }})</span></span>
                        <span style="opacity: 0.7; font-size: 0.85rem; flex-shrink: 0;">{{ lvl.points }} pts</span>
                    </div>
                </div>

                <h2 style="margin-top: 1.75rem;">Victors <span style="opacity: 0.5;">({{ victors.length }})</span></h2>
                <p v-if="victors.length === 0" style="opacity: 0.5; margin-top: 0.5rem;">Nobody has completed this pack yet.</p>
                <transition-group name="row-fade" tag="div" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem;">
                    <div
                        v-for="v in victors"
                        :key="v.id"
                        style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.65rem 1rem; border-radius: 10px; background-color: var(--card-bg);"
                    >
                        <router-link :to="'/player/' + v.player_name" style="color: inherit; text-decoration: none;" class="type-label-lg">{{ v.player_name }}</router-link>
                        <span style="opacity: 0.5; font-size: 0.8rem;">{{ new Date(v.completed_at).toLocaleString() }}</span>
                    </div>
                </transition-group>
            </div>
        </main>
        </transition>
    `,
    data: () => ({
        store,
        loading: true,
        pack: null,
        tier: null,
        levels: [],
        victors: [],
        justCompleted: false,
    }),
    created() {
        this.LIST_LABELS_ = LIST_LABELS;
    },
    async mounted() {
        await this.loadPack();
        this.loading = false;
    },
    computed: {
        completedCount() {
            return this.levels.filter((l) => l.done).length;
        },
        percent() {
            return this.levels.length > 0 ? Math.round((this.completedCount / this.levels.length) * 100) : 0;
        },
    },
    methods: {
        async loadPack() {
            const { data: pack } = await supabase.from("packs").select("*").eq("id", this.id).single();
            if (!pack) return;
            this.pack = pack;

            const [{ data: tier }, { data: levels }, { data: victors }] = await Promise.all([
                pack.tier_id ? supabase.from("pack_tiers").select("*").eq("id", pack.tier_id).single() : Promise.resolve({ data: null }),
                supabase.from("pack_levels").select("*").eq("pack_id", this.id).order("sort_order", { ascending: true }),
                supabase.from("pack_victors").select("*").eq("pack_id", this.id).order("completed_at", { ascending: true }),
            ]);

            this.tier = tier || null;
            this.levels = (levels || []).map((l) => ({ ...l, done: false }));
            this.victors = victors || [];

            if (store.user) {
                await this.checkCompletion();
            }
        },

        async checkCompletion() {
            const neededTypes = [...new Set(this.levels.map((l) => l.list_type))];
            const results = await Promise.all(neededTypes.map((t) => LIST_FETCHERS[t]()));

            const maps = {};
            neededTypes.forEach((type, i) => {
                const map = new Map();
                (results[i] || []).forEach(([level]) => {
                    if (level) map.set(level.path, level);
                });
                maps[type] = map;
            });

            const myName = (store.profile?.list_name || store.profile?.username || "").toLowerCase();
            if (!myName) return;

            this.levels.forEach((l) => {
                const level = maps[l.list_type]?.get(l.level_path);
                if (!level) return;
                const isVerifier = level.verifier && level.verifier.toLowerCase() === myName;
                const hasFullRecord = (level.records || []).some((r) => r.percent === 100 && r.user && r.user.toLowerCase() === myName);
                l.done = isVerifier || hasFullRecord;
            });

            const allDone = this.levels.length > 0 && this.levels.every((l) => l.done);
            const displayName = store.profile.list_name || store.profile.username;
            const alreadyVictor = this.victors.some((v) => v.player_name.toLowerCase() === displayName.toLowerCase());

            if (allDone && !alreadyVictor) {
                const { data: inserted, error } = await supabase
                    .from("pack_victors")
                    .insert({ pack_id: this.id, player_name: displayName })
                    .select()
                    .single();

                if (!error && inserted) {
                    this.victors.push(inserted);
                    this.justCompleted = true;
                }
            }
        },
    },
};
