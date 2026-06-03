import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Inject,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface Dot {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  glow: number;
}

@Component({
  selector: 'app-polkadots-background',
  standalone: true,
  templateUrl: './polkadots-background.html',
  styleUrls: ['./polkadots-background.scss'],
})
export class PolkaDotsBackground implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private animationId = 0;
  private dots: Dot[] = [];

  private width = 0;
  private height = 0;
  private dpr = 1;

  private readonly spacing = 28;
  private readonly baseRadius = 1.8;
  private readonly activeAlpha = 0.01;
  private readonly baseAlpha = 0.1;

  private readonly repelRadius = 200;
  private readonly maxRepelForce = 8;
  private readonly springBack = 0.3;
  private readonly friction = 0.2;

  private mouse = {
    x: -9999,
    y: -9999,
    prevX: -9999,
    prevY: -9999,
    speed: 0,
    active: false,
  };

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.canvas = this.canvasRef.nativeElement;
    const context = this.canvas.getContext('2d');

    if (!context) {
      return;
    }

    this.ctx = context;
    this.setupCanvas();
    this.buildGrid();

    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      cancelAnimationFrame(this.animationId);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!isPlatformBrowser(this.platformId) || !this.ctx) {
      return;
    }

    this.setupCanvas();
    this.buildGrid();
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!isPlatformBrowser(this.platformId) || !this.canvas) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const nextX = event.clientX - rect.left;
    const nextY = event.clientY - rect.top;

    const dx = nextX - this.mouse.x;
    const dy = nextY - this.mouse.y;

    this.mouse.prevX = this.mouse.x;
    this.mouse.prevY = this.mouse.y;
    this.mouse.x = nextX;
    this.mouse.y = nextY;
    this.mouse.speed = Math.sqrt(dx * dx + dy * dy);
    this.mouse.active = true;
  }

  @HostListener('window:mouseleave')
  onMouseLeave(): void {
    this.mouse.x = -9999;
    this.mouse.y = -9999;
    this.mouse.prevX = -9999;
    this.mouse.prevY = -9999;
    this.mouse.speed = 0;
    this.mouse.active = false;
  }

  private setupCanvas(): void {
    const parent = this.canvas.parentElement;
    this.width = parent?.clientWidth || window.innerWidth;
    this.height = parent?.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  private buildGrid(): void {
    this.dots = [];

    const offsetX = this.spacing / 2;
    const offsetY = this.spacing / 2;

    for (let y = offsetY; y < this.height; y += this.spacing) {
      for (let x = offsetX; x < this.width; x += this.spacing) {
        this.dots.push({
          x,
          y,
          originX: x,
          originY: y,
          vx: 0,
          vy: 0,
          radius: this.baseRadius,
          alpha: this.baseAlpha,
          glow: 0,
        });
      }
    }
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    this.clearCanvas();
    this.updateDots();
    this.drawBlobLinks();
    this.drawDots();

    this.mouse.speed *= 0.9;
  };

  private clearCanvas(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  private updateDots(): void {
    for (const dot of this.dots) {
      const dx = dot.x - this.mouse.x;
      const dy = dot.y - this.mouse.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.0001;

      if (this.mouse.active && distance < this.repelRadius) {
        const strength = 1 - distance / this.repelRadius;

        const angleX = dx / distance;
        const angleY = dy / distance;

        const motionBoost = Math.min(this.mouse.speed * 0.08, 2.5);
        const repelForce = strength * (this.maxRepelForce + motionBoost);

        dot.vx += angleX * repelForce;
        dot.vy += angleY * repelForce;

        dot.glow = Math.max(dot.glow, strength);
      }

      const returnX = (dot.originX - dot.x) * this.springBack;
      const returnY = (dot.originY - dot.y) * this.springBack;

      dot.vx += returnX;
      dot.vy += returnY;

      dot.vx *= this.friction;
      dot.vy *= this.friction;

      dot.x += dot.vx;
      dot.y += dot.vy;

      dot.glow += (0 - dot.glow) * 0.08;
      dot.radius += ((this.baseRadius + dot.glow * 4.5) - dot.radius) * 0.18;
      dot.alpha += ((this.baseAlpha + dot.glow * (this.activeAlpha - this.baseAlpha)) - dot.alpha) * 0.18;
    }
  }

  private drawDots(): void {
    for (const dot of this.dots) {
      const glowAlpha = Math.min(dot.alpha, 0.95);
      const glowBlur = 4 + dot.glow * 10;

      this.ctx.beginPath();
      this.ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 0, 0, ${glowAlpha})`;
      this.ctx.shadowBlur = glowBlur;
      this.ctx.shadowColor = `rgba(255, 0, 0, ${Math.min(0.35 + dot.glow * 0.8, 1)})`;
      this.ctx.fill();
    }

    this.ctx.shadowBlur = 0;
  }

  private drawBlobLinks(): void {
    const linkDistance = this.spacing * 1.35;

    for (let i = 0; i < this.dots.length; i++) {
      const a = this.dots[i];

      if (a.glow < 0.06) {
        continue;
      }

      for (let j = i + 1; j < this.dots.length; j++) {
        const b = this.dots[j];

        if (b.glow < 0.06) {
          continue;
        }

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= linkDistance) {
          const strength = 1 - distance / linkDistance;
          const combinedGlow = (a.glow + b.glow) * 0.5;
          const opacity = strength * combinedGlow * 0.22;

          this.ctx.beginPath();
          this.ctx.moveTo(a.x, a.y);
          this.ctx.lineTo(b.x, b.y);
          this.ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
          this.ctx.lineWidth = 1.2 + combinedGlow * 1.2;
          this.ctx.stroke();
        }
      }
    }
  }
}