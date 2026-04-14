import { Player } from '@remotion/player';
import { memo, type ComponentType } from 'react';
import {
  EmptyStateScene,
  HeroBackgroundScene,
  LoginAmbientScene,
  SidebarBrandScene,
  SoftGridScene,
} from './scenes';
import { useMotionPreferences } from './useMotionPreferences';

interface MotionLayerProps {
  className?: string;
  opacity?: number;
  autoPlay?: boolean;
  loop?: boolean;
  enabled?: boolean;
}

interface LayerRendererProps extends MotionLayerProps {
  component: ComponentType<Record<string, never>>;
  durationInFrames: number;
  compositionWidth: number;
  compositionHeight: number;
}

function LayerRenderer({
  component,
  durationInFrames,
  compositionWidth,
  compositionHeight,
  className,
  opacity = 1,
  autoPlay = true,
  loop = true,
  enabled = true,
}: LayerRendererProps) {
  const { allowMotion } = useMotionPreferences(enabled);

  return (
    <div aria-hidden="true" className={className} style={{ opacity, pointerEvents: 'none' }}>
      {allowMotion ? (
        <Player
          component={component}
          durationInFrames={durationInFrames}
          compositionWidth={compositionWidth}
          compositionHeight={compositionHeight}
          fps={30}
          autoPlay={autoPlay}
          loop={loop}
          controls={false}
          clickToPlay={false}
          inputProps={{}}
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        />
      ) : (
        <div className="h-full w-full" />
      )}
    </div>
  );
}

export const LoginAmbientMotion = memo(function LoginAmbientMotion(props: MotionLayerProps) {
  return (
    <LayerRenderer
      component={LoginAmbientScene}
      durationInFrames={420}
      compositionWidth={1200}
      compositionHeight={880}
      {...props}
    />
  );
});

export const HeroBackgroundMotion = memo(function HeroBackgroundMotion(props: MotionLayerProps) {
  return (
    <LayerRenderer
      component={HeroBackgroundScene}
      durationInFrames={420}
      compositionWidth={1600}
      compositionHeight={760}
      {...props}
    />
  );
});

export const SoftGridMotion = memo(function SoftGridMotion(props: MotionLayerProps) {
  return (
    <LayerRenderer
      component={SoftGridScene}
      durationInFrames={360}
      compositionWidth={1600}
      compositionHeight={900}
      {...props}
    />
  );
});

export const EmptyStateMotion = memo(function EmptyStateMotion(props: MotionLayerProps) {
  return (
    <LayerRenderer
      component={EmptyStateScene}
      durationInFrames={360}
      compositionWidth={320}
      compositionHeight={220}
      {...props}
    />
  );
});

export const SidebarBrandMotion = memo(function SidebarBrandMotion(props: MotionLayerProps) {
  return (
    <LayerRenderer
      component={SidebarBrandScene}
      durationInFrames={240}
      compositionWidth={96}
      compositionHeight={96}
      {...props}
    />
  );
});
