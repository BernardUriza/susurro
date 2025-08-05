// React and external libraries

// Relative imports - components
import { MatrixNavigation } from './components/MatrixNavigation';
import { MatrixRain } from './components/MatrixRain';

function App() {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#000000' }}>
      <MatrixRain 
        density={25}
        speed={60}
        opacity={0.12}
        fontSize={14}
        color='#00ff41'
      />
      <MatrixNavigation />
    </div>
  );
}

export default App;
