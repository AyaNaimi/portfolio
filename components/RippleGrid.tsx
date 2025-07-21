import { useRef, useEffect } from "react";
import type { MutableRefObject } from "react";
// @ts-ignore
import { Renderer, Program, Triangle, Mesh } from "ogl";

interface RippleGridProps {
  enableRainbow?: boolean;
  gridColor?: string;
  rippleIntensity?: number;
  gridSize?: number;
  gridThickness?: number;
  fadeDistance?: number;
  vignetteStrength?: number;
  glowIntensity?: number;
  opacity?: number;
  gridRotation?: number;
  mouseInteraction?: boolean;
  mouseInteractionRadius?: number;
  responsive?: boolean;
}

const RippleGrid = ({
  enableRainbow = false,
  gridColor = "#5227FF",
  rippleIntensity = 0.05,
  gridSize = 10.0,
  gridThickness = 15.0,
  fadeDistance = 1.5,
  vignetteStrength = 2.0,
  glowIntensity = 0.1,
  opacity = 1.0,
  gridRotation = 0,
  mouseInteraction = true,
  mouseInteractionRadius = 1,
  responsive = false,
}) => {
  const containerRef = useRef(null);
  const mousePositionRef = useRef({ x: 0.5, y: 0.5 });
  const targetMouseRef = useRef({ x: 0.5, y: 0.5 });
  const mouseInfluenceRef = useRef(0);
  const uniformsRef = useRef(null);

  // Responsive adjustments
  const getResponsiveValue = (desktopValue: number, mobileValue: number) => {
    if (!responsive) return desktopValue;
    return typeof window !== 'undefined' && window.innerWidth < 768 ? mobileValue : desktopValue;
  };

  const responsiveGridSize = getResponsiveValue(gridSize, gridSize * 0.7);
  const responsiveGridThickness = getResponsiveValue(gridThickness, gridThickness * 0.8);
  const responsiveRippleIntensity = getResponsiveValue(rippleIntensity, rippleIntensity * 0.6);
  const responsiveMouseRadius = getResponsiveValue(mouseInteractionRadius, mouseInteractionRadius * 0.8);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up any existing canvas
    const existingCanvas = (containerRef.current as HTMLElement).querySelector('canvas');
    if (existingCanvas) {
      (containerRef.current as HTMLElement).removeChild(existingCanvas);
    }

    const hexToRgb = (hex: string): [number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? [
          parseInt(result[1], 16) / 255,
          parseInt(result[2], 16) / 255,
          parseInt(result[3], 16) / 255,
        ]
        : [1, 1, 1];
    };

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio, 2),
      alpha: true,
    });
    const gl = renderer.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    gl.canvas.style.display = "block";
    gl.canvas.style.position = "absolute";
    gl.canvas.style.top = "0";
    gl.canvas.style.left = "0";
    gl.canvas.style.objectFit = "cover";
    (containerRef.current as HTMLElement).appendChild(gl.canvas);

    const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}`;

    const frag = `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform bool enableRainbow;
uniform vec3 gridColor;
uniform float rippleIntensity;
uniform float gridSize;
uniform float gridThickness;
uniform float fadeDistance;
uniform float vignetteStrength;
uniform float glowIntensity;
uniform float opacity;
uniform float gridRotation;
uniform bool mouseInteraction;
uniform vec2 mousePosition;
uniform float mouseInfluence;
uniform float mouseInteractionRadius;
varying vec2 vUv;

float pi = 3.141592;

mat2 rotate(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    if (gridRotation != 0.0) {
        uv = rotate(gridRotation * pi / 180.0) * uv;
    }

    float dist = length(uv);
    float func = sin(pi * (iTime - dist));
    vec2 rippleUv = uv + uv * func * rippleIntensity;

    if (mouseInteraction && mouseInfluence > 0.0) {
        vec2 mouseUv = (mousePosition * 2.0 - 1.0);
        mouseUv.x *= iResolution.x / iResolution.y;
        float mouseDist = length(uv - mouseUv);
        
        float influence = mouseInfluence * exp(-mouseDist * mouseDist / (mouseInteractionRadius * mouseInteractionRadius));
        
        float mouseWave = sin(pi * (iTime * 2.0 - mouseDist * 3.0)) * influence;
        rippleUv += normalize(uv - mouseUv) * mouseWave * rippleIntensity * 0.3;
    }

    vec2 a = sin(gridSize * 0.5 * pi * rippleUv - pi / 2.0);
    vec2 b = abs(a);

    float aaWidth = 0.5;
    vec2 smoothB = vec2(
        smoothstep(0.0, aaWidth, b.x),
        smoothstep(0.0, aaWidth, b.y)
    );

    vec3 color = vec3(0.0);
    color += exp(-gridThickness * smoothB.x * (0.8 + 0.5 * sin(pi * iTime)));
    color += exp(-gridThickness * smoothB.y);
    color += 0.5 * exp(-(gridThickness / 4.0) * sin(smoothB.x));
    color += 0.5 * exp(-(gridThickness / 3.0) * smoothB.y);

    if (glowIntensity > 0.0) {
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.x);
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.y);
    }

    float ddd = exp(-2.0 * clamp(pow(dist, fadeDistance), 0.0, 1.0));
    
    vec2 vignetteCoords = vUv - 0.5;
    float vignetteDistance = length(vignetteCoords);
    float vignette = 1.0 - pow(vignetteDistance * 2.0, vignetteStrength);
    vignette = clamp(vignette, 0.0, 1.0);
    
    vec3 t;
    if (enableRainbow) {
        t = vec3(
            uv.x * 0.5 + 0.5 * sin(iTime),
            uv.y * 0.5 + 0.5 * cos(iTime),
            pow(cos(iTime), 4.0)
        ) + 0.5;
    } else {
        t = gridColor;
    }

    float finalFade = ddd * vignette;
    float alpha = length(color) * finalFade * opacity;
    gl_FragColor = vec4(color * t * finalFade * opacity, alpha);
}`;

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      enableRainbow: { value: enableRainbow },
      gridColor: { value: hexToRgb(gridColor) },
      rippleIntensity: { value: responsiveRippleIntensity },
      gridSize: { value: responsiveGridSize },
      gridThickness: { value: responsiveGridThickness },
      fadeDistance: { value: fadeDistance },
      vignetteStrength: { value: vignetteStrength },
      glowIntensity: { value: glowIntensity },
      opacity: { value: opacity },
      gridRotation: { value: gridRotation },
      mouseInteraction: { value: mouseInteraction },
      mousePosition: { value: [0.5, 0.5] },
      mouseInfluence: { value: 0 },
      mouseInteractionRadius: { value: responsiveMouseRadius },
    };

    // Assign uniforms to ref as type 'any' to avoid type error
    uniformsRef.current = uniforms as any;

    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex: vert, fragment: frag, uniforms });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      if (!containerRef.current) return;
      const { clientWidth: w, clientHeight: h } = containerRef.current as HTMLElement;
      renderer.setSize(w, h);
      uniforms.iResolution.value = [w, h];
      
      // Update responsive values on resize
      if (responsive) {
        const newGridSize = getResponsiveValue(gridSize, gridSize * 0.7);
        const newGridThickness = getResponsiveValue(gridThickness, gridThickness * 0.8);
        const newRippleIntensity = getResponsiveValue(rippleIntensity, rippleIntensity * 0.6);
        const newMouseRadius = getResponsiveValue(mouseInteractionRadius, mouseInteractionRadius * 0.8);
        
        uniforms.gridSize.value = newGridSize;
        uniforms.gridThickness.value = newGridThickness;
        uniforms.rippleIntensity.value = newRippleIntensity;
        uniforms.mouseInteractionRadius.value = newMouseRadius;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseInteraction || !containerRef.current) return;
      const rect = (containerRef.current as HTMLElement).getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height; // Flip Y coordinate
      targetMouseRef.current = { x, y };
    };

    const handleMouseEnter = () => {
      if (!mouseInteraction) return;
      mouseInfluenceRef.current = 1.0;
    };

    const handleMouseLeave = () => {
      if (!mouseInteraction) return;
      mouseInfluenceRef.current = 0.0;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (!mouseInteraction || !containerRef.current) return;
      e.preventDefault();
      const rect = (containerRef.current as HTMLElement).getBoundingClientRect();
      const touch = e.touches[0];
      const x = (touch.clientX - rect.left) / rect.width;
      const y = 1.0 - (touch.clientY - rect.top) / rect.height;
      targetMouseRef.current = { x, y };
      mouseInfluenceRef.current = 1.0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!mouseInteraction || !containerRef.current) return;
      e.preventDefault();
      const rect = (containerRef.current as HTMLElement).getBoundingClientRect();
      const touch = e.touches[0];
      const x = (touch.clientX - rect.left) / rect.width;
      const y = 1.0 - (touch.clientY - rect.top) / rect.height;
      targetMouseRef.current = { x, y };
    };

    const handleTouchEnd = () => {
      if (!mouseInteraction) return;
      mouseInfluenceRef.current = 0.0;
    };

    window.addEventListener("resize", resize);
    if (mouseInteraction && containerRef.current) {
      const el = containerRef.current as HTMLElement;
      el.addEventListener("mousemove", handleMouseMove);
      el.addEventListener("mouseenter", handleMouseEnter);
      el.addEventListener("mouseleave", handleMouseLeave);
      // Touch events for mobile
      el.addEventListener("touchstart", handleTouchStart, { passive: false });
      el.addEventListener("touchmove", handleTouchMove, { passive: false });
      el.addEventListener("touchend", handleTouchEnd);
    }
    resize();

    const render = (t: number) => {
      uniforms.iTime.value = t * 0.001;

      const lerpFactor = 0.1;
      mousePositionRef.current.x +=
        (targetMouseRef.current.x - mousePositionRef.current.x) * lerpFactor;
      mousePositionRef.current.y +=
        (targetMouseRef.current.y - mousePositionRef.current.y) * lerpFactor;

      const currentInfluence = uniforms.mouseInfluence.value;
      const targetInfluence = mouseInfluenceRef.current;
      uniforms.mouseInfluence.value +=
        (targetInfluence - currentInfluence) * 0.05;

      uniforms.mousePosition.value = [
        mousePositionRef.current.x,
        mousePositionRef.current.y,
      ];

      renderer.render({ scene: mesh });
      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      if (mouseInteraction && containerRef.current) {
        const el = containerRef.current as HTMLElement;
        el.removeEventListener("mousemove", handleMouseMove);
        el.removeEventListener("mouseenter", handleMouseEnter);
        el.removeEventListener("mouseleave", handleMouseLeave);
        // Touch events for mobile
        el.removeEventListener("touchstart", handleTouchStart);
        el.removeEventListener("touchmove", handleTouchMove);
        el.removeEventListener("touchend", handleTouchEnd);
      }
      
      // Proper cleanup of WebGL context and canvas
      if (renderer && renderer.gl) {
        renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
      
      if (containerRef.current) {
        const canvas = (containerRef.current as HTMLElement).querySelector('canvas');
        if (canvas) {
          (containerRef.current as HTMLElement).removeChild(canvas);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!uniformsRef.current) return;

    const hexToRgb = (hex: string): [number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? [
          parseInt(result[1], 16) / 255,
          parseInt(result[2], 16) / 255,
          parseInt(result[3], 16) / 255,
        ]
        : [1, 1, 1];
    };

    if (uniformsRef.current) {
      if ('enableRainbow' in uniformsRef.current)
        (uniformsRef.current as any).enableRainbow.value = enableRainbow;
      if ('gridColor' in uniformsRef.current)
        (uniformsRef.current as any).gridColor.value = hexToRgb(gridColor);
      if ('rippleIntensity' in uniformsRef.current)
        (uniformsRef.current as any).rippleIntensity.value = responsiveRippleIntensity;
      if ('gridSize' in uniformsRef.current)
        (uniformsRef.current as any).gridSize.value = responsiveGridSize;
      if ('gridThickness' in uniformsRef.current)
        (uniformsRef.current as any).gridThickness.value = responsiveGridThickness;
      if ('fadeDistance' in uniformsRef.current)
        (uniformsRef.current as any).fadeDistance.value = fadeDistance;
      if ('vignetteStrength' in uniformsRef.current)
        (uniformsRef.current as any).vignetteStrength.value = vignetteStrength;
      if ('glowIntensity' in uniformsRef.current)
        (uniformsRef.current as any).glowIntensity.value = glowIntensity;
      if ('opacity' in uniformsRef.current)
        (uniformsRef.current as any).opacity.value = opacity;
      if ('gridRotation' in uniformsRef.current)
        (uniformsRef.current as any).gridRotation.value = gridRotation;
      if ('mouseInteraction' in uniformsRef.current)
        (uniformsRef.current as any).mouseInteraction.value = mouseInteraction;
      if ('mouseInteractionRadius' in uniformsRef.current)
        (uniformsRef.current as any).mouseInteractionRadius.value = responsiveMouseRadius;
    }
  }, [
    enableRainbow,
    gridColor,
    responsiveRippleIntensity,
    responsiveGridSize,
    responsiveGridThickness,
    fadeDistance,
    vignetteStrength,
    glowIntensity,
    opacity,
    gridRotation,
    mouseInteraction,
    responsiveMouseRadius,
  ]);

  return <div ref={containerRef} className="w-full h-full relative overflow-hidden [&_canvas]:block [&_canvas]:w-full [&_canvas]:h-full [&_canvas]:object-cover" />;
};

export default RippleGrid;
