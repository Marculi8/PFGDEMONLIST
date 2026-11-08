// Componente de recorte de avatar: modal com zoom + arraste dentro de um círculo.
// Emite 'cropped' com um Blob da imagem já recortada em quadrado (PNG).
// Emite 'cancel' quando o usuário cancela.

const OUTPUT_SIZE = 400;
const STAGE_SIZE = 280;

export default {
    props: {
        imageSrc: { type: String, required: true },
    },
    emits: ['cropped', 'cancel'],
    data: () => ({
        zoom: 1,
        minZoom: 1,
        maxZoom: 3,
        offsetX: 0,
        offsetY: 0,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        imgNaturalWidth: 0,
        imgNaturalHeight: 0,
        img: null,
        exporting: false,
        baseDisplayWidth: 0,
        baseDisplayHeight: 0,
    }),
    template: `
        <div class="cropper-overlay" @click.self="$emit('cancel')">
            <div class="cropper-modal">
                <div class="cropper-header">
                    <h3 style="margin: 0;">Edit Image</h3>
                    <button class="cropper-close" @click="$emit('cancel')">&times;</button>
                </div>

                <div
                    class="cropper-stage"
                    ref="stage"
                    @mousedown="startDrag"
                    @touchstart="startDrag"
                    @wheel.prevent="handleWheel"
                >
                    <img
                        v-if="img"
                        :src="imageSrc"
                        class="cropper-image"
                        :style="imageStyle"
                        draggable="false"
                    >
                    <div class="cropper-circle-mask"></div>
                </div>

                <div class="cropper-controls">
                    <span class="cropper-zoom-icon">🔍</span>
                    <input
                        type="range"
                        :min="minZoom"
                        :max="maxZoom"
                        step="0.01"
                        v-model.number="zoom"
                        class="cropper-slider"
                        @input="clampOffset"
                    >
                    <span class="cropper-zoom-icon" style="font-size: 1.2rem;">🔍</span>
                </div>

                <div class="cropper-actions">
                    <button class="login-btn" style="background: none; border: 1px solid var(--color-background-hover); color: var(--color-on-background); width: auto; padding: 0.6rem 1.25rem;" @click="reset">
                        Reset
                    </button>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="login-btn" style="background: var(--color-background-hover); color: var(--color-on-background); width: auto; padding: 0.6rem 1.25rem;" @click="$emit('cancel')">
                            Cancel
                        </button>
                        <button class="login-btn" style="width: auto; padding: 0.6rem 1.25rem;" :disabled="exporting" @click="applyCrop">
                            {{ exporting ? 'Applying...' : 'Apply' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    computed: {
        displayWidth() {
            return this.baseDisplayWidth * this.zoom;
        },
        displayHeight() {
            return this.baseDisplayHeight * this.zoom;
        },
        imageStyle() {
            return {
                width: this.displayWidth + 'px',
                height: this.displayHeight + 'px',
                transform: 'translate(-50%, -50%) translate(' + this.offsetX + 'px, ' + this.offsetY + 'px)',
            };
        },
    },
    mounted() {
        const img = new Image();
        img.onload = () => {
            this.imgNaturalWidth = img.naturalWidth;
            this.imgNaturalHeight = img.naturalHeight;
            this.img = img;
            this.$nextTick(() => this.computeBaseSize());
        };
        img.src = this.imageSrc;

        window.addEventListener('mousemove', this.onDrag);
        window.addEventListener('mouseup', this.stopDrag);
        window.addEventListener('touchmove', this.onDrag, { passive: false });
        window.addEventListener('touchend', this.stopDrag);
    },
    beforeUnmount() {
        window.removeEventListener('mousemove', this.onDrag);
        window.removeEventListener('mouseup', this.stopDrag);
        window.removeEventListener('touchmove', this.onDrag);
        window.removeEventListener('touchend', this.stopDrag);
    },
    methods: {
        computeBaseSize() {
            const imgRatio = this.imgNaturalWidth / this.imgNaturalHeight;

            if (imgRatio > 1) {
                this.baseDisplayHeight = STAGE_SIZE;
                this.baseDisplayWidth = STAGE_SIZE * imgRatio;
            } else {
                this.baseDisplayWidth = STAGE_SIZE;
                this.baseDisplayHeight = STAGE_SIZE / imgRatio;
            }

            this.offsetX = 0;
            this.offsetY = 0;
            this.minZoom = 1;
            this.zoom = 1;
        },

        reset() {
            this.computeBaseSize();
        },

        startDrag(e) {
            this.dragging = true;
            const point = e.touches ? e.touches[0] : e;
            this.dragStartX = point.clientX - this.offsetX;
            this.dragStartY = point.clientY - this.offsetY;
        },

        onDrag(e) {
            if (!this.dragging) return;
            e.preventDefault?.();
            const point = e.touches ? e.touches[0] : e;
            this.offsetX = point.clientX - this.dragStartX;
            this.offsetY = point.clientY - this.dragStartY;
            this.clampOffset();
        },

        stopDrag() {
            this.dragging = false;
        },

        handleWheel(e) {
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom + delta));
            this.clampOffset();
        },

        clampOffset() {
            const maxOffsetX = Math.max(0, (this.displayWidth - STAGE_SIZE) / 2);
            const maxOffsetY = Math.max(0, (this.displayHeight - STAGE_SIZE) / 2);

            this.offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, this.offsetX));
            this.offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, this.offsetY));
        },

        async applyCrop() {
            this.exporting = true;

            const canvas = document.createElement('canvas');
            canvas.width = OUTPUT_SIZE;
            canvas.height = OUTPUT_SIZE;
            const ctx = canvas.getContext('2d');

            ctx.save();
            ctx.beginPath();
            ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            const ratio = OUTPUT_SIZE / STAGE_SIZE;

            const finalWidth = this.displayWidth * ratio;
            const finalHeight = this.displayHeight * ratio;

            const centerX = OUTPUT_SIZE / 2 + this.offsetX * ratio;
            const centerY = OUTPUT_SIZE / 2 + this.offsetY * ratio;

            ctx.drawImage(
                this.img,
                centerX - finalWidth / 2,
                centerY - finalHeight / 2,
                finalWidth,
                finalHeight,
            );

            ctx.restore();

            canvas.toBlob((blob) => {
                this.exporting = false;
                this.$emit('cropped', blob);
            }, 'image/png', 0.92);
        },
    },
};
