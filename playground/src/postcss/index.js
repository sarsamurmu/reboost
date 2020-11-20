import './base.css';
import './tailwind.css';

document.body.append(...new DOMParser().parseFromString(/* html */`
  <p>This should be large</p>
  <div><p>This should be small</p></div>
  <br><br>
  <span class="blue-button">Pink Box</span>
`, 'text/html').body.children);
