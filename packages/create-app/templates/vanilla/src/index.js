const style = document.createElement('style');
style.innerHTML = `
.main {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 2.2rem;
  text-align: center;
  color: white;
  background-color: #2a2938;
  font-family: "Jost", sans-serif;
  padding: 20px;
}
`;
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Jost:wght@500&display=swap';

document.head.append(style, fontLink);

const content = new DOMParser().parseFromString(`
  <div class="main">
    <p>
      Get started by editing <code>src/index.js</code>
    </p>
  </div>
`, 'text/html');

document.body.appendChild(...content.body.children);
