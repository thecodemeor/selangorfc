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

import * as THREE from 'three';

@Component({
  selector: 'app-logo-particles',
  standalone: true,
  templateUrl: './logo-particles.html',
  styleUrl: './logo-particles.scss',
})
export class LogoParticles implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  private animationId = 0;
  private width = 0;
  private height = 0;

  private points!: THREE.Points;
  private geometry!: THREE.BufferGeometry;
  private material!: THREE.PointsMaterial;

  private basePositions!: Float32Array;
  private livePositions!: Float32Array;
  private phases!: Float32Array;

  private group = new THREE.Group();

  private mouse = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  };

  private readonly imagePath = 'assets/images/logo/selangorfc-logo.png';

  private readonly sampleGap = 20;
  private readonly alphaThreshold = 20;
  private readonly particleSize = 0.055;
  private readonly floatAmount = 0.1;
  private readonly depthSpread = 0.06;
  private readonly parallaxStrength = 0.4;

  // 0 = grayscale, 1 = original, >1 = more saturated
  private readonly saturationLevel = 10;

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.initThree();
    await this.buildLogoParticles();

    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    cancelAnimationFrame(this.animationId);

    if (this.geometry) {
      this.geometry.dispose();
    }

    if (this.material) {
      this.material.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!isPlatformBrowser(this.platformId) || !this.renderer || !this.camera) {
      return;
    }

    this.updateSize();
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;

    this.mouse.targetX = nx;
    this.mouse.targetY = ny;
  }

  @HostListener('window:mouseleave')
  onMouseLeave(): void {
    this.mouse.targetX = 0;
    this.mouse.targetY = 0;
  }

  private initThree(): void {
    this.updateSize();

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(40, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0, 7.5);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvasRef.nativeElement,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.add(this.group);

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambient);
  }

  private updateSize(): void {
    const parent = this.canvasRef.nativeElement.parentElement;
    this.width = parent?.clientWidth || window.innerWidth;
    this.height = parent?.clientHeight || window.innerHeight;
  }

  private async buildLogoParticles(): Promise<void> {
    const image = await this.loadImage(this.imagePath);

    const { positions, colors, phases } = this.sampleImageToParticles(image);

    this.basePositions = positions.slice();
    this.livePositions = positions.slice();
    this.phases = phases;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.livePositions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.geometry.computeBoundingBox();
    this.geometry.center();

    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;

    const box = new THREE.Box3().setFromBufferAttribute(posAttr);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y);
    const scale = 2.8 / maxDim;

    this.geometry.scale(scale, scale, scale);

    this.basePositions = (
      (this.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    ).slice();

    this.livePositions = this.basePositions.slice();

    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.livePositions, 3)
    );

    this.material = new THREE.PointsMaterial({
      size: this.particleSize,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.rotation.x = -0.08;

    this.group.clear();
    this.group.add(this.points);
  }

  private sampleImageToParticles(image: HTMLImageElement): {
    positions: Float32Array;
    colors: Float32Array;
    phases: Float32Array;
  } {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Unable to create 2D canvas for logo sampling.');
    }

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    ctx.drawImage(image, 0, 0);

    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const points: number[] = [];
    const colors: number[] = [];
    const phases: number[] = [];

    for (let y = 0; y < height; y += this.sampleGap) {
      for (let x = 0; x < width; x += this.sampleGap) {
        const i = (y * width + x) * 4;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < this.alphaThreshold) {
          continue;
        }

        const px = x - width / 2;
        const py = -(y - height / 2);

        const brightness = (r + g + b) / 765;
        const pz = (brightness - 0.5) * this.depthSpread + (Math.random() - 0.5) * 0.03;

        const adjusted = this.adjustSaturation(
          r / 255,
          g / 255,
          b / 255,
          this.saturationLevel
        );

        points.push(px, py, pz);
        colors.push(adjusted.r, adjusted.g, adjusted.b);
        phases.push(Math.random() * Math.PI * 2);
      }
    }

    return {
      positions: new Float32Array(points),
      colors: new Float32Array(colors),
      phases: new Float32Array(phases),
    };
  }

  private adjustSaturation(
    r: number,
    g: number,
    b: number,
    saturation: number
  ): { r: number; g: number; b: number } {
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    return {
      r: THREE.MathUtils.clamp(gray + (r - gray) * saturation, 0, 1),
      g: THREE.MathUtils.clamp(gray + (g - gray) * saturation, 0, 1),
      b: THREE.MathUtils.clamp(gray + (b - gray) * saturation, 0, 1),
    };
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      image.src = src;
    });
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const elapsed = this.clock.getElapsedTime();

    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

    if (this.points) {
      this.points.rotation.y = this.mouse.x * 0.22;
      this.points.rotation.x = -0.08 - this.mouse.y * 0.12;

      const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;

      for (let i = 0; i < this.livePositions.length; i += 3) {
        const p = i / 3;

        this.livePositions[i] = this.basePositions[i];
        this.livePositions[i + 1] = this.basePositions[i + 1];
        this.livePositions[i + 2] =
          this.basePositions[i + 2] +
          Math.sin(elapsed * 1.6 + this.phases[p]) * this.floatAmount;
      }

      posAttr.needsUpdate = true;
    }

    this.group.position.x = this.mouse.x * this.parallaxStrength;
    this.group.position.y = -this.mouse.y * this.parallaxStrength * 0.6;

    this.renderer.render(this.scene, this.camera);
  };
}