const getOS = () => {
  const platform = process.platform;
  if (platform === 'darwin') {
    return 'MacOS';
  } else if (platform === 'win32' || platform === 'win64') {
    return 'Windows';
  } else if (platform === 'linux') {
    return 'Linux';
  }
}

const content = new DOMParser().parseFromString(`
  <div class="main">
    <p>
      Get started by editing <code>src/index.js</code>
    </p>
    <ul class="details">
      - Running on -
      <li>OS - ${getOS()}</li>
      <li>Node - ${process.versions.node}</li>
      <li>Chrome - ${process.versions.chrome}</li>
      <li>Electron - ${process.versions.electron}</li>
    </ul>
  </div>
`, 'text/html');

document.body.appendChild(...content.body.children);

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
  flex-direction: column;
  font-size: 2.2rem;
  text-align: center;
  color: white;
  background-color: #2a2938;
  font-family: "Jost", sans-serif;
  padding: 20px;
}

.details {
  font-size: 1.8rem;
  padding: 0;
}

.details li {
  font-size: 1.2rem;
  list-style: none;
}
`;
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Jost:wght@500&display=swap';

document.head.append(style, fontLink);
