import * as React from 'react';

export const App = () => {
  const [count, setCount] = React.useState(0);

  console.log('Called');

  return (
    <div>
      <p>Count is {count}</p>
      <button onClick={() => setCount(count + 1)}>Increase</button>
      <button onClick={() => setCount(count - 1)}>Decrease</button>
    </div>
  )
}
