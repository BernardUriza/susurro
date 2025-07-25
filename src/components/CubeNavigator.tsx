'use client'

import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'

export const CubeNavigator: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null)
  const cubeRef = useRef<THREE.Mesh>()

  useEffect(() => {
    const width = window.innerWidth
    const height = window.innerHeight

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setClearColor(0x000000)
    renderer.setSize(width, height)
    mountRef.current!.appendChild(renderer.domElement)

    // Scene & Camera
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.z = 5

    // Cube
    const geometry = new THREE.BoxGeometry(2, 2, 2)
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0x00ff41 }),
      new THREE.MeshBasicMaterial({ color: 0x009900 }),
      new THREE.MeshBasicMaterial({ color: 0x222 }),
      new THREE.MeshBasicMaterial({ color: 0x00ff41 }),
      new THREE.MeshBasicMaterial({ color: 0x111 }),
      new THREE.MeshBasicMaterial({ color: 0x009900 }),
    ]
    const cube = new THREE.Mesh(geometry, materials)
    cubeRef.current = cube
    scene.add(cube)

    // Animation
    let targetY = 0
    const animate = () => {
      cube.rotation.y += (targetY - cube.rotation.y) * 0.1
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    // Click to rotate
    const handleClick = () => {
      targetY -= Math.PI / 2
    }
    window.addEventListener('click', handleClick)

    // Cleanup
    return () => {
      window.removeEventListener('click', handleClick)
      mountRef.current?.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return (
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
        background: '#000'
      }}
    />
  )
}
