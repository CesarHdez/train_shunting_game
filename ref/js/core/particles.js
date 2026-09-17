// js/core/particles.js — Sistema de confetti compartido entre modos

export class ParticleSystem {
    constructor() { this.p = []; }

    spawnConfetti(cx, cy, count = 160) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.random()-0.5)*Math.PI*2, speed = Math.random()*14+3;
            this.p.push({
                x: cx+(Math.random()-0.5)*300, y: cy+(Math.random()-0.5)*100,
                vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed-7,
                w: Math.random()*9+4, h: Math.random()*5+3,
                color: `hsl(${Math.floor(Math.random()*360)},90%,65%)`,
                rot: Math.random()*Math.PI*2, rotV: (Math.random()-0.5)*0.25,
                life: 1, decay: Math.random()*0.008+0.004
            });
        }
    }

    update() {
        for (let i = this.p.length-1; i >= 0; i--) {
            const p = this.p[i];
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.32; p.vx *= 0.99; p.rot += p.rotV; p.life -= p.decay;
            if (p.life <= 0) this.p.splice(i, 1);
        }
    }

    draw(ctx) {
        for (const p of this.p) {
            ctx.save(); ctx.globalAlpha = Math.min(p.life*2, 1);
            ctx.fillStyle = p.color; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); ctx.restore();
        }
        ctx.globalAlpha = 1;
    }
}

export const particles = new ParticleSystem();
