import './styles.css';

const content = new DOMParser().parseFromString(`
  <div class="main">
    <p>
      Get started by editing <code>src/index.js</code>
    </p>
  </div>
`, 'text/html');

document.body.append(...content.body.children);
