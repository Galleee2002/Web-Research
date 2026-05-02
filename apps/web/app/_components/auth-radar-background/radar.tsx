"use client";

import { Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef } from "react";

import "./radar.css";

function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16) / 255,
    Number.parseInt(h.slice(2, 4), 16) / 255,
    Number.parseInt(h.slice(4, 6), 16) / 255,
  ];
}

const vertexShader = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uScale;
uniform float uRingCount;
uniform float uSpokeCount;
uniform float uRingThickness;
uniform float uSpokeThickness;
uniform float uSweepSpeed;
uniform float uSweepWidth;
uniform float uSweepLobes;
uniform vec3 uColor;
uniform vec3 uBgColor;
uniform float uFalloff;
uniform float uBrightness;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform bool uEnableMouse;
uniform vec2 uPatternOrigin;
uniform float uIsLightBg;

#define TAU 6.28318530718
#define PI 3.14159265359

void main() {
  vec2 st = gl_FragCoord.xy / uResolution.xy;
  st = st * 2.0 - 1.0;
  st.x *= uResolution.x / uResolution.y;

  st -= uPatternOrigin;

  if (uEnableMouse) {
    vec2 mShift = (uMouse * 2.0 - 1.0);
    mShift.x *= uResolution.x / uResolution.y;
    st -= mShift * uMouseInfluence;
  }

  st *= uScale;

  float dist = length(st);
  float theta = atan(st.y, st.x);
  float t = uTime * uSpeed;

  float ringPhase = dist * uRingCount - t;
  float ringDist = abs(fract(ringPhase) - 0.5);
  float ringGlow = 1.0 - smoothstep(0.0, uRingThickness, ringDist);

  float spokeAngle = abs(fract(theta * uSpokeCount / TAU + 0.5) - 0.5) * TAU / uSpokeCount;
  float arcDist = spokeAngle * dist;
  float spokeGlow = (1.0 - smoothstep(0.0, uSpokeThickness, arcDist)) * smoothstep(0.0, 0.1, dist);

  float sweepPhase = t * uSweepSpeed;
  float sweepBeam = pow(max(0.5 * sin(uSweepLobes * theta + sweepPhase) + 0.5, 0.0), uSweepWidth);

  float fade = smoothstep(1.05, 0.85, dist) * pow(max(1.0 - dist, 0.0), uFalloff);

  float raw = max((ringGlow + spokeGlow + sweepBeam) * fade * uBrightness, 0.0);

  vec3 col;
  if (uIsLightBg > 0.5) {
    float t = 1.0 - exp(-raw * 0.38);
    t = min(t * 0.82, 1.0);
    col = mix(uBgColor, uColor, t);
  } else {
    col = uColor * raw + uBgColor;
  }

  col = clamp(col, 0.0, 1.0);
  float alpha = clamp(length(col), 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

export type AuthRadarProps = {
  speed?: number;
  scale?: number;
  ringCount?: number;
  spokeCount?: number;
  ringThickness?: number;
  spokeThickness?: number;
  sweepSpeed?: number;
  sweepWidth?: number;
  sweepLobes?: number;
  color?: string;
  backgroundColor?: string;
  falloff?: number;
  brightness?: number;
  enableMouseInteraction?: boolean;
  mouseInfluence?: number;
  /** Horizontal origin 0–1 (0 left, 0.5 center, 1 right). Default ~0.76 = center of radar on the right. */
  patternOriginX?: number;
  /** Vertical origin 0–1 in GL space (0 bottom, 0.5 center, 1 top). */
  patternOriginY?: number;
  /** Use compositing that keeps line hue on a light background (avoids white clipping). */
  isLightBackground?: boolean;
};

export function AuthRadar({
  speed = 0.3,
  scale = 0.5,
  ringCount = 6,
  spokeCount = 10,
  ringThickness = 0.07,
  spokeThickness = 0.01,
  sweepSpeed = 1.0,
  sweepWidth = 7,
  sweepLobes = 1,
  color = "#0071E3",
  backgroundColor = "#000000",
  falloff = 1.2,
  brightness = 1.0,
  enableMouseInteraction = true,
  mouseInfluence = 0.2,
  patternOriginX = 0.76,
  patternOriginY = 0.5,
  isLightBackground = false,
}: AuthRadarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const root = container;

    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
    const { gl } = renderer;
    gl.clearColor(0, 0, 0, 0);

    let program: Program | undefined;
    const currentMouse: [number, number] = [0.5, 0.5];
    let targetMouse: [number, number] = [0.5, 0.5];

    function handleMouseMove(e: MouseEvent) {
      const rect = gl.canvas.getBoundingClientRect();
      targetMouse = [
        (e.clientX - rect.left) / rect.width,
        1.0 - (e.clientY - rect.top) / rect.height,
      ];
    }

    function handleMouseLeave() {
      targetMouse = [0.5, 0.5];
    }

    function updatePatternOrigin() {
      if (!program) {
        return;
      }
      const w = gl.canvas.width;
      const h = gl.canvas.height;
      const aspect = w / Math.max(h, 1);
      const ox = Math.min(1, Math.max(0, patternOriginX));
      const oy = Math.min(1, Math.max(0, patternOriginY));
      const originX = (2 * ox - 1) * aspect;
      const originY = 2 * oy - 1;
      const u = program.uniforms.uPatternOrigin.value as Float32Array;
      u[0] = originX;
      u[1] = originY;
    }

    function resize() {
      renderer.setSize(root.offsetWidth, root.offsetHeight);
      if (program) {
        program.uniforms.uResolution.value = [
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height,
        ];
        updatePatternOrigin();
      }
    }

    window.addEventListener("resize", resize);
    resize();

    const geometry = new Triangle(gl);
    program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: {
          value: [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height],
        },
        uSpeed: { value: speed },
        uScale: { value: scale },
        uRingCount: { value: ringCount },
        uSpokeCount: { value: spokeCount },
        uRingThickness: { value: ringThickness },
        uSpokeThickness: { value: spokeThickness },
        uSweepSpeed: { value: sweepSpeed },
        uSweepWidth: { value: sweepWidth },
        uSweepLobes: { value: sweepLobes },
        uColor: { value: hexToVec3(color) },
        uBgColor: { value: hexToVec3(backgroundColor) },
        uFalloff: { value: falloff },
        uBrightness: { value: brightness },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseInfluence: { value: mouseInfluence },
        uEnableMouse: { value: enableMouseInteraction },
        uPatternOrigin: { value: new Float32Array([0, 0]) },
        uIsLightBg: { value: isLightBackground ? 1.0 : 0.0 },
      },
    });

    updatePatternOrigin();

    const mesh = new Mesh(gl, { geometry, program });
    root.appendChild(gl.canvas);

    if (enableMouseInteraction) {
      gl.canvas.addEventListener("mousemove", handleMouseMove);
      gl.canvas.addEventListener("mouseleave", handleMouseLeave);
    }

    let animationFrameId = 0;

    function update(time: number) {
      animationFrameId = requestAnimationFrame(update);
      if (!program) {
        return;
      }
      program.uniforms.uTime.value = time * 0.001;

      if (enableMouseInteraction) {
        currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
        currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
        const mouseUniform = program.uniforms.uMouse.value as Float32Array;
        mouseUniform[0] = currentMouse[0];
        mouseUniform[1] = currentMouse[1];
      } else {
        const mouseUniform = program.uniforms.uMouse.value as Float32Array;
        mouseUniform[0] = 0.5;
        mouseUniform[1] = 0.5;
      }

      renderer.render({ scene: mesh });
    }

    animationFrameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      if (enableMouseInteraction) {
        gl.canvas.removeEventListener("mousemove", handleMouseMove);
        gl.canvas.removeEventListener("mouseleave", handleMouseLeave);
      }
      if (gl.canvas.parentNode === root) {
        root.removeChild(gl.canvas);
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [
    speed,
    scale,
    ringCount,
    spokeCount,
    ringThickness,
    spokeThickness,
    sweepSpeed,
    sweepWidth,
    sweepLobes,
    color,
    backgroundColor,
    falloff,
    brightness,
    enableMouseInteraction,
    mouseInfluence,
    patternOriginX,
    patternOriginY,
    isLightBackground,
  ]);

  return <div ref={containerRef} className="radar-container" />;
}
