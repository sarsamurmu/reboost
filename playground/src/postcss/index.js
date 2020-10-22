import './base.css';

document.body.append(...new DOMParser().parseFromString(/* html */`
  <p>This should be large</p>
  <div><p>This should be small</p></div>
  <br><br>
  <span class="pink-box">Pink Box</span>
`, 'text/html').body.children);
