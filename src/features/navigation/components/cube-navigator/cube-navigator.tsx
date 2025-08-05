'use client';

// React and external libraries
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

// Relative imports - components
import {
  WhisperMatrixTerminal,
  AudioFragmentProcessor,
} from '../../../audio-processing/components';
import { AudioFragmentProcessorSimplified } from '../../../audio-processing/components/audio-fragment-processor/audio-fragment-processor-simplified';

type CubeFace = 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom';

interface FaceContent {
  component: React.ReactNode;
  title: string;
  color: string;
}

export const CubeNavigator: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<THREE.Mesh>(null);
  const raycasterRef = useRef<THREE.Raycaster>(null!);
  const mouseRef = useRef<THREE.Vector2>(null!);
  const [currentFace, setCurrentFace] = useState<CubeFace>('front');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [useSimplifiedProcessor, setUseSimplifiedProcessor] = useState(true); // Default to simplified

  // Face configurations
  const faceContents: Record<CubeFace, FaceContent> = {
    front: {
      component: <WhisperMatrixTerminal />,
      title: '[WHISPER_MATRIX_TERMINAL]',
      color: '#00ff41',
    },
    right: {
      component: useSimplifiedProcessor ? 
        <AudioFragmentProcessorSimplified onBack={() => rotateTo('front')} /> :
        <AudioFragmentProcessor onBack={() => rotateTo('front')} />,
      title: useSimplifiedProcessor ? '[SIMPLIFIED_PROCESSOR]' : '[AUDIO_FRAGMENT_PROCESSOR]',
      color: '#ff9900',
    },
    back: {
      component: (
        <div
          style={{
            color: '#0099ff',
            fontFamily: 'monospace',
            padding: 20,
            textAlign: 'center',
          }}
        >
          <h2>[ANALYTICS_MODULE]</h2>
          <p style={{ marginTop: 20, opacity: 0.7 }}>COMING SOON</p>
          <div style={{ marginTop: 40, fontSize: '2rem' }}>📊</div>
        </div>
      ),
      title: '[ANALYTICS]',
      color: '#0099ff',
    },
    left: {
      component: (
        <div
          style={{
            color: '#ff00ff',
            fontFamily: 'monospace',
            padding: 20,
            textAlign: 'center',
          }}
        >
          <h2>[SETTINGS_PANEL]</h2>
          <p style={{ marginTop: 20, opacity: 0.7 }}>CONFIGURATION</p>
          <div style={{ marginTop: 40, fontSize: '2rem' }}>⚙️</div>
        </div>
      ),
      title: '[SETTINGS]',
      color: '#ff00ff',
    },
    top: {
      component: (
        <div
          style={{
            color: '#ffff00',
            fontFamily: 'monospace',
            padding: 20,
            textAlign: 'center',
          }}
        >
          <h2>[EXPORT_CENTER]</h2>
          <p style={{ marginTop: 20, opacity: 0.7 }}>EXPORT OPTIONS</p>
          <div style={{ marginTop: 40, fontSize: '2rem' }}>💾</div>
        </div>
      ),
      title: '[EXPORT]',
      color: '#ffff00',
    },
    bottom: {
      component: (
        <div
          style={{
            color: '#00ffff',
            fontFamily: 'monospace',
            padding: 20,
            textAlign: 'center',
          }}
        >
          <h2>[HISTORY_LOG]</h2>
          <p style={{ marginTop: 20, opacity: 0.7 }}>TRANSCRIPTION HISTORY</p>
          <div style={{ marginTop: 40, fontSize: '2rem' }}>📜</div>
        </div>
      ),
      title: '[HISTORY]',
      color: '#00ffff',
    },
  };

  const faceRotations: Record<CubeFace, { x: number; y: number }> = {
    front: { x: 0, y: 0 },
    right: { x: 0, y: -Math.PI / 2 },
    back: { x: 0, y: -Math.PI },
    left: { x: 0, y: Math.PI / 2 },
    top: { x: -Math.PI / 2, y: 0 },
    bottom: { x: Math.PI / 2, y: 0 },
  };

  const rotateTo = (face: CubeFace) => {
    if (isTransitioning || face === currentFace) return;
    setIsTransitioning(true);
    setCurrentFace(face);
    setTimeout(() => setIsTransitioning(false), 800);
  };

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Renderer with better quality
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setClearColor(0x000000);
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current!.appendChild(renderer.domElement);

    // Scene & Camera
    const scene = new THREE.Scene();

    // Add fog for depth
    scene.fog = new THREE.Fog(0x000000, 5, 15);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 6);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x00ff41, 1, 100);
    pointLight1.position.set(5, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x0099ff, 0.5, 100);
    pointLight2.position.set(-5, -5, 5);
    scene.add(pointLight2);

    // Create cube with emissive materials
    const geometry = new THREE.BoxGeometry(3, 3, 3);
    const materials = [
      new THREE.MeshPhongMaterial({
        color: 0x00ff41,
        emissive: 0x00ff41,
        emissiveIntensity: 0.2,
        shininess: 100,
      }), // right
      new THREE.MeshPhongMaterial({
        color: 0xff00ff,
        emissive: 0xff00ff,
        emissiveIntensity: 0.2,
        shininess: 100,
      }), // left
      new THREE.MeshPhongMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.2,
        shininess: 100,
      }), // top
      new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.2,
        shininess: 100,
      }), // bottom
      new THREE.MeshPhongMaterial({
        color: 0x00ff41,
        emissive: 0x00ff41,
        emissiveIntensity: 0.3,
        shininess: 100,
      }), // front
      new THREE.MeshPhongMaterial({
        color: 0x0099ff,
        emissive: 0x0099ff,
        emissiveIntensity: 0.2,
        shininess: 100,
      }), // back
    ];

    const cube = new THREE.Mesh(geometry, materials);
    cubeRef.current = cube;
    scene.add(cube);

    // Add wireframe overlay
    const wireframeGeometry = new THREE.BoxGeometry(3.05, 3.05, 3.05);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff41,
      wireframe: true,
      opacity: 0.3,
      transparent: true,
    });
    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    cube.add(wireframe);

    // Add edge glow
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff41,
      linewidth: 2,
    });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    cube.add(edges);

    // Particles around cube
    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 500;
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      const radius = 4 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particlesMaterial = new THREE.PointsMaterial({
      color: 0x00ff41,
      size: 0.05,
      opacity: 0.6,
      transparent: true,
    });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    // Animation variables
    let targetRotationX = 0;
    let targetRotationY = 0;
    let currentRotationX = 0;
    let currentRotationY = 0;
    let time = 0;

    const animate = () => {
      time += 0.01;

      // Update rotation based on current face
      const faceRotation = faceRotations[currentFace];
      targetRotationX = faceRotation.x;
      targetRotationY = faceRotation.y;

      // Smooth rotation
      currentRotationX += (targetRotationX - currentRotationX) * 0.08;
      currentRotationY += (targetRotationY - currentRotationY) * 0.08;

      cube.rotation.x = currentRotationX;
      cube.rotation.y = currentRotationY;

      // Subtle floating animation
      cube.position.y = Math.sin(time) * 0.1;

      // Rotate wireframe
      wireframe.rotation.x += 0.001;
      wireframe.rotation.y += 0.001;

      // Animate particles
      particles.rotation.y = time * 0.1;
      particles.rotation.x = time * 0.05;

      // Pulse edge glow
      edges.material.opacity = 0.5 + Math.sin(time * 2) * 0.3;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // Initialize refs if needed
    if (!raycasterRef.current) {
      raycasterRef.current = new THREE.Raycaster();
    }
    if (!mouseRef.current) {
      mouseRef.current = new THREE.Vector2();
    }

    // Mouse interaction
    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current.x = (event.clientX / width) * 2 - 1;
      mouseRef.current.y = -(event.clientY / height) * 2 + 1;

      // Subtle camera movement
      camera.position.x = mouseRef.current.x * 0.5;
      camera.position.y = mouseRef.current.y * 0.5;
      camera.lookAt(cube.position);
    };

    // Keyboard controls
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowRight':
          rotateTo('right');
          break;
        case 'ArrowLeft':
          rotateTo('left');
          break;
        case 'ArrowUp':
          rotateTo('top');
          break;
        case 'ArrowDown':
          rotateTo('bottom');
          break;
        case ' ':
          rotateTo('front');
          break;
      }
    };

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [currentFace]);

  return (
    <>
      <div
        ref={mountRef}
        style={{
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          margin: 0,
          padding: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          background: 'radial-gradient(circle at center, #001100 0%, #000000 100%)',
        }}
      />

      {/* Toggle for Simplified/Original Processor */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 20,
          background: 'rgba(0, 0, 0, 0.9)',
          padding: '10px 15px',
          border: '1px solid #00ff41',
          borderRadius: 5,
          fontFamily: 'monospace',
          fontSize: '0.9rem',
        }}
      >
        <button
          onClick={() => setUseSimplifiedProcessor(!useSimplifiedProcessor)}
          style={{
            background: useSimplifiedProcessor ? '#00ff41' : '#ff9900',
            color: '#000',
            border: 'none',
            padding: '5px 10px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontFamily: 'monospace',
          }}
        >
          {useSimplifiedProcessor ? '[SIMPLIFIED]' : '[ORIGINAL]'}
        </button>
        <span style={{ marginLeft: '10px', color: '#00ff41' }}>
          {useSimplifiedProcessor ? '80 lines' : '900 lines'}
        </span>
      </div>

      {/* Navigation UI */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 10,
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.8)',
          padding: 15,
          borderRadius: 10,
          border: '1px solid #00ff41',
          backdropFilter: 'blur(10px)',
        }}
      >
        {Object.entries(faceContents).map(([face, content]) => (
          <button
            key={face}
            onClick={() => rotateTo(face as CubeFace)}
            style={{
              background: currentFace === face ? content.color : 'transparent',
              color: currentFace === face ? '#000' : content.color,
              border: `1px solid ${content.color}`,
              padding: '8px 16px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              borderRadius: 5,
              transition: 'all 0.3s',
              opacity: isTransitioning ? 0.5 : 1,
              transform: currentFace === face ? 'scale(1.1)' : 'scale(1)',
            }}
            disabled={isTransitioning}
          >
            {content.title}
          </button>
        ))}
      </div>

      {/* Current face content overlay */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          right: 20,
          bottom: 100,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isTransitioning ? 0 : 1,
          transition: 'opacity 0.3s',
        }}
      >
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.9)',
            border: `2px solid ${faceContents[currentFace].color}`,
            borderRadius: 10,
            padding: 20,
            maxWidth: 600,
            maxHeight: '80vh',
            overflow: 'auto',
            pointerEvents: 'all',
            boxShadow: `0 0 30px ${faceContents[currentFace].color}40`,
          }}
        >
          {faceContents[currentFace].component}
        </div>
      </div>

      {/* Instructions */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          color: '#00ff41',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          opacity: 0.7,
          textAlign: 'right',
        }}
      >
        <p>USE ARROW KEYS TO NAVIGATE</p>
        <p>CLICK BUTTONS TO JUMP</p>
        <p>SPACE TO RETURN HOME</p>
      </div>
    </>
  );
};
