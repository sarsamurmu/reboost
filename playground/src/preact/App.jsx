import { h } from 'preact';
import { useCounter } from './useCounter';

const Test = () => {
  const [count, increment, decrement] = useCounter(0);

  console.log('Source map test');

  return (
    <div>
      <p>Count is - {count}</p>
      {/* <p>New content</p> */}
      <button onClick={increment}>Increment</button>
      <span style={{ width: 10, display: 'inline-block' }}></span>
      <button onClick={decrement}>Decrease</button>
    </div>
  )
}

export const App = () => (
  <div>
    <Test />
  </div>
)
