// React and external libraries

// Relative imports - components
import { MatrixNavigation } from './components/MatrixNavigation';
import { MatrixRain } from './components/MatrixRain';

function App() {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#000000' }}>
      <MatrixRain 
        density={50}
        speed={50}
        opacity={0.08}
        fontSize={16}
        color='#00ff41'
      />
      <MatrixNavigation />
    </div>
  );
}

export default App;
