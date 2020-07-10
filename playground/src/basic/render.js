export const render = () => {
  const content = new DOMParser().parseFromString(`
    <div>
      This is cool, ain't it?
    </div>
  `, 'text/html');

  document.body.append(...content.body.children);
}
