// React and external libraries

// Relative imports - components
import { MatrixNavigation } from './components/MatrixNavigation';
import { MatrixRain } from './components/MatrixRain';

function App() {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#000000' }}>
      <MatrixRain 
        density={80}
        speed={35}
        opacity={0.18}
        fontSize={18}
        color='#00ff41'
        glowIntensity={1.5}
        waveEffect={true}
        colorMode='gradient'
      />
      <MatrixNavigation />
    </div>
  );
}

export default App;
