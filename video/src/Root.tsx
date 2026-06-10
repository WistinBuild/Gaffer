import { Composition } from "remotion";
import { GafferIntro, INTRO_DURATION, FPS } from "./GafferIntro";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="GafferIntro"
      component={GafferIntro}
      durationInFrames={INTRO_DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
