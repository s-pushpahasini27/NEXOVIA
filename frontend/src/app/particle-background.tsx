"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  tone: number;
};

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let particles: Particle[] = [];
    let frame = 0;
    let running = true;
    let dark = document.documentElement.classList.contains("dark");

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count =
        window.innerWidth < 640
          ? 16
          : Math.min(
              40,
              Math.max(
                24,
                Math.round((window.innerWidth * window.innerHeight) / 44000),
              ),
            );
      particles = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: 1 + Math.random() * 1.9,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.035 - Math.random() * 0.11,
        tone: index % 3,
      }));
    };
    const paint = () => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let index = 0; index < particles.length; index++) {
        const particle = particles[index];
        const palette = dark
          ? ["201,175,255", "133,173,255", "176,142,238"]
          : ["91,52,150", "61,108,167", "126,72,169"];
        context.beginPath();
        context.fillStyle = `rgba(${palette[particle.tone]},${dark ? 0.27 : 0.36})`;
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
        for (let other = index + 1; other < particles.length; other++) {
          const next = particles[other];
          const distance = Math.hypot(particle.x - next.x, particle.y - next.y);
          if (distance < 105) {
            context.beginPath();
            context.strokeStyle = dark
              ? `rgba(181,154,235,${(1 - distance / 105) * 0.055})`
              : `rgba(91,58,139,${(1 - distance / 105) * 0.095})`;
            context.lineWidth = dark ? 0.7 : 0.9;
            context.moveTo(particle.x, particle.y);
            context.lineTo(next.x, next.y);
            context.stroke();
          }
        }
      }
    };
    const animate = () => {
      if (!running) return;
      if (!reduced.matches) {
        for (const particle of particles) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.y < -8) {
            particle.y = window.innerHeight + 8;
            particle.x = Math.random() * window.innerWidth;
          }
          if (particle.x < -8) particle.x = window.innerWidth + 8;
          if (particle.x > window.innerWidth + 8) particle.x = -8;
        }
      }
      paint();
      if (!reduced.matches) frame = requestAnimationFrame(animate);
    };
    const restart = () => {
      cancelAnimationFrame(frame);
      animate();
    };
    const themeObserver = new MutationObserver(() => {
      dark = document.documentElement.classList.contains("dark");
      paint();
    });
    const visibility = () => {
      running = !document.hidden;
      if (running) restart();
      else cancelAnimationFrame(frame);
    };
    resize();
    animate();
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    window.addEventListener("resize", resize);
    reduced.addEventListener("change", restart);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      reduced.removeEventListener("change", restart);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      className="particle-background"
      aria-hidden="true"
    />
  );
}
