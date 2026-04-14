import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

const ACCENT = '#245f66';
const ACCENT_SOFT = '#86a7ab';

export function LoginAmbientScene() {
  const frame = useCurrentFrame();

  const driftX = Math.sin(frame / 56) * 18;
  const driftY = Math.cos(frame / 74) * 14;
  const breath = 0.95 + Math.sin(frame / 64) * 0.06;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '-12%',
          width: '62%',
          height: '72%',
          borderRadius: '999px',
          filter: 'blur(24px)',
          background:
            'radial-gradient(circle at center, rgba(134,167,171,0.28) 0%, rgba(134,167,171,0.08) 56%, transparent 100%)',
          transform: `translate3d(${driftX}px, ${driftY}px, 0) scale(${breath})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '-18%',
          bottom: '-24%',
          width: '72%',
          height: '80%',
          borderRadius: '999px',
          filter: 'blur(30px)',
          background:
            'radial-gradient(circle at center, rgba(36,95,102,0.2) 0%, rgba(36,95,102,0.06) 58%, transparent 100%)',
          transform: `translate3d(${-driftX * 0.8}px, ${-driftY * 0.7}px, 0) scale(${1.02 - Math.sin(frame / 52) * 0.04})`,
        }}
      />
    </AbsoluteFill>
  );
}

export function HeroBackgroundScene() {
  const frame = useCurrentFrame();
  const waveX = Math.sin(frame / 68) * 24;
  const waveY = Math.cos(frame / 96) * 18;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: '6%',
          width: '52%',
          height: '92%',
          borderRadius: '999px',
          filter: 'blur(36px)',
          background:
            'radial-gradient(circle at 40% 40%, rgba(36,95,102,0.2) 0%, rgba(36,95,102,0.07) 50%, transparent 100%)',
          transform: `translate3d(${waveX}px, ${waveY}px, 0)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '-16%',
          right: '2%',
          width: '48%',
          height: '86%',
          borderRadius: '999px',
          filter: 'blur(30px)',
          background:
            'radial-gradient(circle at 60% 48%, rgba(134,167,171,0.18) 0%, rgba(134,167,171,0.08) 45%, transparent 100%)',
          transform: `translate3d(${-waveX * 0.7}px, ${-waveY * 0.8}px, 0)`,
        }}
      />
    </AbsoluteFill>
  );
}

export function SoftGridScene() {
  const frame = useCurrentFrame();
  const offsetX = (frame * 0.12) % 46;
  const offsetY = (frame * 0.07) % 46;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          position: 'absolute',
          inset: -46,
          transform: `translate3d(${-offsetX}px, ${-offsetY}px, 0)`,
          backgroundSize: '46px 46px',
          backgroundImage:
            'linear-gradient(to right, rgba(36,95,102,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(36,95,102,0.08) 1px, transparent 1px)',
        }}
      />
    </AbsoluteFill>
  );
}

export function EmptyStateScene() {
  const frame = useCurrentFrame();

  const theta = (frame / 72) * Math.PI;
  const dot1X = 120 + Math.cos(theta) * 46;
  const dot1Y = 96 + Math.sin(theta) * 22;
  const dot2X = 200 + Math.cos(theta + Math.PI * 0.9) * 38;
  const dot2Y = 132 + Math.sin(theta + Math.PI * 0.9) * 18;
  const pulse = interpolate(Math.sin(frame / 24), [-1, 1], [0.55, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <svg viewBox="0 0 320 220" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id="empty-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(134,167,171,0.2)" />
            <stop offset="50%" stopColor="rgba(36,95,102,0.32)" />
            <stop offset="100%" stopColor="rgba(134,167,171,0.18)" />
          </linearGradient>
        </defs>

        <rect
          x="34"
          y="32"
          width="252"
          height="156"
          rx="16"
          fill="rgba(255,255,255,0.6)"
          stroke="rgba(36,95,102,0.12)"
          strokeWidth="1.2"
        />

        <path d="M78 88 H242" stroke="url(#empty-line)" strokeWidth="2" strokeLinecap="round" />
        <path d="M78 112 H218" stroke="url(#empty-line)" strokeWidth="2" strokeLinecap="round" />
        <path d="M78 136 H194" stroke="url(#empty-line)" strokeWidth="2" strokeLinecap="round" />

        <circle cx={dot1X} cy={dot1Y} r={5} fill={ACCENT} opacity={pulse} />
        <circle cx={dot2X} cy={dot2Y} r={4.2} fill={ACCENT_SOFT} opacity={0.88} />
      </svg>
    </AbsoluteFill>
  );
}

export function SidebarBrandScene() {
  const frame = useCurrentFrame();
  const rippleScale = 1 + interpolate(Math.sin(frame / 18), [-1, 1], [0.02, 0.2]);
  const rippleOpacity = interpolate(Math.sin(frame / 18), [-1, 1], [0.16, 0.04]);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 999,
          border: `1px solid rgba(36,95,102,${rippleOpacity})`,
          transform: `scale(${rippleScale})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 34,
          height: 34,
          borderRadius: 999,
          border: '1px solid rgba(134,167,171,0.2)',
        }}
      />
    </AbsoluteFill>
  );
}
