import { fetchList, fetchChallengeList, fetchImpossibleList } from '../content.js';
import { getThumbnailFromId, getYoutubeIdFromUrl, shuffle } from '../util.js';

import Spinner from '../components/Spinner.js';
import Btn from '../components/Btn.js';

const FETCHERS = {
    classic: fetchList,
    challenge: fetchChallengeList,
    impossible: fetchImpossibleList,
};

export default {
    components: { Spinner, Btn },
    template: `
        <transition name="tab-fade" mode="out-in">
        <main v-if="loading" key="loading">
            <Spinner></Spinner>
        </main>
        <main v-else key="roulette" class="page-roulette">
            <div class="sidebar">
                <p class="type-label-lg" style="opacity: 0.6;">
                    Shameless copy of the Extreme Demon Roulette by <a href="https://matcool.github.io/extreme-demon-roulette/" target="_blank">matcool</a>.
                </p>
                <div class="roulette-category" style="position: relative; width: 100%;">
                    <button
                        type="button"
                        class="list-tab"
                        @click="categoryMenuOpen = !categoryMenuOpen"
                        style="display: flex; align-items: center; width: 100%; box-sizing: border-box; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 0.9rem 1.1rem;"
                    >
                        <span class="type-label-lg" style="flex: 1; text-align: center; padding-right: 0.5rem;">{{ MODE_LABELS_[mode] }}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;" :style="{ transform: categoryMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }">
                            <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </button>
                    <transition name="dropdown-fade">
                    <div
                        v-if="categoryMenuOpen"
                        style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 0.4rem; background-color: var(--color-background); background-image: linear-gradient(135deg, rgba(255, 0, 17, 0.15), transparent 60%); border: 1.5px solid rgba(0, 0, 0, 0.6); border-radius: 8px; overflow: hidden; z-index: 20;"
                    >
                        <button
                            type="button"
                            v-for="m in ['classic', 'challenge', 'impossible']"
                            :key="m"
                            @click="mode = m; categoryMenuOpen = false;"
                            class="type-label-lg"
                            :style="{
                                display: 'block', width: '100%', textAlign: 'center', padding: '0.85rem 0.9rem',
                                border: 'none', cursor: 'pointer',
                                backgroundColor: mode === m ? 'var(--color-primary)' : 'transparent',
                                color: mode === m ? '#ffffff' : 'inherit',
                            }"
                        >{{ MODE_LABELS_[m] }}</button>
                    </div>
                    </transition>
                    <div v-if="categoryMenuOpen" @click="categoryMenuOpen = false" style="position: fixed; inset: 0; z-index: 10;"></div>
                </div>
                <Btn @click.native.prevent="onStart">{{ levels.length === 0 ? 'Start' : 'Restart'}}</Btn>
                <p class="type-label-md" style="opacity: 0.6;">
                    The roulette saves automatically.
                </p>
                <div class="roulette-save-card">
                    <p class="type-label-lg">Manual Load/Save</p>
                    <div class="btns">
                        <Btn @click.native.prevent="onImport">Import</Btn>
                        <Btn :disabled="!isActive" @click.native.prevent="onExport">Export</Btn>
                    </div>
                </div>
            </div>
            <section v-if="levels.length > 0" class="levels-container">
                <div class="levels">
                    <template v-if="levels.length > 0">
                        <!-- Completed Levels -->
                        <div class="level" v-for="(level, i) in levels.slice(0, progression.length)" :key="level.id">
                            <a :href="level.video" class="video">
                                <img
                                    class="thumb"
                                    :src="getThumbnailFromId(getYoutubeIdFromUrl(level.video))"
                                    alt=""
                                    @load="$event.target.classList.add('loaded')"
                                >
                            </a>
                            <div class="meta">
                                <p>#{{ level.rank }}</p>
                                <h2>{{ level.name }}</h2>
                                <p style="color: #22c55e; font-weight: 700">{{ progression[i] }}%</p>
                            </div>
                        </div>
                        <!-- Current Level -->
                        <transition name="tab-fade" mode="out-in">
                        <div class="level" v-if="!hasCompleted" :key="currentLevel.id">
                            <a :href="currentLevel.video" target="_blank" class="video">
                                <img
                                    class="thumb"
                                    :src="getThumbnailFromId(getYoutubeIdFromUrl(currentLevel.video))"
                                    alt=""
                                    @load="$event.target.classList.add('loaded')"
                                >
                            </a>
                            <div class="meta">
                                <p>#{{ currentLevel.rank }}</p>
                                <h2>{{ currentLevel.name }}</h2>
                                <p>{{ currentLevel.id }}</p>
                            </div>
                            <form class="actions" v-if="!givenUp">
                                <input type="number" v-model="percentage" :placeholder="placeholder" :min="currentPercentage + 1" max=100>
                                <Btn @click.native.prevent="onDone">Done</Btn>
                                <Btn @click.native.prevent="onGiveUp" class="give-up-btn">Give Up</Btn>
                            </form>
                        </div>
                        </transition>
                        <!-- Results -->
                        <transition name="tab-fade">
                        <div v-if="givenUp || hasCompleted" class="results">
                            <h1>Results</h1>
                            <p>Number of levels: {{ progression.length }}</p>
                            <p>Highest percent: {{ currentPercentage }}%</p>
                            <Btn v-if="currentPercentage < 99 && !hasCompleted" @click.native.prevent="showRemaining = true">Show remaining levels</Btn>
                        </div>
                        </transition>
                        <!-- Remaining Levels -->
                        <template v-if="givenUp && showRemaining">
                            <div class="level" v-for="(level, i) in levels.slice(progression.length + 1, levels.length - currentPercentage + progression.length)" :key="level.id">
                                <a :href="level.video" target="_blank" class="video">
                                    <img
                                        class="thumb"
                                        :src="getThumbnailFromId(getYoutubeIdFromUrl(level.video))"
                                        alt=""
                                        @load="$event.target.classList.add('loaded')"
                                    >
                                </a>
                                <div class="meta">
                                    <p>#{{ level.rank }}</p>
                                    <h2>{{ level.name }}</h2>
                                    <p style="color: var(--color-error); font-weight: 700">{{ currentPercentage + 2 + i }}%</p>
                                </div>
                            </div>
                        </template>
                    </template>
                </div>
            </section>
            <div class="toasts-container">
                <div class="toasts">
                    <div v-for="toast in toasts" class="toast">
                        <p>{{ toast }}</p>
                    </div>
                </div>
            </div>
        </main>
        </transition>
    `,
    data: () => ({
        loading: false,
        levels: [],
        progression: [], // list of percentages completed
        percentage: undefined,
        givenUp: false,
        showRemaining: false,
        mode: 'classic', // 'classic', 'challenge', or 'impossible'
        categoryMenuOpen: false,
        MODE_LABELS_: {
            classic: 'Main List',
            challenge: 'Challenge List',
            impossible: 'Impossible List',
        },
        toasts: [],
        fileInput: undefined,
    }),
    mounted() {
        // Create File Input
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.multiple = false;
        this.fileInput.accept = '.json';
        this.fileInput.addEventListener('change', this.onImportUpload);

        // Load progress from local storage
        const roulette = JSON.parse(localStorage.getItem('roulette'));

        if (!roulette) {
            return;
        }

        this.levels = roulette.levels;
        this.progression = roulette.progression;
    },
    computed: {
        currentLevel() {
            return this.levels[this.progression.length];
        },
        currentPercentage() {
            return this.progression[this.progression.length - 1] || 0;
        },
        placeholder() {
            return `At least ${this.currentPercentage + 1}%`;
        },
        hasCompleted() {
            return (
                this.progression[this.progression.length - 1] >= 100 ||
                this.progression.length === this.levels.length
            );
        },
        isActive() {
            return (
                this.progression.length > 0 &&
                !this.givenUp &&
                !this.hasCompleted
            );
        },
    },
    methods: {
        shuffle,
        getThumbnailFromId,
        getYoutubeIdFromUrl,
        async onStart() {
            if (this.isActive) {
                this.showToast('Give up before starting a new roulette.');
                return;
            }

            this.loading = true;

            const fullList = await FETCHERS[this.mode]();

            if (!fullList || fullList.filter(([_, err]) => err).length > 0) {
                this.loading = false;
                this.showToast(
                    'List is currently broken. Wait until it\'s fixed to start a roulette.',
                );
                return;
            }

            const fullListMapped = fullList.map(([lvl, _], i) => ({
                rank: i + 1,
                id: lvl.id,
                name: lvl.name,
                video: lvl.verification,
            }));

            // random 100 levels (or all of them, if the list has fewer than 100)
            this.levels = shuffle(fullListMapped).slice(0, 100);
            this.showRemaining = false;
            this.givenUp = false;
            this.progression = [];
            this.percentage = undefined;

            this.loading = false;
        },
        save() {
            localStorage.setItem(
                'roulette',
                JSON.stringify({
                    levels: this.levels,
                    progression: this.progression,
                }),
            );
        },
        onDone() {
            if (!this.percentage) {
                return;
            }

            if (
                this.percentage <= this.currentPercentage ||
                this.percentage > 100
            ) {
                this.showToast('Invalid percentage.');
                return;
            }

            this.progression.push(this.percentage);
            this.percentage = undefined;

            this.save();
        },
        onGiveUp() {
            this.givenUp = true;

            // Save progress
            localStorage.removeItem('roulette');
        },
        onImport() {
            if (
                this.isActive &&
                !window.confirm('This will overwrite the currently running roulette. Continue?')
            ) {
                return;
            }

            this.fileInput.showPicker();
        },
        async onImportUpload() {
            if (this.fileInput.files.length === 0) return;

            const file = this.fileInput.files[0];

            if (file.type !== 'application/json') {
                this.showToast('Invalid file.');
                return;
            }

            try {
                const roulette = JSON.parse(await file.text());

                if (!roulette.levels || !roulette.progression) {
                    this.showToast('Invalid file.');
                    return;
                }

                this.levels = roulette.levels;
                this.progression = roulette.progression;
                this.save();
                this.givenUp = false;
                this.showRemaining = false;
                this.percentage = undefined;
            } catch {
                this.showToast('Invalid file.');
                return;
            }
        },
        onExport() {
            const file = new Blob(
                [JSON.stringify({
                    levels: this.levels,
                    progression: this.progression,
                })],
                { type: 'application/json' },
            );
            const a = document.createElement('a');
            a.href = URL.createObjectURL(file);
            a.download = 'tsl_roulette';
            a.click();
            URL.revokeObjectURL(a.href);
        },
        showToast(msg) {
            this.toasts.push(msg);
            setTimeout(() => {
                this.toasts.shift();
            }, 3000);
        },
    },
};
