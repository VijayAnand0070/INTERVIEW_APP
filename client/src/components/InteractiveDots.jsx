import React, { useEffect, useRef } from "react";

export default function InteractiveDots() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d", { alpha: true });
    
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    
    // Dark Shiny Glowing Yellow and Glowing Blue
    const darkYellowColor = "#FF9900"; // Rich, dark amber-yellow
    const glowingBlueColor = "#0066FF"; // Vibrant, glowing blue
    
    let mouse = {
      x: width / 2,
      y: height / 2,
      isActive: false
    };

    // 3D Rotation angles
    let rotation = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0
    };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.isActive = true;
      
      // Moving mouse spins the globe (up/down and left/right)
      rotation.targetX = (mouse.y - height / 2) * 0.003;
      rotation.targetY = (mouse.x - width / 2) * 0.003;
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      init();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleResize);

    class Particle3D {
      constructor(radius, index, total) {
        this.sphereRadius = radius;
        this.index = index;
        
        // Fibonacci sphere distribution for perfect globe
        const phi = Math.acos(1 - 2 * (index + 0.5) / total);
        const theta = Math.PI * (1 + Math.sqrt(5)) * index;
        
        // 3D Coordinates
        this.baseX = this.sphereRadius * Math.cos(theta) * Math.sin(phi);
        this.baseY = this.sphereRadius * Math.sin(theta) * Math.sin(phi);
        this.baseZ = this.sphereRadius * Math.cos(phi);
        
        // Determine color: Alternate gracefully
        this.isYellow = Math.sin(theta * 4 + phi * 3) > 0;
        this.color = this.isYellow ? darkYellowColor : glowingBlueColor;
        
        // Very small dot size
        this.baseSize = 1.0 + Math.random() * 0.8;
      }
      
      updateAndDraw(centerX, centerY, rotX, rotY, time) {
        // Rotate around X axis
        const y1 = this.baseY * Math.cos(rotX) - this.baseZ * Math.sin(rotX);
        const z1 = this.baseY * Math.sin(rotX) + this.baseZ * Math.cos(rotX);
        
        // Rotate around Y axis
        const x2 = this.baseX * Math.cos(rotY) + z1 * Math.sin(rotY);
        const z2 = -this.baseX * Math.sin(rotY) + z1 * Math.cos(rotY);
        const y2 = y1;
        
        // Perspective Projection
        const fov = 800; // Depth of field
        if (z2 < -fov) return; 
        
        const scale = fov / (fov + z2);
        
        // Static center 2D projection
        const screenX = centerX + x2 * scale;
        const screenY = centerY + y2 * scale;
        
        const breathing = Math.sin(time + this.index * 0.05) * 0.3;
        const size = Math.max(0.1, (this.baseSize + breathing) * scale);
        
        // Opacity fading for dots in the back
        const opacity = Math.min(1, Math.max(0.05, scale * scale * 0.8));
        
        ctx.save();
        ctx.translate(screenX, screenY);
        
        // Orient tangentially
        const tangentAngle = Math.atan2(y2, x2) + Math.PI / 2;
        ctx.rotate(tangentAngle);
        
        ctx.globalAlpha = opacity;
        ctx.fillStyle = this.color;
        
        // High blur for "shiny glowing" effect
        ctx.shadowBlur = 12 * scale;
        ctx.shadowColor = this.color;
        
        ctx.beginPath();
        const dashLength = size * 3;
        const dashWidth = size;
        
        if (ctx.roundRect) {
          ctx.roundRect(-dashWidth/2, -dashLength/2, dashWidth, dashLength, size/2);
        } else {
          ctx.rect(-dashWidth/2, -dashLength/2, dashWidth, dashLength);
        }
        ctx.fill();
        
        ctx.restore();
      }
    }

    let particles = [];
    function init() {
      particles = [];
      const numParticles = 1200; 
      // Size of the globe - perfectly scaled to fit the center behind text
      const globeRadius = Math.min(width, height) * 0.40; 
      
      const layers = 3;
      
      for (let layer = 0; layer < layers; layer++) {
        const layerRadius = globeRadius * (0.6 + layer * 0.2); 
        const layerParticles = Math.floor(numParticles / layers);
        
        for (let i = 0; i < layerParticles; i++) {
          particles.push(new Particle3D(layerRadius, i, layerParticles));
        }
      }
    }

    let animationFrameId;
    let time = 0;
    
    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, width, height);
      
      time += 0.02;
      
      // FIXED EXACT CENTER: Structure no longer drifts to the mouse
      const fixedCenterX = width / 2;
      const fixedCenterY = height / 2;
      
      // 3D Rotation Interpolation: Mouse movement spins the globe
      rotation.x += (rotation.targetX - rotation.x) * 0.03;
      rotation.y += (rotation.targetY - rotation.y) * 0.03;
      
      // Combine mouse rotation with constant automatic spinning
      const currentRotX = rotation.x + Math.sin(time * 0.2) * 0.1;
      const currentRotY = rotation.y + time * 0.18; // Spin speed
      
      // Z-depth sorting for correct 3D rendering
      particles.forEach(p => {
        const z1 = p.baseY * Math.sin(currentRotX) + p.baseZ * Math.cos(currentRotX);
        p.currentZ = -p.baseX * Math.sin(currentRotY) + z1 * Math.cos(currentRotY);
      });
      
      particles.sort((a, b) => b.currentZ - a.currentZ);
      
      for (let i = 0; i < particles.length; i++) {
        particles[i].updateAndDraw(fixedCenterX, fixedCenterY, currentRotX, currentRotY, time);
      }
    }

    init();
    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 z-0 pointer-events-none"
      style={{ background: "transparent" }}
    />
  );
}
