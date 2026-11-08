// Componente de recorte livre (retangular, proporção livre) pras fotos dos
// progress reports dos Projects — irmão do AvatarCropper, mas sem forçar
// círculo/quadrado: você arrasta a caixa de corte pra escolher a área e a
// proporção que quiser.
// Emite 'cropped' com um Blob da imagem já recortada (PNG).
// Emite 'cancel' quando o usuário cancela.

const STAGE_MAX = 320; // maior lado da imagem exibida no modal, em px
const MIN_BOX = 32;    // tamanho mínimo da caixa de corte, em px de tela
const MAX_OUTPUT = 1600; // maior lado do arquivo exportado, em px

export default {
    props: {
        imageSrc: { type: String, required: true },
    },
    emits: ['cropped', 'cancel'],
    data: () => ({
        img: null,
        imgNaturalWidth: 0,
        imgNaturalHeight: 0,
        dispWidth: 0,
        dispHeight: 0,

        box: { x: 0, y: 0, w: 0, h: 0 },
        mode: null, // null | 'move' | 'nw' | 'ne' | 'sw' | 'se'
        pointerStart: { x: 0, y: 0 },
        boxStart: { x: 0, y: 0, w: 0, h: 0 },

        exporting: false,
    }),
    template: `
        <div class="cropper-overlay" @click.self="$emit('cancel')">
            <div class="cropper-modal">
                <div class="cropper-header">
                    <h3 style="margin: 0;">Edit Image</h3>
                    <button class="cropper-close" @click="$emit('cancel')">&times;</button>
                </div>

                <div
                    class="image-cropper-stage"
                    :style="{ width: dispWidth + 'px', height: dispHeight + 'px' }"
                >
                    <img v-if="img" :src="imageSrc" class="image-cropper-img" draggable="false">

                    <!-- Sombra fora da caixa de corte -->
                    <div class="image-cropper-shade" :style="{ clipPath: shadeClipPath }"></div>

                    <!-- Caixa de corte arrastável/redimensionável -->
                    <div
                        class="image-cropper-box"
                        :style="{ left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' }"
                        @mousedown="startMove"
                        @touchstart="startMove"
                    >
                        <div class="image-cropper-handle" style="left: -6px; top: -6px; cursor: nwse-resize;" @mousedown.stop="startResize('nw', $event)" @touchstart.stop="startResize('nw', $event)"></div>
                        <div class="image-cropper-handle" style="right: -6px; top: -6px; cursor: nesw-resize;" @mousedown.stop="startResize('ne', $event)" @touchstart.stop="startResize('ne', $event)"></div>
                        <div class="image-cropper-handle" style="left: -6px; bottom: -6px; cursor: nesw-resize;" @mousedown.stop="startResize('sw', $event)" @touchstart.stop="startResize('sw', $event)"></div>
                        <div class="image-cropper-handle" style="right: -6px; bottom: -6px; cursor: nwse-resize;" @mousedown.stop="startResize('se', $event)" @touchstart.stop="startResize('se', $event)"></div>
                    </div>
                </div>

                <p style="opacity: 0.5; font-size: 0.8rem; text-align: center; margin: 0.85rem 0 0;">
                    Drag the box to move it, drag a corner to resize.
                </p>

                <div class="cropper-actions" style="margin-top: 1.25rem;">
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
        // "Buraco" da caixa de corte recortado da sombra escura em volta (polígono com furo)
        shadeClipPath() {
            const { x, y, w, h } = this.box;
            const W = this.dispWidth;
            const H = this.dispHeight;
            return `polygon(0 0, 0 ${H}px, ${x}px ${H}px, ${x}px ${y}px, ${x + w}px ${y}px, ${x + w}px ${y + h}px, ${x}px ${y + h}px, ${x}px ${H}px, ${W}px ${H}px, ${W}px 0)`;
        },
    },
    mounted() {
        const img = new Image();
        img.onload = () => {
            this.imgNaturalWidth = img.naturalWidth;
            this.imgNaturalHeight = img.naturalHeight;
            this.img = img;
            this.$nextTick(() => this.computeDisplaySize());
        };
        img.src = this.imageSrc;

        window.addEventListener('mousemove', this.onPointerMove);
        window.addEventListener('mouseup', this.stopPointer);
        window.addEventListener('touchmove', this.onPointerMove, { passive: false });
        window.addEventListener('touchend', this.stopPointer);
    },
    beforeUnmount() {
        window.removeEventListener('mousemove', this.onPointerMove);
        window.removeEventListener('mouseup', this.stopPointer);
        window.removeEventListener('touchmove', this.onPointerMove);
        window.removeEventListener('touchend', this.stopPointer);
    },
    methods: {
        computeDisplaySize() {
            const ratio = this.imgNaturalWidth / this.imgNaturalHeight;
            if (ratio > 1) {
                this.dispWidth = STAGE_MAX;
                this.dispHeight = STAGE_MAX / ratio;
            } else {
                this.dispHeight = STAGE_MAX;
                this.dispWidth = STAGE_MAX * ratio;
            }
            this.resetBox();
        },

        resetBox() {
            // Começa com a caixa cobrindo 85% da imagem, centralizada.
            const w = this.dispWidth * 0.85;
            const h = this.dispHeight * 0.85;
            this.box = {
                x: (this.dispWidth - w) / 2,
                y: (this.dispHeight - h) / 2,
                w,
                h,
            };
        },

        reset() {
            this.resetBox();
        },

        pointFromEvent(e) {
            const point = e.touches ? e.touches[0] : e;
            return { x: point.clientX, y: point.clientY };
        },

        startMove(e) {
            this.mode = 'move';
            this.pointerStart = this.pointFromEvent(e);
            this.boxStart = { ...this.box };
        },

        startResize(corner, e) {
            this.mode = corner;
            this.pointerStart = this.pointFromEvent(e);
            this.boxStart = { ...this.box };
        },

        onPointerMove(e) {
            if (!this.mode) return;
            e.preventDefault?.();

            const point = this.pointFromEvent(e);
            const dx = point.x - this.pointerStart.x;
            const dy = point.y - this.pointerStart.y;
            const b = this.boxStart;

            if (this.mode === 'move') {
                this.box.x = this.clamp(b.x + dx, 0, this.dispWidth - b.w);
                this.box.y = this.clamp(b.y + dy, 0, this.dispHeight - b.h);
                return;
            }

            // Redimensiona a partir do canto oposto ao que está sendo arrastado.
            let { x, y, w, h } = b;

            if (this.mode.includes('n')) {
                const newY = this.clamp(b.y + dy, 0, b.y + b.h - MIN_BOX);
                h = b.h - (newY - b.y);
                y = newY;
            }
            if (this.mode.includes('s')) {
                h = this.clamp(b.h + dy, MIN_BOX, this.dispHeight - b.y);
            }
            if (this.mode.includes('w')) {
                const newX = this.clamp(b.x + dx, 0, b.x + b.w - MIN_BOX);
                w = b.w - (newX - b.x);
                x = newX;
            }
            if (this.mode.includes('e')) {
                w = this.clamp(b.w + dx, MIN_BOX, this.dispWidth - b.x);
            }

            this.box = { x, y, w, h };
        },

        stopPointer() {
            this.mode = null;
        },

        clamp(v, min, max) {
            return Math.min(max, Math.max(min, v));
        },

        async applyCrop() {
            this.exporting = true;

            const scale = this.imgNaturalWidth / this.dispWidth;
            const sx = this.box.x * scale;
            const sy = this.box.y * scale;
            const sw = this.box.w * scale;
            const sh = this.box.h * scale;

            let outW = sw;
            let outH = sh;
            if (Math.max(outW, outH) > MAX_OUTPUT) {
                const downscale = MAX_OUTPUT / Math.max(outW, outH);
                outW *= downscale;
                outH *= downscale;
            }

            const canvas = document.createElement('canvas');
            canvas.width = Math.round(outW);
            canvas.height = Math.round(outH);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                this.exporting = false;
                this.$emit('cropped', blob);
            }, 'image/png', 0.92);
        },
    },
};
