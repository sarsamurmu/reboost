import './styles.css';

const content = new DOMParser().parseFromString(`
  <div class="background"></div>
  <div class="main">
    <p>
      Get started by editing <code>src/index.js</code>
    </p>
    <p class="photo-credit">
      Photo from
      <a href="https://unsplash.com">Unsplash</a>
    </p>
  </div>
`, 'text/html');

document.body.append(...content.body.children);
