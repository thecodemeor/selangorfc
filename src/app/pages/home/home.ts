import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from '@angular/core';

import { PolkaDotsBackground } from '../../../shared/templates/polkadots-background/polkadots-background';
import { LogoParticles } from '../../../shared/logo-particles/logo-particles';

interface InfiniteSliderItem {
  name: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [PolkaDotsBackground, LogoParticles],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements AfterViewInit, OnDestroy {
  @ViewChild('partnersTrack', { static: true })
  partnersTrack!: ElementRef<HTMLDivElement>;

  partners: InfiniteSliderItem[] = [
    { name: 'pkns' },
    { name: 'mbi' },
    { name: 'daikin' },
    { name: 'joma' },
    { name: 'citadel' },
    { name: 'infrasel' },
    { name: 'yayasan-albukhary' },
    { name: 'agym' },
    { name: 'kdeb' },
    { name: 'khind' },
    { name: 'johawaki' },
    { name: 'varia' },
    { name: 'ock' },
    { name: 'pns' },
    { name: 'pkns' },
    { name: 'tuju-setia' },
    { name: 'kjs' },
    { name: 'kusel' },
    { name: 'tobaki' },
    { name: 'uis' },
    { name: 'khsb' },
    { name: 'air-selangor' },
    { name: 'global-turbine' },
    { name: 'alkauthar' },
    { name: 'pkps' },
    { name: 'aiman-platinum' },
    { name: 'smg' },
    { name: 'familymart' },
    { name: 'omnia' },
    { name: 'rms-synergy' },
    { name: 'worldwide' },
    { name: 'simedarby' },
    { name: 'emrail' },
    { name: 'provident' },
    { name: 'hyundai' },
    { name: 'grantt' },
    { name: 'sani' },
    { name: 'gatorade' },
    { name: 'bmg' },
    { name: 'arena-legacy' },
    { name: 'rosyammart' },
    { name: 'first-pride' },
    { name: 'aden-tailoring' },
    { name: 'central-spectrum' },
    { name: 'tudungruffle' },
    { name: 'wao' },
    { name: 'dododots' },
    { name: 'tte' },
    { name: 'hanhai' },
    { name: 'atf' }
  ];

  get duplicatedPartners(): InfiniteSliderItem[] {
    return [...this.partners, ...this.partners];
  }

  private animationId = 0;
  private offset = 0;
  private currentSpeed = 0.7;   // px per frame-ish feel
  private targetSpeed = 0.7;
  private lastTime = 0;
  private halfWidth = 0;

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.measureTrack();
      this.startAnimation();
      window.addEventListener('resize', this.measureTrack);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.measureTrack);
  }

  onSliderEnter(): void {
    this.targetSpeed = 0.18;
  }

  onSliderLeave(): void {
    this.targetSpeed = 0.9;
  }

  private measureTrack = (): void => {
    const track = this.partnersTrack?.nativeElement;
    if (!track) return;

    this.halfWidth = track.scrollWidth / 2;
  };

  private startAnimation(): void {
    const step = (time: number) => {
      if (!this.lastTime) {
        this.lastTime = time;
      }

      const delta = time - this.lastTime;
      this.lastTime = time;

      this.currentSpeed += (this.targetSpeed - this.currentSpeed) * 0.06;

      this.offset -= this.currentSpeed * (delta / 16.67);

      if (Math.abs(this.offset) >= this.halfWidth) {
        this.offset += this.halfWidth;
      }

      this.partnersTrack.nativeElement.style.transform = `translate3d(${this.offset}px, 0, 0)`;

      this.animationId = requestAnimationFrame(step);
    };

    this.animationId = requestAnimationFrame(step);
  }
}